---
description: Quick one-shot question to Gemini (Antigravity) — saves Claude's limits on simple lookups
argument-hint: "<question> [--pro]"
allowed-tools: Bash
---

Ask Gemini directly and relay its answer. Input: $ARGUMENTS

1. Tier: `pro` if the input contains `--pro` (strip it), else `flash`.
2. Run ONE Bash call (quote the question safely; use a heredoc for long text):
   ```bash
   agy-delegate --tier <tier> --timeout 3m - <<'Q'
   <question>
   Answer concisely in the language of the question.
   Q
   ```
3. Relay the answer. Say it came from Gemini. If it states facts you know are shaky, say so briefly.

Exit codes: 10 = Gemini quota exhausted, 11 = signed out (tell the person to run `agy` once and sign in), 13 = agy not installed (`/agy:setup`). On those, answer the question yourself only if it is cheap.
