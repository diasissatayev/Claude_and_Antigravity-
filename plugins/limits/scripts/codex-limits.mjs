#!/usr/bin/env node
// Reads the Codex (ChatGPT plan) rate-limit windows without any model call: the Codex CLI's own
// app-server answers `account/rateLimits/read` from OpenAI's usage accounting. Prints one JSON line:
//   {"status":"ok","plan":"plus","windows":[{"kind":"5h","usedPct":3,"resetsAt":<ms>}, ...]}
//   {"status":"missing"}      Codex CLI not installed
//   {"status":"signed-out"}   installed, not logged in
//   {"status":"error","note":"..."}
import { spawn } from 'node:child_process'

const out = o => {
  process.stdout.write(JSON.stringify(o) + '\n')
  process.exit(0)
}
const kindOf = mins => (mins === 300 ? '5h' : mins === 10080 ? 'week' : `${Math.round(mins / 60)}h`)

let child
try {
  child = spawn('codex', ['app-server'], { shell: process.platform === 'win32', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
} catch (e) {
  out({ status: 'missing' })
}
let buf = ''
let err = ''
const send = m => child.stdin.write(JSON.stringify(m) + '\n')
const done = o => {
  try {
    child.kill()
  } catch {}
  out(o)
}
child.on('error', () => done({ status: 'missing' }))
child.on('exit', code => {
  if (/not recognized|not found|ENOENT/i.test(err)) done({ status: 'missing' })
  done({ status: 'error', note: `codex app-server exited ${code}: ${err.trim().slice(-200)}` })
})
child.stderr.on('data', d => (err += d))
child.stdout.on('data', d => {
  buf += d
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i)
    buf = buf.slice(i + 1)
    if (!line.trim()) continue
    let m
    try {
      m = JSON.parse(line)
    } catch {
      continue
    }
    if (m.id === 1) {
      send({ method: 'initialized' })
      send({ id: 2, method: 'account/read', params: {} })
    } else if (m.id === 2) {
      const acct = m.result?.account ?? null
      if (m.error || !acct) done({ status: 'signed-out' })
      send({ id: 3, method: 'account/rateLimits/read' })
    } else if (m.id === 3) {
      if (m.error) {
        const msg = String(m.error.message || '')
        done(/auth|login|sign/i.test(msg) ? { status: 'signed-out' } : { status: 'error', note: msg.slice(0, 200) })
      }
      const rl = m.result?.rateLimits ?? {}
      const windows = []
      for (const w of [rl.primary, rl.secondary]) {
        if (w && typeof w.usedPercent === 'number') {
          windows.push({ kind: kindOf(w.windowDurationMins), usedPct: Math.round(w.usedPercent * 10) / 10, resetsAt: w.resetsAt ? w.resetsAt * 1000 : null })
        }
      }
      done({ status: 'ok', plan: rl.planType ?? null, reached: rl.rateLimitReachedType ?? null, windows })
    }
  }
})
send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'limits-mod', version: '1.0.0' } } })
setTimeout(() => done({ status: 'error', note: 'timeout' }), 25000)
