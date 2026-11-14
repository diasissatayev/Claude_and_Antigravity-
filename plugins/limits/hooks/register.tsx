import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Prefs, Provider, ProviderId, Snapshot, Window } from '../types'
import { bandSvg, BAND_H } from './band'

// ---------------------------------------------------------------------------
// Limits of three AI subscriptions, refreshed with no model call:
//   Claude  — the engine's own rate-limit readings (session.measure / $.session.usage)
//   Codex   — `codex app-server` answers account/rateLimits/read (scripts/codex-limits.mjs)
//   Gemini  — agy's status line writes ~/.agy-work/status.json on every agy run (agy plugin),
//             failures land in ~/.agy-work/last-signal.json; never polls agy itself
// Claude learns the picture once per conversation (a first-message context block) and then
// only when it changes (a hidden note beside the next prompt), so the prompt cache holds.
// ---------------------------------------------------------------------------

const PANE = 'limits'
const IDS: ProviderId[] = ['claude', 'codex', 'gemini']
const NAME: Record<ProviderId, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' }
const CODEX_EVERY_MS = 3 * 60 * 1000
const GEMINI_PROBE_EVERY_MS = 30 * 60 * 1000
const GEMINI_EVERY_MS = 60 * 1000
const LOW = 80
const OUT = 95

const EMPTY: Provider = { status: 'unknown', plan: null, windows: [], updatedAt: 0, note: null }
const snapshot = atom({ plugin: 'limits', key: 'snapshot' } as const, { claude: EMPTY, codex: EMPTY, gemini: EMPTY }, { shape: 'snapshot-2' })
const told = atom({ plugin: 'limits', key: 'told' } as const, '')
const prefs = atom({ plugin: 'limits', key: 'prefs' } as const, { isBandHidden: false } as Prefs)
const tick = atom({ plugin: 'limits', key: 'tick' } as const, 0)
const ctx = atom({ plugin: 'limits', key: 'ctx' } as const, null as number | null)
const compacting = atom({ plugin: 'limits', key: 'compacting' } as const, false)

// --- readings ---------------------------------------------------------------

type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

function claudeFrom(rateLimits: readonly RateLimit[], at: number): Provider {
  const windows: Window[] = rateLimits
    .filter(r => r.kind === 'five_hour' || r.kind === 'seven_day')
    .map(r => ({
      kind: r.kind === 'five_hour' ? '5h' : 'week',
      usedPct: r.percentUsed,
      resetsAt: r.resetsAt ? Date.parse(r.resetsAt) : null,
    }))
  return { status: 'ok', plan: null, windows, updatedAt: at, note: windows.length ? null : 'нет данных до первого ответа' }
}

// A write redraws the band; skip it when nothing a person would see changed.
const same = (a: Provider, b: Provider) => {
  const k = (p: Provider) => JSON.stringify({ ...p, updatedAt: 0, windows: p.windows.map(w => ({ ...w, usedPct: Math.round(w.usedPct) })) })
  return k(a) === k(b)
}

async function setProvider($: EngineInterface, id: ProviderId, p: Provider): Promise<void> {
  const cur = (await read($, snapshot))[id]
  if (cur && same(cur, p)) return
  await update($, snapshot, s => ({ ...s, [id]: p }))
}

async function refreshClaude($: EngineInterface): Promise<void> {
  const usage = await $.session.usage().catch(() => null)
  if (!usage) return
  await setProvider($, 'claude', claudeFrom(usage.rateLimits, await $.clock.now()))
  if (typeof usage.context?.percent === 'number') {
    const pct = Math.round(usage.context.percent)
    if ((await read($, ctx)) !== pct) await update($, ctx, () => pct)
  }
}

let codexBusy = false
async function refreshCodex($: EngineInterface): Promise<void> {
  if (codexBusy) return
  codexBusy = true
  try {
    const at = await $.clock.now()
    const r = await $.process.run(['node', `${$.plugin.root}/scripts/codex-limits.mjs`], { timeoutMs: 40000 }).catch(() => null)
    const line = (r?.stdout ?? '').trim().split('\n').pop() ?? ''
    let j: { status?: string; plan?: string | null; windows?: Window[]; note?: string; reached?: string | null } = {}
    try {
      j = JSON.parse(line)
    } catch {
      j = { status: 'error', note: 'не удалось прочитать ответ Codex' }
    }
    const status = j.status === 'ok' || j.status === 'missing' || j.status === 'signed-out' ? j.status : 'error'
    await setProvider($, 'codex', {
      status,
      plan: j.plan ?? null,
      windows: j.windows ?? [],
      updatedAt: at,
      note: j.reached ? `лимит достигнут: ${j.reached}` : (j.note ?? null),
    })
  } finally {
    codexBusy = false
  }
}

type AgyQuota = { remaining_fraction?: number; remaining_amount?: number; reset_time?: string; reset_in_seconds?: number; disabled?: boolean }

function geminiKind(bucket: string): string {
  if (/week/i.test(bucket)) return 'week'
  if (/5h|five|hour|daily|day/i.test(bucket)) return /day/i.test(bucket) ? 'day' : '5h'
  return bucket
}

async function readJson<T>($: EngineInterface, path: string): Promise<T | null> {
  try {
    return JSON.parse(await $.fs.read(path)) as T
  } catch {
    return null
  }
}

// Connection and plan: agy's own ACP server, no model call (scripts/gemini-status.mjs, ~1.5 s).
// Run at session start, every 30 minutes and on /limits refresh — it starts agy, so not every minute.
let geminiBusy = false
let geminiConn: { status: Provider['status']; plan: string | null; note: string | null } = { status: 'unknown', plan: null, note: null }
async function probeGemini($: EngineInterface): Promise<void> {
  if (geminiBusy) return
  geminiBusy = true
  try {
    const r = await $.process.run(['node', `${$.plugin.root}/scripts/gemini-status.mjs`], { timeoutMs: 45000 }).catch(() => null)
    const line = (r?.stdout ?? '').trim().split('\n').pop() ?? ''
    try {
      const j = JSON.parse(line) as { status: string; plan?: string | null; note?: string }
      const status = j.status === 'ok' || j.status === 'missing' || j.status === 'signed-out' ? j.status : 'error'
      geminiConn = { status, plan: j.plan ?? null, note: j.note ?? null }
    } catch {
      geminiConn = { status: 'error', plan: null, note: 'не удалось опросить agy' }
    }
  } finally {
    geminiBusy = false
  }
  await refreshGemini($)
}

// Everything else is plain file reads, cheap enough for every minute and after every agy task:
//   ~/.agy-work/status.json      quota % — written by agy's status line, i.e. only while agy runs in its own window
//   ~/.agy-work/usage.log        one line per plugin run → tasks and tokens in the last 5 h / week
//   ~/.agy-work/last-signal.json the last sign-out / quota failure of a plugin run
async function refreshGemini($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
  const st = await readJson<{ updatedAt: number; planTier: string | null; quota: Record<string, AgyQuota> }>($, `${home}/.agy-work/status.json`)
  const sig = await readJson<{ status: string; reason: string; at: number }>($, `${home}/.agy-work/last-signal.json`)
  const sigAt = sig ? sig.at * 1000 : 0

  let log = ''
  try {
    log = await $.fs.read(`${home}/.agy-work/usage.log`)
  } catch {}
  const activity = { runs5h: 0, tokens5h: 0, runsWeek: 0, tokensWeek: 0 }
  for (const line of log.split('\n')) {
    const m = /^(\d{9,})\s+AGY_USAGE\s+(\{.*\})\s*$/.exec(line)
    if (!m) continue
    const age = at - Number(m[1]) * 1000
    let total = 0
    try {
      total = Number((JSON.parse(m[2] ?? '{}') as { usage?: { total?: number } }).usage?.total ?? 0)
    } catch {}
    if (age <= 7 * 86400000) {
      activity.runsWeek++
      activity.tokensWeek += total
    }
    if (age <= 5 * 3600000) {
      activity.runs5h++
      activity.tokens5h += total
    }
  }

  let status = geminiConn.status
  let note = geminiConn.note
  if (sig && sig.status === 'AUTH_REQUIRED' && sigAt >= (st?.updatedAt ?? 0)) {
    status = 'signed-out'
    note = 'нужно войти: запусти agy в терминале'
  }
  if (sig && sig.status === 'AGY_MISSING') status = 'missing'

  const windows: Window[] = []
  for (const [bucket, q] of Object.entries(st?.quota ?? {})) {
    // gemini-5h / gemini-weekly are what the plugin spends; 3p-* are agy's Claude/GPT models.
    if (q.disabled || !st || /^3p/i.test(bucket)) continue
    const resetsAt = q.reset_time ? Date.parse(q.reset_time) : typeof q.reset_in_seconds === 'number' ? st.updatedAt + q.reset_in_seconds * 1000 : null
    let used = typeof q.remaining_fraction === 'number' ? Math.round((1 - q.remaining_fraction) * 1000) / 10 : null
    if (used === null) continue
    if (resetsAt !== null && resetsAt < at) used = 0 // the window has reset since that reading
    windows.push({ kind: geminiKind(bucket), usedPct: used, resetsAt })
  }
  const isOut = sig?.status === 'QUOTA_EXHAUSTED' && sigAt >= (st?.updatedAt ?? 0) && at - sigAt < 5 * 3600000
  if (isOut && status === 'ok') note = 'последняя задача упёрлась в квоту Gemini'
  await setProvider($, 'gemini', {
    status,
    plan: geminiConn.plan ?? st?.planTier ?? null,
    windows: isOut && !windows.some(w => w.usedPct >= OUT) ? [...windows, { kind: 'quota', usedPct: 100, resetsAt: null }] : windows,
    updatedAt: st?.updatedAt ?? 0,
    note,
    activity,
  })
}

// --- wording ------------------------------------------------------------------

const KIND_RU: Record<string, string> = { '5h': '5ч', week: 'нед', day: 'день', quota: 'квота' }
const kindRu = (k: string) => KIND_RU[k] ?? k

function worst(p: Provider): number {
  return p.windows.reduce((m, w) => Math.max(m, w.usedPct), 0)
}

function level(p: Provider): 'off' | 'out' | 'low' | 'ok' {
  if (p.status !== 'ok') return 'off'
  const w = worst(p)
  return w >= OUT ? 'out' : w >= LOW ? 'low' : 'ok'
}

function offReason(p: Provider): string {
  switch (p.status) {
    case 'missing':
      return 'не установлен'
    case 'signed-out':
      return 'не выполнен вход'
    case 'unknown':
      return 'ещё нет данных'
    case 'error':
      return `ошибка: ${p.note ?? 'нет ответа'}`
    default:
      return ''
  }
}

function fmtIn(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000))
  if (m < 60) return `${m}м`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}ч ${m % 60}м`
  return `${Math.floor(h / 24)}д ${h % 24}ч`
}

function windowsText(p: Provider, en = false): string {
  return p.windows
    .map(w => (en ? `${w.kind} ${Math.round(w.usedPct)}% used` : `${kindRu(w.kind)} ${Math.round(w.usedPct)}%`))
    .join(en ? ', ' : ' · ')
}

// One line per provider for Claude (English: it reads the model's own language best, and it is shorter).
function modelLine(id: ProviderId, p: Provider, now: number): string {
  const name = id === 'codex' ? `Codex (${p.plan ?? 'ChatGPT'})` : id === 'gemini' ? `Gemini (${p.plan ?? 'Google AI'})` : 'Claude (this session)'
  if (id !== 'claude' && p.status !== 'ok') {
    const why = p.status === 'missing' ? 'not installed' : p.status === 'signed-out' ? 'signed out' : p.status === 'unknown' ? 'not checked yet' : 'unreachable'
    return `${name}: NOT AVAILABLE (${why}) — do not route work to it.`
  }
  const lv = level(p)
  const soonest = p.windows.filter(w => w.usedPct >= OUT && w.resetsAt).map(w => w.resetsAt as number).sort()[0]
  const tail =
    lv === 'out'
      ? ` — EXHAUSTED${soonest ? ` for ~${fmtIn(soonest - now)}` : ''}; do not route work to it.`
      : lv === 'low'
        ? ' — running low; only clearly worthwhile tasks.'
        : ''
  const act = p.activity ? ` (plugin use: ${p.activity.runs5h} tasks in 5h, ${p.activity.runsWeek} this week)` : ''
  const quota = windowsText(p, true) || (id === 'gemini' ? 'connected, quota % not reported in background mode' : 'no reading yet')
  return `${name}: ${quota}${act}${tail}`
}

const fmtTok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`)
const tasksRu = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'задача' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'задачи' : 'задач'}`

function signature(s: Snapshot): string {
  return IDS.map(id => `${id}:${s[id].status}:${level(s[id])}`).join('|')
}

const POLICY = `Three AI subscriptions are available. Route work so the scarce ones last:
- Claude (you): the conductor — understand, plan, decide, make small edits, verify what the others return.
- Codex via /codex:rescue, /codex:review and the codex:codex-rescue agent: writing, fixing and reviewing code. Prefer it for any non-trivial code change or bug hunt.
- Gemini via the /agy:* commands (skill "gemini"): audio/video/images, web research, documents and folders of documents, scraping, site design review, bulk reading, second opinions.
- Codex Plus and Gemini Pro quotas are modest: don't delegate tiny tasks (describing and checking costs more), ingest only their digests, and verify results before relying on them.
- A provider marked NOT AVAILABLE or EXHAUSTED: do the work yourself or use the other one, and say so once. When Claude's own 5h window is above ${LOW}%, delegate more eagerly.`

async function contextText($: EngineInterface): Promise<string> {
  const s = await read($, snapshot)
  const now = await $.clock.now()
  return `${POLICY}\nStatus now:\n${IDS.map(id => `- ${modelLine(id, s[id], now)}`).join('\n')}`
}

// --- drawing -------------------------------------------------------------------

function colorOf(pct: number): string | undefined {
  return pct >= OUT ? 'red' : pct >= LOW ? 'yellow' : undefined
}

function bar(pct: number, width: number): string {
  const n = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return '█'.repeat(n) + '░'.repeat(width - n)
}

async function togglePane($: EngineInterface): Promise<boolean> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    return false
  }
  await $.ui.open({ id: PANE, title: 'Лимиты' })
  return true
}

const FIX: Record<ProviderId, Partial<Record<Provider['status'], string>>> = {
  claude: {},
  codex: {
    missing: 'установи: npm install -g @openai/codex',
    'signed-out': 'войди: codex login (в терминале)',
    error: 'проверь /codex:setup',
  },
  gemini: {
    missing: 'установи и настрой: /agy:setup',
    'signed-out': 'войди: запусти agy в терминале → Google OAuth',
    unknown: 'появится после первой задачи Gemini или запуска agy',
    error: 'проверь /agy:setup',
  },
}

// --- hooks -----------------------------------------------------------------------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'limits',
      description: 'Лимиты Claude, Codex и Gemini (5 часов и неделя): панель; "/limits band" — показать или скрыть строку над вводом, "/limits refresh" — обновить',
    })
    const hidden = (await $.store.get('isBandHidden')) === true
    await update($, prefs, p => ({ ...p, isBandHidden: hidden }))
    void refreshClaude($)
    void probeGemini($)
    void refreshCodex($)
    $.clock.every(CODEX_EVERY_MS, () => void refreshCodex($))
    $.clock.every(GEMINI_PROBE_EVERY_MS, () => void probeGemini($))
    $.clock.every(GEMINI_EVERY_MS, () => {
      void (async () => {
        await refreshGemini($)
        await update($, tick, t => t + 1)
      })()
    })
    return started
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await setProvider($, 'claude', claudeFrom(e.rateLimits, await $.clock.now()))
    }
    if (e.changed.includes('context') && typeof e.context.percent === 'number') {
      const pct = Math.round(e.context.percent)
      if ((await read($, ctx)) !== pct) await update($, ctx, () => pct)
    }
    return next(e)
  })

  // After a Codex or Gemini job, re-read that provider (free) so the numbers follow the work.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const text = JSON.stringify(e).slice(0, 4000)
    if (/codex-companion|codex:codex-rescue|codex-rescue/.test(text)) void refreshCodex($)
    if (/agy-(task|delegate|job|notebook|handoff)|\bagy\b/.test(text)) void refreshGemini($)
    return ran
  })

  // Once per conversation: the routing policy and the current picture.
  on('prompt.context', async ($, e, next) => {
    const r = await next(e)
    await refreshGemini($)
    const s = await read($, snapshot)
    await update($, told, () => signature(s))
    return { ...r, blocks: [...r.blocks, { name: 'subscriptions', text: await contextText($) }] }
  })

  // Afterwards only a change (connected / signed out / running low / exhausted) is worth tokens.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    let note: string | null = null
    try {
      await refreshGemini($)
      const s = await read($, snapshot)
      const sig = signature(s)
      const last = await read($, told)
      if (last && sig !== last) {
        await update($, told, () => sig)
        const now = await $.clock.now()
        const changed = IDS.filter(id => !last.includes(`${id}:${s[id].status}:${level(s[id])}`))
        note = `[subscriptions update] ${changed.map(id => modelLine(id, s[id], now)).join(' ')}`
      }
    } catch {
      note = null // a broken reading never holds a prompt back
    }
    return note ? next({ ...e, context: [...(e.context ?? []), note] }) : next(e)
  })

  on('command.run', { command: 'limits' }, async ($, e) => {
    const arg = (e.args ?? '').trim()
    if (arg === 'band') {
      const p = await read($, prefs)
      const hidden = !p.isBandHidden
      await update($, prefs, x => ({ ...x, isBandHidden: hidden }))
      await $.store.set('isBandHidden', hidden)
      return { text: hidden ? 'Строка лимитов скрыта.' : 'Строка лимитов показана.' }
    }
    if (arg === 'refresh') {
      await Promise.all([refreshClaude($), refreshCodex($), probeGemini($)])
      return { text: 'Лимиты обновлены.' }
    }
    const isOpen = await togglePane($)
    return { text: isOpen ? 'Панель лимитов открыта.' : 'Панель лимитов закрыта.' }
  })

  // While the limits band shows, the skins mod's usage row (context, 5h and 7d rings, Compact)
  // only repeats it — this band carries the context and a compact button of its own.
  on('ui.render', { component: 'AbovePromptList' }, async ($, e, next) => {
    const p = await read($, prefs)
    if (p.isBandHidden || e.props.hasSurvey) return next(e)
    const rows = e.props.rows.filter(r => r.plugin !== 'skins')
    return next(rows.length === e.props.rows.length ? e : { ...e, props: { ...e.props, rows } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, prefs)
    if (e.props.hasSurvey || p.isBandHidden) return next(e)
    const s = await read($, snapshot)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const ctxPct = await read($, ctx)
    const isCompacting = await read($, compacting)

    // Claude Code's own /compact, started in a dispatch of its own so the press ending does not cancel it.
    const compact = () => {
      void update($, compacting, () => true)
      $.clock.after(1, () =>
        $.command
          .run({ command: 'compact' })
          .catch((error: unknown) => $.ui.toast(`Сжать не удалось: ${error instanceof Error ? error.message : String(error)}`))
          .finally(() => update($, compacting, () => false)),
      )
    }
    const showCompact = ctxPct !== null && ctxPct >= 50 && !e.props.isWorking && !isCompacting

    // Desktop and mobile: one animated SVG row; the terminal keeps the text row below.
    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      const width = Math.max(260, Math.min(1400, (e.props.bodyColumns || 100) * 8 - (showCompact ? 150 : 70)))
      const svg = bandSvg({ providers: s, contextPct: ctxPct, offText: offReason, nowMs: await $.clock.now(), width })
      const alt = IDS.map(id => `${NAME[id]}: ${s[id].status === 'ok' || id === 'claude' ? windowsText(s[id]) || '—' : offReason(s[id])}`).join('; ')
      return (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Svg source={svg} alt={alt} width={width} height={BAND_H} />
          {showCompact && <Button key="limits-compact" label="Сжать" plain onPress={compact} />}
          <Button key="limits-open" label="⋯" plain onPress={() => void togglePane($)} />
        </Box>
      )
    }

    return (
      <Box flexDirection="row" gap={2}>
        {IDS.map(id => {
          const pr = s[id]
          const isOff = id !== 'claude' && pr.status !== 'ok'
          return (
            <Box key={id} flexDirection="row" gap={1}>
              <Text bold>{NAME[id]}</Text>
              {isOff ? (
                <Text dimColor>{offReason(pr)}</Text>
              ) : pr.windows.length === 0 ? (
                <Text dimColor>{pr.activity ? `5ч: ${tasksRu(pr.activity.runs5h)}` : '—'}</Text>
              ) : (
                pr.windows.map(w => (
                  <Text key={w.kind} color={colorOf(w.usedPct)} dimColor={!colorOf(w.usedPct)}>
                    {kindRu(w.kind)} {Math.round(w.usedPct)}%
                  </Text>
                ))
              )}
            </Box>
          )
        })}
        <Button key="limits-open" label="⋯" plain onPress={() => void togglePane($)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await read($, tick)
    const s = await read($, snapshot)
    const now = await $.clock.now()
    const { Box, Text, Button } = $.ui.resolve(e)
    const barW = Math.max(8, Math.min(24, (e.props.bodyColumns || 40) - 30))
    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>Процент — сколько использовано. Обновляется без затрат токенов.</Text>
        {IDS.map(id => {
          const pr = s[id]
          const isOff = id !== 'claude' && pr.status !== 'ok'
          const age = pr.updatedAt ? fmtIn(now - pr.updatedAt) : null
          return (
            <Box key={id} flexDirection="column">
              <Text bold>
                {NAME[id]}
                {pr.plan ? ` · ${pr.plan}` : ''}
                {isOff ? ` — ${offReason(pr)}` : ''}
              </Text>
              {isOff && FIX[id][pr.status] && <Text dimColor>  {FIX[id][pr.status]}</Text>}
              {!isOff && pr.windows.length === 0 && (
                <Text dimColor>
                  {'  '}
                  {id === 'gemini' ? 'проценты квоты появятся, когда откроешь agy в терминале (их показывает только его окно)' : (pr.note ?? 'нет данных')}
                </Text>
              )}
              {!isOff && pr.activity && (
                <Text dimColor>
                  {'  '}через плагин: 5ч — {tasksRu(pr.activity.runs5h)} · {fmtTok(pr.activity.tokens5h)} ток., неделя — {tasksRu(pr.activity.runsWeek)} · {fmtTok(pr.activity.tokensWeek)} ток.
                </Text>
              )}
              {!isOff &&
                pr.windows.map(w => (
                  <Text key={w.kind}>
                    {'  '}
                    {kindRu(w.kind).padEnd(5)}
                    <Text color={colorOf(w.usedPct) ?? 'green'}>{bar(w.usedPct, barW)}</Text> {String(Math.round(w.usedPct)).padStart(3)}%
                    <Text dimColor>{w.resetsAt ? `  сброс через ${fmtIn(w.resetsAt - now)}` : ''}</Text>
                  </Text>
                ))}
              {!isOff && pr.note && pr.windows.length > 0 && <Text color="yellow">  {pr.note}</Text>}
              {age && id !== 'claude' && pr.windows.length > 0 && <Text dimColor>  проценты на {fmtIn(now - pr.updatedAt)} назад</Text>}
            </Box>
          )
        })}
        <Button key="limits-refresh" label="Обновить" onPress={() => void Promise.all([refreshClaude($), refreshCodex($), probeGemini($)])} />
      </Box>
    )
  })
}
