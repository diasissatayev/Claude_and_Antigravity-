---
description: Web research with sources via Gemini — low / medium / high depth, saved as a report
argument-hint: "<topic> [--low|--medium|--high]"
allowed-tools: Bash, Read
---

Gemini does the searching and reading on the web; Claude only reads the short result.
Input: $ARGUMENTS

1. Depth: `--low` (3-5 sources, ~3 min), `--medium` (default, 8-12 sources), `--high` (15+ sources, up to 20 min). Strip the flag; the rest is the topic.
2. Output path: `./agy-out/research/<YYYY-MM-DD>-<slug-of-topic>.md` (absolute).
3. ONE Bash call (timeout: low 4m, medium 9m, high 20m — set the Bash tool timeout to that plus 2 minutes; for high run it in the background):
   ```bash
   agy-task --web --template research-<depth> --tier <flash for low, pro otherwise> --timeout <same> \
     --var TOPIC="<topic>" --out "<output path>"
   ```
4. Citation check (zero network): `agy-cite-check "<output path>"`. If it prints warnings, prepend a short "⚠ Проверь эти ссылки" block with them to the report (Edit) — never fix citations yourself.
5. Report: the digest Gemini printed between AGY_REPLY_BEGIN/END, the file path, and any citation warnings. Do not read the whole report unless asked.

If the file is MISSING: show the AGY_SIGNAL line. Exit 10 = quota, 11 = signed out, 15 = a permission was refused (run `/agy:setup`).
For a decision that really matters, suggest `/agy:deep-research` instead.
