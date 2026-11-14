#!/usr/bin/env node
// agy status line: agy runs this on every agent-state change and pipes its session state
// as JSON to stdin (https://antigravity.google/docs/cli/statusline). We keep the quota,
// account and tier in ~/.agy-work/status.json, where the "limits" mod reads them with no
// model call at all, and print a one-line status for agy's own screen.
//
// Installed into ~/.gemini/antigravity-cli/settings.json by /agy:setup:
//   "statusLine": { "type": "command", "command": "node \"<this file>\"" }
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const work = process.env.AGY_WORK || join(homedir(), '.agy-work')
let raw = ''
try {
  raw = readFileSync(0, 'utf8')
} catch {}
let s = {}
try {
  s = JSON.parse(raw || '{}')
} catch {}

const quota = s.quota && typeof s.quota === 'object' ? s.quota : null
if (quota || s.email) {
  const out = {
    updatedAt: Date.now(),
    email: s.email ?? null,
    planTier: s.plan_tier ?? null,
    model: s.model?.display_name ?? s.model?.id ?? null,
    version: s.version ?? null,
    agentState: s.agent_state ?? null,
    quota: quota ?? {},
  }
  try {
    mkdirSync(work, { recursive: true })
    const tmp = join(work, `status.json.${process.pid}.tmp`)
    writeFileSync(tmp, JSON.stringify(out, null, 1))
    renameSync(tmp, join(work, 'status.json'))
  } catch {}
}

// agy's own line: model · lowest remaining quota
const left = quota
  ? Object.values(quota)
      .map(q => (typeof q?.remaining_fraction === 'number' ? q.remaining_fraction : null))
      .filter(v => v !== null)
  : []
const parts = []
if (s.model?.display_name) parts.push(s.model.display_name)
if (left.length) parts.push(`quota ${Math.round(Math.min(...left) * 100)}% left`)
process.stdout.write(parts.join(' · '))
