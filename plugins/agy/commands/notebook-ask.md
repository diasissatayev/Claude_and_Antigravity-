---
description: Ask about a folder you already ran /agy:notebook on — exact numbers from its database, open questions answered by Gemini with citations
argument-hint: "<folder> | <question>"
allowed-tools: Bash, Read
---

Input: $ARGUMENTS — split on `|`: folder and question. The notebook is `<folder>/_notebook` (absolute). No `notebook.db` or summaries there → say to run `/agy:notebook <folder> | <goal>` first.

Pick the route:
- **Exact or aggregate** (how many, totals, list of all, who is mentioned, timeline, lookups by name / id / date) → query the SQLite knowledge base yourself, read-only. First the schema:
  ```bash
  python3 -c "import sqlite3,sys; con=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True); [print(t,[c[1] for c in con.execute(f'pragma table_info({t})')]) for (t,) in con.execute(\"select name from sqlite_master where type in ('table','view')\")]" "<folder>/_notebook/notebook.db"
  ```
  then the SELECT you need (amounts are integer cents). Cite the document (`basename`) of every row you use.
- **Open question** (why, what it means, summarise X) → Gemini answers from the per-document summaries:
  ```bash
  agy-task --template notebook-ask --tier pro --timeout 5m --in-dir "<folder>/_notebook" \
    --var SUMMARIES_DIR="<folder>/_notebook" --var QUESTION="<question>" \
    --out "<folder>/_notebook/answers/<YYYY-MM-DD>-<slug>.md"
  ```
  Relay the answer from AGY_REPLY with its citations.

Never open the original documents unless the person asks to verify one specific citation.
