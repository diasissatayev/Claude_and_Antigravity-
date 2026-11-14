import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'limits',
  component: 'Pane',
  requestId: 'limits',
  props: { title: 'Лимиты', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const CODEX_OK = '{"status":"ok","plan":"plus","reached":null,"windows":[{"kind":"5h","usedPct":12,"resetsAt":null},{"kind":"week","usedPct":40,"resetsAt":null}]}\n'
const AGY = JSON.stringify({ updatedAt: 1000, email: 'a@b', planTier: 'pro', quota: { 'gemini-weekly': { remaining_fraction: 0.03, reset_in_seconds: 3600 } } })

function engine(on: any, agy: string | null, codex = CODEX_OK) {
  on('command.register', () => ({ value: { command: 'limits' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [{ kind: 'five_hour', percentUsed: 23 }, { kind: 'seven_day', percentUsed: 41 }] } }))
  on('process.run', (_: unknown, e: { argv: string[] }) => ({ value: { exitCode: 0, stdout: String(e.argv[1]).includes('gemini-status') ? (agy === null ? '{"status":"missing"}' : '{"status":"ok","plan":"Google AI Pro"}') : codex, stderr: '' } }))
  on('env.get', () => ({ value: 'C:\\Users\\x' }))
  on('fs.exists', () => ({ value: agy !== null }))
  on('fs.read', (_: unknown, e: { path: string }) => (agy && String(e.path).includes('status.json') ? { value: agy } : String(e.path).includes('usage.log') ? { value: '1500 AGY_USAGE {"usage":{"total":9811}}\n' } : { deny: 'ENOENT' }))
  on('store.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 2000 }))
  on('clock.every', () => ({ value: {} }))
  on('prompt.context', (_: unknown, e: { blocks: unknown[] }) => ({ blocks: e.blocks }))
}

test('the pane shows all three providers, Gemini near its limit', async ($, on) => {
  engine(on, AGY)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'limits', args: 'refresh' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Codex · plus/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /97%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Claude/ })).toBeDefined()
  await ui.unmount()
})

test('Gemini not installed reads as not available, for the person and for Claude', async ($, on) => {
  engine(on, null)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'limits', args: 'refresh' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /не установлен/ })).toBeDefined()
  await ui.unmount()
  const r = (await ($.prompt.context as (e: unknown) => Promise<{ blocks: { name: string; text: string }[] }>)({ blocks: [] }))
  const block = r.blocks.find(b => b.name === 'subscriptions')
  expect(block?.text).toContain('Gemini')
  expect(block?.text).toContain('NOT AVAILABLE')
  expect(block?.text).toContain('Codex (plus): 5h 12% used, week 40% used')
})

test('desktop: the band is one animated SVG with pills and icons', async ($, on) => {
  engine(on, AGY)
  on('session.measure', (_: unknown, e: unknown) => ({ changed: [] }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'limits', args: 'refresh' } as never)
  const ui = await $.ui.mount({
    plugin: 'limits',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 6, bodyColumns: 120, scroll: { offset: 0, bodyRows: 6 }, view: {} },
  } as never)
  const svg = await ui.find({ type: 'Svg' } as never)
  const source = String((svg as { props?: { source?: string } })?.props?.source ?? '')
  expect(source).toContain('Codex')
  expect(source).toContain('5ч 12%')
  expect(source).toContain('нед 97%')
  expect(source).toContain('@keyframes trip')
  await ui.unmount()
})
