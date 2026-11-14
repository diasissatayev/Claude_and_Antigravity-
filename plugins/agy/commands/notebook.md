---
description: Local NotebookLM over a folder of documents (PDF, scans, Word, images, txt) — per-document summaries, an index and a master summary for your goal; Gemini does all the reading
argument-hint: "<folder> | <goal> [--semantic]   or   --status|--audit|--graph <folder>"
allowed-tools: Bash, Read, AskUserQuestion
---

Gemini reads every document; a script runs the whole sweep (no Claude subagents), and Claude reads
only two small files at the end. Input: $ARGUMENTS

**Maintenance modes** (input starts with a flag; the notebook lives in `<folder>/_notebook`):
- `--status <folder>` → `agy-notebook status "<folder>/_notebook"`: progress, done / pending / failed, ETA.
- `--audit <folder>` → `agy-notebook audit "<folder>/_notebook"`: contradictions (conflicting amounts, one person under two names, coverage gaps); summarise the report file it writes.
- `--graph <folder>` → `agy-notebook graph "<folder>/_notebook"`: an interactive graph.html of who and what connect; give the path.

**Build** (`<folder> | <goal>`):
1. Split on the first `|`: folder (make absolute, must exist) and goal. No `|` → the leading token that is an existing folder is the folder, the rest is the goal. No folder → ask once.
2. ONE Bash call, in the background when the folder has more than ~10 documents:
   ```bash
   agy-notebook run "<abs folder>" "<goal>" [--semantic]
   ```
   - Exit 3 with `NEEDS_CONFIRM rows=N` → tell the person N documents will go to Gemini (it spends the Pro quota) and ask; on yes re-run with `--yes`.
   - Exit 10 = the Gemini quota ran out mid-sweep (finished documents are kept, a re-run resumes), 11 = signed out, 4 = no supported documents.
3. When it prints `NOTEBOOK_DONE`, read ONLY `<folder>/_notebook/INDEX.md` and `<folder>/_notebook/SUMMARY.md`, and present: the goal and the counts (docs / ok / failed / cached), the top documents, the answer to the goal, and the paths of TIMELINE.md, ENTITIES.md and the per-document summaries.
4. Offer follow-ups: `/agy:notebook-ask <folder> | <question>`, `/agy:notebook --audit <folder>`, `--graph`.

Do NOT open the original documents or the per-document summaries yourself — that is the whole point.
Re-running the same folder and goal only processes new or changed documents.
