Document conversion task.

Source file: {{IN}}
File type: {{FILE_TYPE}}
Focus / what to keep: {{FOCUS}}

1. Read the source with your file / multimodal tools (OCR scans and images).
2. Convert it to clean Markdown, preserving the heading hierarchy, tables (Markdown table syntax), lists, code blocks and emphasis.
3. For images inside the document insert ![<description from visual context>](source-image-N) placeholders, N sequential.
4. Do NOT translate — keep the original language. Write "illegible" instead of guessing unreadable text.
5. Start with a short YAML frontmatter: source, file type, conversion date.

Write the Markdown with write_file to {{OUT}}.
Then reply with ONLY: the number of pages/sections and a 2-3 sentence description of the document.
