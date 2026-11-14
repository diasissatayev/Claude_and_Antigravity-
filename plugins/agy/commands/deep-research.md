---
description: Deep multi-round research — Claude plans and judges, Gemini browses each angle and red-teams the claims
argument-hint: "<question>"
allowed-tools: Bash, Read, Write, AskUserQuestion
---

For decisions that depend on getting it right (tool / vendor / architecture choices, market scans).
Claude orchestrates and verifies; Gemini does all the web legwork. Question: $ARGUMENTS

Working dir: `./agy-out/research/<YYYY-MM-DD>-<slug>/` (absolute); raw files go in its `raw/`.

1. **Plan (no Gemini yet).** Break the question into 3-5 angles (distinct search directions) and what evidence would settle each. Show the plan in 5-8 lines and ask the person to approve or adjust it (AskUserQuestion: "Запускать" / "Поправить"). Skip asking only if they already said "без вопросов".
2. **Round 1 — one Gemini call per angle**, run in parallel as background Bash calls (each `--timeout 8m`):
   ```bash
   agy-task --web --template research-angle --tier pro --timeout 8m \
     --var QUESTION="<question>" --var QUERY="<angle>" --var ROUND=1 --out "<dir>/raw/r1-<angle-slug>.md"
   ```
   Read only the digests (AGY_REPLY blocks). Note contradictions and gaps.
3. **Round 2 (only if needed, max 2 extra angles)**: target the biggest gap or contradiction the same way (ROUND=2).
4. **Red team**: pick the 2-3 claims the recommendation will rest on; for each:
   ```bash
   agy-task --web --template research-redteam --tier pro --timeout 6m \
     --var QUESTION="<question>" --var CLAIM="<claim>" --out "<dir>/raw/redteam-<n>.json"
   ```
   Downgrade or drop claims that come back `weakened` / `refuted`.
5. **Synthesis (Claude writes it)**: `<dir>/REPORT.md` with: the answer, findings with [N] citations taken from the raw files (read only the sections you cite), what the red team changed, evidence gaps, a concrete recommendation with confidence. Then run `agy-cite-check <dir>/REPORT.md` and surface warnings.
6. Reply with the recommendation, confidence and the report path.

Keep Claude's reading lean: digests and the specific sections you cite, never whole raw files.
