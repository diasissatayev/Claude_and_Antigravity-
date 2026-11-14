---
description: Background Gemini jobs — list them, show one's status or result, or cancel it
argument-hint: "[<job id>] [--result|--cancel]"
allowed-tools: Bash
---

Input: $ARGUMENTS

- No id → `agy-job list`: show running and recent jobs (id, state, task).
- `<id>` → `agy-job status <id>`; when it is done, also `agy-job result <id>` and relay the result (it is Gemini's digest — verify before relying on it, as with any delegation).
- `<id> --result` → `agy-job result <id>`.
- `<id> --cancel` → `agy-job cancel <id>` and confirm it stopped.

A job's result says `rc=10` when the Gemini quota ran out (resume later with the same task), `rc=11` when agy is signed out.
