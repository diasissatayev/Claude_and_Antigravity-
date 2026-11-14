Question-answering task over a set of document summaries.

Question: {{QUESTION}}

Read every "*.resumen.md" file in this directory: {{SUMMARIES_DIR}}. Each has frontmatter (doc, tipo, doc_ref, fecha, relevancia) and a short objective-driven summary.

Answer using ONLY what the summaries contain. CITE the source document(s) inline for every claim (by doc_ref or document name). If the summaries are not enough, say so and point to the documents most likely to hold the answer instead of inventing. Lead with a direct answer, then the supporting detail. Answer in the language of the question (default: Russian).

Write the answer with write_file to {{OUT}}, then reply with the same answer.
