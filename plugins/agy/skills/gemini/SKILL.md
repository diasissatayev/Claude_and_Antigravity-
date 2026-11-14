---
name: gemini
description: How to hand work to Gemini through the Antigravity CLI (agy) on the person's Google AI Pro plan — media (audio, video, images, YouTube), web research, documents and folders of documents, scraping, site design review, bulk reading and second opinions. Use when such a task comes up and Antigravity is connected per the subscriptions note.
---

# Working with Gemini (agy)

Gemini runs on the person's own Google AI Pro subscription, so work it does spends neither
Claude's limits nor tokens of this conversation — as long as Claude ingests only the short
result. Its quota is modest: route the right work to it, not everything.

## Which tool for which job

| Job | Use |
|---|---|
| Hear audio, watch video, read an image, a YouTube link | `/agy:media` (transcript + digest, a question, or `--scenes`) |
| Find out something on the web, with sources | `/agy:research` (low / medium / high) |
| A decision that must be right | `/agy:deep-research` (plan → angles → red team → report) |
| One PDF / Word / scan → text | `/agy:doc-to-md` |
| A folder of documents → answers for a goal | `/agy:notebook`, then `/agy:notebook-ask` |
| Data from a web page | `/agy:scrape` |
| How a site looks and works (also localhost) | `/agy:design-review`, `/agy:record` |
| Read a lot and summarise, generate bulk text, a second opinion | `/agy:delegate` (`--background` for long ones, then `/agy:jobs`) |
| Quick factual question | `/agy:ask` |
| Code | Codex first (`/codex:rescue`, `/codex:review`); Gemini only as a fallback or second take (`/agy:handoff`, `/agy:review`) |

The same tools are on the Bash PATH: `agy-task --template <name> ...` (templated task with
staged inputs and outputs), `agy-delegate` (free-form task, `--digest` for compact output),
`agy-job` (background), `agy-notebook`, `agy-setup`.

## Rules that keep it cheap and safe

- **Break-even**: small, quick or judgement-heavy work is cheaper to do yourself than to describe, wait for and check.
- **Ingest the digest only** (between `AGY_REPLY_BEGIN` and `AGY_REPLY_END`, or the delegate's stdout). Full outputs stay in files; read slices when a detail matters.
- **Never paste file contents into a task** — pass the file with `--in` (agy-task) or `--dir` (agy-delegate) and let Gemini read it.
- **Verify** anything you will rely on: Gemini's "done" or a confident number is a claim, not a fact.
- **Permissions**: Gemini may write only inside `~/.agy-work`, read web pages and use its browser. Writing into a project needs the person's OK (`agy-setup allow-write <folder>`); `--yolo` (all tools, whole machine) only with explicit consent, in git, on a branch.
- **Exit codes**: 10 quota exhausted, 11 signed out, 12 timeout, 13 agy missing, 15 permission refused. On 10/11/13 stop sending work to Gemini this session and say so; do the task yourself only if it is cheap.

## Measured lessons (from the original yuting0624 skill, docs/original-skill-yuting0624.md)

- **Batch, don't chatter.** Every delegation is a fresh Gemini session that re-reads the material from scratch; two questions about the same files = ONE delegation asking both. Fold only units that genuinely belong together — a muddy mega-prompt costs more than it saves.
- **`--continue` is for resuming after a quota or timeout failure, not a cost lever**: measured, a continued call cost +82% to +277% versus a fresh one.
- **Never trust Gemini's "tests pass".** Measured: to make a check go green it patched installed packages and mock-stubbed missing dependencies. Re-run the gate yourself in a clean state; if you cannot run it, say so instead of marking it passed.
- **A "SUCCESS" run can hide failed steps** (measured: six failed commands inside one successful run). For anything that matters, check the result itself, not the status.
- **Shared rules**: agy reads `AGENTS.md` from the workspace. In a project that has one (or a CLAUDE.md worth mirroring into it), pass `--dir <project root>` so both models follow the same rules.
- **Keep the executor a different model family.** agy also offers Claude and GPT models — don't route Claude-the-conductor's work to Claude-in-agy: that loses the cross-model check and spends a separate quota.
- **Give `--digest` a real task.** With nothing to inspect (a bare "reply OK"), Gemini Flash High tends to run a command to find something to report and gets refused (exit 15).
- **Don't keep Claude's cache "warm" while waiting** on a long delegation with busy turns: measured, that costs more than letting it expire.
- `--sandbox` is not containment (with `--yolo` it still wrote outside the folder and reached the network). Contain with narrow `permissions.allow` rules, a git branch and `git status`.
