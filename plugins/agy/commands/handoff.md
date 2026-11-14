---
description: Hand a whole, test-covered coding task to Gemini and verify it only by running the tests (a fallback for when Codex is out of quota)
argument-hint: "[--dir <repo>] [--tier flash|pro] [--verify \"<cmd>\"] [--tests a.test.ts,b.test.ts] <requirement>"
allowed-tools: Bash, Read, AskUserQuestion
---

Requirement: $ARGUMENTS

Coding goes to **Codex first** (`/codex:rescue`) when it is connected and has quota. This is the Gemini route for a whole feature, measured by the original author as cheaper than doing it alone only for coherent tasks of roughly 200+ lines that tests define as done; small tasks cost more this way.

1. **Hand off only** a coherent feature or change with tests that define "done" (existing tests that must pass, or tests you write first). Not a small edit, a judgement call, or work without a verification command.
2. **Write the requirement as observable behaviour**, 10–30 lines: context, what must be true afterwards, constraints (language, no new dependencies), which test files must pass unmodified, and "leave changes uncommitted". Don't read the repository to write it; if you need orientation, ask Gemini for a digest first (`agy-delegate --digest --dir . "…"`).
3. **Safety**: this runs Gemini with all tools approved (it must edit files and run the tests). Confirm with the person (AskUserQuestion) and require a git repository with a clean tree on a new branch — create the branch if needed.
4. Run it:
   ```bash
   agy-handoff --dir . --tests <test files> [--verify "<cmd>"] --background - <<'REQ'
   <the requirement>
   REQ
   ```
   It prints a job id; real features take 20–120 minutes. Poll with `/agy:jobs <id>`; don't touch the repository meanwhile. `--verify` is detected from package.json / pyproject.toml / go.mod / Cargo.toml / Makefile when omitted.
5. **Don't read the diff while it runs and don't patch it afterwards.** The wrapper runs the tests, allows one fix-up, and checks the test files were not modified. Read only its report: PASS / FAIL / TEST FILES MODIFIED, the change summary.
6. Report in a few lines and hand the diff over as a first draft (watch for dead code, duplicated helpers, options nobody asked for). If it failed, either one more hand-off with a sharper requirement or take over — don't hand-patch and call it a hand-off.
