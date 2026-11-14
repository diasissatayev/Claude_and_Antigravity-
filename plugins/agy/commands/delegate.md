---
description: Hand a well-scoped subtask to Gemini (bulk reading, analysis, generation, a second opinion) and verify the result; --background for long ones
argument-hint: "[--pro] [--background] [--write] <task>"
allowed-tools: Bash, Read, AskUserQuestion
---

Task: $ARGUMENTS

1. **Is it worth it?** Delegate only when the offloaded volume clearly exceeds the round-trip (writing the task, waiting, checking). Tiny tasks: just do them. Coding work goes to Codex first when it is connected and has quota (`/codex:rescue`); use Gemini for code when Codex is out or for a cheap second take.
2. **Tier**: `pro` with `--pro` (hard reasoning), else `flash`. Strip the flags.
3. **Workspace**: if the task needs the person's project, add `--dir <project root>` so Gemini reads the real files itself — never paste file contents into the task.
4. **Writing files**: by default Gemini may write only inside `~/.agy-work`. If the task must change files in the project (`--write`, or it clearly asks to create/edit files there):
   - Prefer a one-time narrow grant: `agy-setup allow-write "<project root>"` (adds `write_file(<root>)` to agy's settings). Ask the person first (AskUserQuestion), naming the folder.
   - `--yolo` approves ALL Gemini tools on the whole machine (terminal included). Use it only if the person explicitly agrees, in a git project, on a branch, and check `git status` afterwards.
5. Run ONE Bash call; for analysis/reading tasks add `--digest` (compact bullets instead of a raw dump):
   ```bash
   agy-delegate --tier <tier> [--dir "<root>"] [--digest] - <<'TASK'
   <the task, written as observable outcomes>
   TASK
   ```
   Long task (more than ~2 minutes) or `--background`: `agy-job start --tier <tier> [--dir ...] "<task>"` → prints a job id; tell the person and continue; collect later with `/agy:jobs <id>`.
6. Ingest only the digest. Never re-read files Gemini already processed. If stderr says the output "looks like a raw dump", don't ingest it — re-run with `--digest`.
7. **Verify** before relying on it: run it, open the specific spot, or test it. Never trust a self-reported "done". Say what you delegated and how you checked it.

Exit codes: 10 quota, 11 signed out, 12 timeout (raise `--timeout`, or `--continue` resumes), 13 agy missing, 15 permission refused (see step 4).
