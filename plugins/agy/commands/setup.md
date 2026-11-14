---
description: Check and configure Antigravity for this plugin — install, sign-in, quota tracking, safe permissions, optional tools
argument-hint: "[--allow-write <folder> | --revoke-write <folder>]"
allowed-tools: Bash, AskUserQuestion
---

Input: $ARGUMENTS

- `--allow-write <folder>` → confirm with the person, then `agy-setup allow-write "<abs folder>"`: Gemini may then write in that project without the all-tools `--yolo`. `--revoke-write <folder>` removes it.

Otherwise run, in order, and present one short table (✅ / ⚠ / ❌ with the fix):
1. `agy-setup apply` — status line that records the quota for the limits mod, and the narrow grants (write only in `~/.agy-work`, read web pages, open pages in agy's browser; no shell commands; no paid overage credits).
2. `timeout 30 agy --version < /dev/null` — missing → install: `irm https://antigravity.google/cli/install.ps1 | iex` in PowerShell (the person runs it, or asks you to).
3. `agy-doctor` — sign-in and a live ping (it spends one tiny request). Signed out → the person runs `agy` once in a terminal, picks "Google OAuth" and signs in.
4. `agy-notebook stack` — optional tools: PyMuPDF (PDF text), sqlite-vec (semantic notebook search), ffmpeg (audio conversion, mp4 recordings). Mention what each missing one would unlock; don't install anything unasked.
5. Quota file: `cat ~/.agy-work/status.json` — present after the first agy run; it feeds `/limits`.
