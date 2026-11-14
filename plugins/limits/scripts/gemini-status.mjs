#!/usr/bin/env node
// Gemini (Antigravity CLI) connection and plan, with NO model call: agy's own ACP server answers
// `initialize` + `session/new` locally, and session/new carries the account tier
// (_meta.antigravity.tier, e.g. "Google AI Pro"). Then sums ~/.agy-work/usage.log (written by the
// agy plugin on every run) over the last 5 hours and 7 days. Prints one JSON line:
//   {"status":"ok","plan":"Google AI Pro","runs5h":3,"tokens5h":41000,"runsWeek":9,"tokensWeek":130000}
//   {"status":"missing"} | {"status":"signed-out"} | {"status":"error","note":"..."}
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const work = process.env.AGY_WORK || join(homedir(), '.agy-work')
const exe = process.platform === 'win32' ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'agy', 'bin', 'agy.exe') : 'agy'

function usage() {
  const now = Date.now() / 1000
  const r = { runs5h: 0, tokens5h: 0, runsWeek: 0, tokensWeek: 0, lastRunAt: null }
  let text = ''
  try {
    text = readFileSync(join(work, 'usage.log'), 'utf8')
  } catch {
    return r
  }
  for (const line of text.split('\n')) {
    const m = /^(\d{9,})\s+AGY_USAGE\s+(\{.*\})\s*$/.exec(line)
    if (!m) continue
    const at = Number(m[1])
    let total = 0
    try {
      const j = JSON.parse(m[2])
      total = Number(j.usage?.total ?? 0)
    } catch {}
    if (now - at <= 7 * 86400) {
      r.runsWeek++
      r.tokensWeek += total
    }
    if (now - at <= 5 * 3600) {
      r.runs5h++
      r.tokens5h += total
    }
    r.lastRunAt = Math.max(r.lastRunAt ?? 0, at * 1000)
  }
  return r
}

const out = o => {
  process.stdout.write(JSON.stringify({ ...o, ...usage() }) + '\n')
  process.exit(0)
}

if (process.platform === 'win32' && !existsSync(exe)) out({ status: 'missing' })

let child
try {
  child = spawn(exe, ['acp'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, cwd: tmpdir() })
} catch {
  out({ status: 'missing' })
}
const done = o => {
  try {
    child.kill()
  } catch {}
  out(o)
}
child.on('error', () => done({ status: 'missing' }))
let buf = ''
const send = m => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n')
child.stdout.on('data', d => {
  buf += d
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i)
    buf = buf.slice(i + 1)
    let m
    try {
      m = JSON.parse(line)
    } catch {
      continue
    }
    if (m.id === 1) send({ id: 2, method: 'session/new', params: { cwd: tmpdir(), mcpServers: [] } })
    else if (m.id === 2) {
      if (m.error) {
        const msg = String(m.error.message || m.error.data || '')
        done(/auth|log ?in|sign|credential|token/i.test(msg) ? { status: 'signed-out' } : { status: 'error', note: msg.slice(0, 200) })
      }
      const tier = m.result?._meta?.antigravity?.tier
      done({ status: 'ok', plan: tier?.name ?? null, tierId: tier?.id ?? null })
    }
  }
})
send({ id: 1, method: 'initialize', params: { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } } } })
setTimeout(() => done({ status: 'error', note: 'timeout' }), 30000)
