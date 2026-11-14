Batch document-summary task — objective-driven, ONE summary PER document.

Objective: {{OBJECTIVE}}

You are given several pre-extracted plain-text documents. Summarise EACH one INDEPENDENTLY:
{{MEMBERS}}

For EACH input write its OWN summary file and its OWN JSON fact sidecar, with write_file, to the paths listed next to it. Never merge two documents, never skip one.

Summary file shape (language of the objective, default Russian; keep the frontmatter keys exactly):
---
doc: <document name as listed>
tipo: <document class>
doc_ref: <id / reference number, else "">
fecha: <YYYY-MM-DD, or "ilegible" / "">
emisor: <author / issuer, or "">
relevancia: <integer 0-100 for the objective>
---
## Суть
<2-6 sentences focused on the objective>
## Ключевые данные
- <citable facts>
## Почему важен
<1-2 sentences>

Sidecar: valid JSON with keys doc, tipo, doc_ref, fecha, emisor, relevancia, sintesis, datos_clave, personas[nombre,dni,rol,quote], organizaciones[nombre,id,quote], montos[importe,importe_cents,concepto,fecha,quote], fechas[fecha,hecho,quote], referencias[valor,detalle,quote], relaciones[sujeto,predicado,objeto,quote], eventos[fecha,hecho,importe_cents,quote]. Every fact row has a short verbatim quote, absent data → empty array, NEVER invented; actively fill relaciones when the text links two entities.

If a date or number is unreadable write "ilegible". Reply with ONLY one line per document: <name> <relevancia>.
