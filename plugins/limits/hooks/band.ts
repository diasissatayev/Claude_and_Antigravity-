// The desktop band: one SVG row (the desktop wraps sibling elements, so everything that must
// stay on one line is drawn here). Three groups — Claude, Codex, Gemini — each with its icon,
// its name and a pill per window that fills like a progress bar. Every CYCLE seconds Clawd
// walks over, kicks the Codex and Gemini icons and runs back home. All motion is CSS run by the
// compositor; the cycle is phased off the wall clock so a redraw never restarts it.

import type { Provider, ProviderId } from '../types'

export const BAND_H = 40
const ICON = 22
const PILL_H = 20
const ICON_Y = (BAND_H - ICON) / 2
const PILL_Y = (BAND_H - PILL_H) / 2
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
export const CYCLE = 180 // seconds between kicks
const LOW = 80
const OUT = 95

const BRAND: Record<ProviderId, [string, string]> = {
  claude: ['#E8876A', '#C8613F'],
  codex: ['#A99BFF', '#4B57F5'],
  gemini: ['#4C8DF6', '#9A6BE0'],
}
const NAME: Record<ProviderId, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' }
const KIND_RU: Record<string, string> = { '5h': '5ч', week: 'нед', day: 'день', quota: 'квота', ctx: 'ctx' }

const xml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
const em = (ch: string) => (/[\s.,:;'|!il1()]/.test(ch) ? 0.3 : /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/.test(ch) ? 0.72 : 0.58)
const textW = (s: string, size: number) => [...s].reduce((w, ch) => w + em(ch) * size, 0)
const r1 = (n: number) => Math.round(n * 10) / 10

// --- icons (24-unit boxes, drawn at ICON px) ------------------------------------------

// Pixel Clawd (the crab grid of savvy-progress's DockCrab): 30×28 units, legs in their own groups.
const CLAY = '#D97757'
const INK = '#1F1E1D'
function clawd(): string {
  const px = (x: number, y: number, w: number, h: number, c: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`
  const body = [px(7, 10, 16, 12, CLAY), px(3, 14, 4, 4, CLAY), px(9, 12, 2, 2, INK), px(19, 12, 2, 2, INK)].join('')
  const claw = px(23, 14, 4, 4, CLAY)
  const la = px(7, 22, 2, 4, CLAY) + px(17, 22, 2, 4, CLAY)
  const lb = px(11, 22, 2, 4, CLAY) + px(21, 22, 2, 4, CLAY)
  return `<g shape-rendering="crispEdges"><g class="cbd">${body}<g class="claw">${claw}</g></g><g class="la">${la}</g><g class="lb">${lb}</g></g>`
}

function codexIcon(id: string): string {
  // A scalloped cloud: a centre disc and eight petals, with the >_ prompt in white.
  const petals = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 8
    return `<circle cx="${r1(12 + Math.cos(a) * 5.6)}" cy="${r1(12 + Math.sin(a) * 5.6)}" r="5.2"/>`
  }).join('')
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9A8FF"/><stop offset=".55" stop-color="#7C8BFF"/><stop offset="1" stop-color="#3442F5"/></linearGradient></defs>
<g fill="url(#${id})"><circle cx="12" cy="12" r="7.5"/>${petals}</g>
<path d="M8.3 8.6l3.1 3.4-3.1 3.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.4 15.6h3.6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`
}

function geminiIcon(id: string): string {
  // The four-point spark: blue base, then red / yellow / green glows from its tips, clipped to the shape.
  const star = 'M12 0C12.6 6.4 17.6 11.4 24 12C17.6 12.6 12.6 17.6 12 24C11.4 17.6 6.4 12.6 0 12C6.4 11.4 11.4 6.4 12 0Z'
  const glow = (gid: string, cx: number, cy: number, c: string) =>
    `<radialGradient id="${id}${gid}" cx="${cx / 24}" cy="${cy / 24}" r=".62"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
  return `<defs><clipPath id="${id}c"><path d="${star}"/></clipPath>${glow('r', 12, 0, '#F2463C')}${glow('y', 0, 12, '#F9BC15')}${glow('g', 12, 24, '#1DB15C')}</defs>
<g clip-path="url(#${id}c)"><rect width="24" height="24" fill="#3B82F6"/><rect width="24" height="24" fill="url(#${id}r)"/><rect width="24" height="24" fill="url(#${id}y)"/><rect width="24" height="24" fill="url(#${id}g)"/></g>`
}

// --- pills ---------------------------------------------------------------------------

type Pill = { label: string; pct: number }

function fillColor(id: ProviderId, pct: number, gid: string): string {
  if (pct >= OUT) return '#D9483B'
  if (pct >= LOW) return '#E39A12'
  return `url(#${gid})`
}

function pill(x: number, w: number, p: Pill, id: ProviderId, key: string, u: string): string {
  const pct = Math.max(0, Math.min(100, p.pct))
  const fw = r1((w * pct) / 100)
  const text = `${p.label} ${Math.round(pct)}%`
  const ty = PILL_Y + PILL_H / 2 + 4
  const gid = `g-${id}-${u}`
  // The label is drawn twice: in the text colour over the track, in white over the fill.
  return `<g>
<rect class="trk" x="${x}" y="${PILL_Y}" width="${w}" height="${PILL_H}" rx="6"/>
<clipPath id="cp-${key}"><rect x="${x}" y="${PILL_Y}" width="${fw}" height="${PILL_H}" rx="6"/></clipPath>
<rect x="${x}" y="${PILL_Y}" width="${w}" height="${PILL_H}" rx="6" fill="${fillColor(id, pct, gid)}" clip-path="url(#cp-${key})"/>
<text class="t" x="${x + w / 2}" y="${ty}" text-anchor="middle" font-family="${FONT}" font-size="11.5" font-weight="600">${xml(text)}</text>
<text x="${x + w / 2}" y="${ty}" text-anchor="middle" font-family="${FONT}" font-size="11.5" font-weight="600" fill="#fff" clip-path="url(#cp-${key})">${xml(text)}</text>
</g>`
}

// --- the row ---------------------------------------------------------------------------

export type BandInput = {
  providers: Record<ProviderId, Provider>
  contextPct: number | null
  offText: (p: Provider) => string
  nowMs: number
  width: number
}

type Group = { id: ProviderId; isOff: boolean; pills: Pill[]; off: string }

let drawCount = 0

export function bandSvg(b: BandInput): string {
  // Element ids must be unique per drawing: two SVGs inline in one page share one id space.
  const u = `${(drawCount = (drawCount + 1) % 100000)}x${Math.floor(b.nowMs / 1000) % 100000}`
  const ids: ProviderId[] = ['claude', 'codex', 'gemini']
  const groups: Group[] = ids.map(id => {
    const p = b.providers[id]
    const isOff = id !== 'claude' && p.status !== 'ok'
    const pills: Pill[] = p.windows.map(w => ({ label: KIND_RU[w.kind] ?? w.kind, pct: w.usedPct }))
    if (id === 'claude' && b.contextPct !== null) pills.push({ label: 'ctx', pct: b.contextPct })
    if (!isOff && pills.length === 0 && p.activity) pills.push({ label: `5ч: ${p.activity.runs5h} зад.`, pct: 0 })
    return { id, isOff, pills, off: isOff ? b.offText(p) : '' }
  })

  // Fit: full names and 64 px pills; narrower → shorter pills, then icons without names.
  const W = b.width
  const GAP = 16
  const need = (pillW: number, names: boolean) =>
    groups.reduce((s, g) => s + ICON + 6 + (names ? textW(NAME[g.id], 13) + 8 : 0) + (g.isOff ? textW(g.off, 11.5) + 18 : g.pills.length * (pillW + 4)), 0) + GAP * 2
  let pillW = 66
  let names = true
  while (need(pillW, names) > W && pillW > 50) pillW -= 2
  if (need(pillW, names) > W) names = false

  let x = 0
  const parts: string[] = []
  const iconX: Record<ProviderId, number> = { claude: 0, codex: 0, gemini: 0 }
  groups.forEach((g, gi) => {
    iconX[g.id] = x
    x += ICON + 6
    if (names) {
      parts.push(`<text class="${g.isOff ? 'm' : 't'}" x="${x}" y="${BAND_H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="700">${NAME[g.id]}</text>`)
      x += textW(NAME[g.id], 13) + 8
    }
    if (g.isOff) {
      const w = textW(g.off, 11.5) + 14
      parts.push(`<rect class="off" x="${x}" y="${PILL_Y}" width="${w}" height="${PILL_H}" rx="6"/><text class="m" x="${x + w / 2}" y="${PILL_Y + PILL_H / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11.5">${xml(g.off)}</text>`)
      x += w + 4
    } else {
      g.pills.forEach((p, pi) => {
        const pw = p.label.length > 4 ? Math.max(pillW, textW(`${p.label} 0%`, 11.5) + 12) : pillW
        parts.push(pill(x, pw, p, g.id, `${g.id}${pi}-${u}`, u))
        x += pw + 4
      })
    }
    if (gi < groups.length - 1) x += GAP
  })

  // Icons, each in a group of its own so it can be kicked.
  const cx0 = iconX.claude
  const codexOff = groups[1]?.isOff
  const geminiOff = groups[2]?.isOff
  const icons = `
<g class="ic ${codexOff ? 'dim' : ''}" transform="translate(${iconX.codex},${ICON_Y}) scale(${ICON / 24})"><g class="kick k1${u}">${codexIcon(`cdx-${u}`)}</g></g>
<g class="ic ${geminiOff ? 'dim' : ''}" transform="translate(${iconX.gemini},${ICON_Y}) scale(${ICON / 24})"><g class="kick k2${u}">${geminiIcon(`gem-${u}`)}</g></g>`

  // Clawd's trip, in % of the cycle: walk to Codex, kick, walk to Gemini, kick, run home.
  const C = CYCLE
  const pc = (s: number) => r1(100 - ((C - s) / C) * 100) // s seconds into the trip → % of the cycle
  const tripStart = C - 14 // the trip takes the last 14 s of the cycle
  const at = (s: number) => pc(tripStart + s)
  // The walker sits inside a scaled group, so its own translations are in crab units.
  const crabScale = ICON / 26
  const dCodex = r1((iconX.codex - cx0 - ICON + 6) / crabScale)
  const dGemini = r1((iconX.gemini - cx0 - ICON + 6) / crabScale)
  const walk = `@keyframes trip${u}{0%,${at(0)}%{transform:translateX(0)}
${at(4)}%{transform:translateX(${dCodex}px)}${at(4.6)}%{transform:translateX(${dCodex}px)}
${at(8.6)}%{transform:translateX(${dGemini}px)}${at(9.2)}%{transform:translateX(${dGemini}px) scaleX(1)}
${at(9.3)}%{transform:translateX(${dGemini}px) scaleX(-1)}${at(13.8)}%{transform:translateX(0) scaleX(-1)}${at(13.9)}%,100%{transform:translateX(0) scaleX(1)}}`
  // Legs step and the claw swings only on the road; at home the crab breathes.
  const steps: string[] = []
  for (let s = 0; s < 13.8; s += 0.25) {
    if ((s > 4 && s < 4.6) || (s > 8.6 && s < 9.3)) continue
    steps.push(`${at(s)}%{transform:translateY(-1px)}${at(s + 0.125)}%{transform:translateY(0)}`)
  }
  const legs = `@keyframes legs${u}{0%{transform:translateY(0)}${steps.join('')}100%{transform:translateY(0)}}`
  const kick = (name: string, s: number) =>
    `@keyframes ${name}${u}{0%,${at(s)}%{transform:translate(0,0) rotate(0)}${at(s + 0.15)}%{transform:translate(3px,-7px) rotate(25deg)}${at(s + 0.45)}%{transform:translate(1px,0) rotate(-8deg)}${at(s + 0.65)}%{transform:translate(0,-2px) rotate(4deg)}${at(s + 0.85)}%,100%{transform:translate(0,0) rotate(0)}}`
  // The front claw winds up just before each kick.
  const swingAt = (s: number) => `${at(s - 0.35)}%{transform:rotate(0)}${at(s - 0.1)}%{transform:rotate(35deg)}${at(s + 0.05)}%{transform:rotate(-50deg)}${at(s + 0.4)}%{transform:rotate(0)}`
  const clawSwing = `@keyframes swing${u}{0%{transform:rotate(0)}${codexOff ? '' : swingAt(4.15)}${geminiOff ? '' : swingAt(8.75)}100%{transform:rotate(0)}}`
  const delay = -((b.nowMs / 1000) % C)

  const css = `<style>
.t{fill:#1f1f1f}.m{fill:#8a8a86}.trk{fill:#e7e6e2}.off{fill:none;stroke:#cfcdc8;stroke-dasharray:3 3}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.m{fill:#8f8f8b}.trk{fill:#2e2e2c}.off{stroke:#4a4a47}}
.dim{opacity:.35;filter:grayscale(1)}
.kick,.lmw${u},.lmw${u} .la,.lmw${u} .lb,.lmw${u} .claw,.lmw${u} .cbd{transform-box:fill-box}
.kick{transform-origin:50% 100%}
.lmw${u}{filter:drop-shadow(0 0 1.2px rgba(0,0,0,.55));transform-origin:50% 50%;animation:trip${u} ${C}s linear infinite ${delay}s}
.lmw${u} .la{animation:legs${u} ${C}s linear infinite ${delay}s}
.lmw${u} .lb{animation:legs${u} ${C}s linear infinite ${delay - 0.125}s}
.lmw${u} .cbd{animation:breathe${u} 3s ease-in-out infinite}
.lmw${u} .claw{transform-origin:0 50%;animation:swing${u} ${C}s linear infinite ${delay}s}
.k1${u}{animation:kick1${u} ${C}s linear infinite ${delay}s}.k2${u}{animation:kick2${u} ${C}s linear infinite ${delay}s}
@keyframes breathe${u}{50%{transform:translateY(-.6px)}}
${walk}
${legs}
${codexOff ? '' : kick('kick1', 4.15)}
${geminiOff ? '' : kick('kick2', 8.75)}
${clawSwing}
@media (prefers-reduced-motion: reduce){.lmw${u},.lmw${u} *,.kick{animation:none!important}}
</style>`

  const walker = `<g transform="translate(${cx0},${ICON_Y - 1}) scale(${crabScale})"><g class="lmw${u}">${clawd()}</g></g>`
  const grads = ids
    .map(id => `<linearGradient id="g-${id}-${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${BRAND[id][0]}"/><stop offset="1" stop-color="${BRAND[id][1]}"/></linearGradient>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BAND_H}" viewBox="0 0 ${W} ${BAND_H}">${css}<defs>${grads}</defs>${parts.join('')}${icons}${walker}</svg>`
}
