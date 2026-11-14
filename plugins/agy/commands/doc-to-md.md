---
description: Convert a PDF, Word file, scan or image into clean Markdown via Gemini (OCR included)
argument-hint: "<file> [what to keep]"
allowed-tools: Bash, Read
---

Input: $ARGUMENTS

1. First token = the file (make it absolute, check it exists); the rest = focus (default "faithful conversion of all content"). File type from the extension: pdf, docx, image, html, other.
2. Output `./agy-out/converted/<stem>.md` (absolute). Timeout 8m; 15m for PDFs over 20 pages (`python3 -c "import fitz,sys;print(fitz.open(sys.argv[1]).page_count)" "<file>"`).
3. ONE Bash call:
   ```bash
   agy-task --template doc-to-md --tier flash --timeout <t> --in "<abs file>" \
     --var FILE_TYPE=<type> --var FOCUS="<focus>" --out "<output path>"
   ```
4. Report the path, the page/section count and description from the digest, and show the first ~20 lines of the file (Read with a limit). Don't read the rest unless asked.

For a whole FOLDER of documents use `/agy:notebook` instead.
