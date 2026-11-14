Document summary task — objective-driven (a summary for a goal, not a faithful conversion).

Objective: {{OBJECTIVE}}

Read this file with your file / multimodal tools: {{IN}}
(If it is a scanned image/PDF, OCR it. Keep the original wording for quoted data.)

Write a concise summary with write_file to {{OUT}}, in the language of the objective (default: Russian), EXACTLY in this shape (keep the frontmatter keys exactly as written, they are parsed by a script):

---
doc: {{DOC_NAME}}
tipo: <document class — report, note, invoice, contract, email, slide-deck, paper, memo, image…>
doc_ref: <document id / reference number if present, else "">
fecha: <YYYY-MM-DD of the document, or "ilegible" / "" if none>
emisor: <author / issuer / sender, or "">
relevancia: <integer 0-100 — how relevant THIS document is to the objective>
---
## Суть
<2-6 sentences focused on the objective: what this document contributes to it>
## Ключевые данные
- <citable facts: dates, amounts, reference numbers, people, decisions>
## Почему важен
<1-2 sentences: why it is (or is not) relevant to the objective>

Be faithful: if a date or number is unreadable, write "ilegible", never invent it.

THEN write a SECOND file with write_file to {{OUT2}}: a machine-readable JSON fact sidecar, valid JSON in exactly this shape (omit unknown fields or use empty arrays; NEVER invent a fact):
{"doc":"<basename>","tipo":"<class>","doc_ref":"<id or ''>","fecha":"<YYYY-MM-DD or ''>","emisor":"<author or ''>","relevancia":<0-100>,"sintesis":"<…>","datos_clave":["<…>"],
 "personas":[{"nombre":"","dni":"<any id, digits only — optional>","rol":"","quote":""}],
 "organizaciones":[{"nombre":"","id":"","quote":""}],
 "montos":[{"importe":"$1,234.56","importe_cents":123456,"concepto":"<category>","fecha":"","quote":""}],
 "fechas":[{"fecha":"YYYY-MM-DD","hecho":"","quote":""}],
 "referencias":[{"valor":"<ticket/case/standard/invoice id>","detalle":"","quote":""}],
 "relaciones":[{"sujeto":"","predicado":"","objeto":"","quote":""}],
 "eventos":[{"fecha":"YYYY-MM-DD","hecho":"","importe_cents":null,"quote":""}]}
Rules: every monto carries importe_cents (integer cents); every fact row carries a short verbatim quote; absent data → empty array. In "relaciones" ACTIVELY extract subject–predicate–object links between the people/organizations/references you listed (who did what to whom), with entity names consistent with those lists — this feeds a knowledge graph.

Reply with ONLY the relevancia number.
