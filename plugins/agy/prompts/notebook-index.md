Synthesis task over a set of document summaries.

Objective: {{OBJECTIVE}}

Read every "*.resumen.md" file in this directory: {{SUMMARIES_DIR}}
Each has frontmatter (doc, tipo, doc_ref, fecha, relevancia) and a short summary. Write in the language of the objective (default: Russian).

Write FOUR files with write_file:

1. {{OUT}} — INDEX: a Markdown table of ALL documents sorted by relevancia, descending:
   | Документ | Тип | Дата | Релевантность | Почему (1 строка) |
   Start with "## Самые важные для цели" (the top documents), then "## Все документы" (the full table). Mark documents whose frontmatter says estado: no_procesado.

2. {{OUT2}} — MASTER SUMMARY oriented to the objective:
   - "## Ответ на цель": answer the objective directly from the evidence.
   - "## Картина целиком": the narrative, CITING documents inline by doc_ref or name.
   - "## Хронология": bullet timeline of key dated milestones.
   - "## Вывод": 2-4 sentences.
   Ground every claim in the summaries; where evidence is insufficient, say so. Never invent.

3. {{OUT3}} — TIMELINE: one chronological table | Дата (YYYY-MM-DD) | Событие | Документ |, ascending, undated items skipped.

4. {{OUT4}} — ENTITIES: "## Люди", "## Организации", "## Суммы", "## Ссылки и номера", each entity with the document(s) it appears in. Only entities present in the summaries.

Reply with ONLY the "Ответ на цель" section.
