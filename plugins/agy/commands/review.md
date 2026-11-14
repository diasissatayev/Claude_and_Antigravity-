---
description: Independent second-opinion code review of the current git changes by Gemini (the main review is Codex's /codex:review)
argument-hint: "[--base <branch>] [focus]"
allowed-tools: Bash, Read
---

A cross-model second opinion. The primary reviewer is Codex (`/codex:review`) when connected; use this for a second take, or when Codex is out of quota. Input: $ARGUMENTS

1. Must be a git repository with changes. Diff: `git diff <base>...HEAD` with `--base`, else `git diff HEAD` (staged + unstaged). Empty → say there is nothing to review.
2. ONE Bash call — Gemini reads the diff from stdin, Claude never loads it:
   ```bash
   { printf '%s\n\n' "Review this diff as a strict senior reviewer. Focus: <focus or general correctness, security, edge cases>. Report only real problems: file:line, why it is wrong, a concrete fix. Rank by severity. No praise, no style nits unless they hide a bug. Answer in Russian."; git diff HEAD; } | agy-delegate --tier pro --timeout 8m --dir . -
   ```
3. **Reconcile as the final judge**: for each finding, open only that spot and decide if it is real. Report the confirmed ones (and which you rejected and why) — don't relay Gemini's list verbatim.
