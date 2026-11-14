---
description: Pull structured data from a web page into a table or JSON via Gemini (prices, lists, contacts, specs)
argument-hint: "<url> [what to extract] [--json]"
allowed-tools: Bash, Read
---

Input: $ARGUMENTS

1. First token = URL. The rest = what to extract (default "infer reasonable fields from the page"). Format: `json` with `--json`, else `markdown table`.
2. Output `./agy-out/scrapes/<YYYY-MM-DD>-<host-slug>.<md|json>` (absolute). Timeout 5m (10m for heavy JavaScript sites or many fields).
3. ONE Bash call:
   ```bash
   agy-task --web --template scrape --tier flash --timeout <t> \
     --var URL="<url>" --var SCHEMA="<what>" --var FORMAT="<markdown table|JSON object/array>" --out "<output path>"
   ```
4. Report the record count and blockers from the digest, the path, and a short preview (first ~15 lines).

Respect the site: one page per call, no logins, no bypassing paywalls or captchas — if Gemini reports one, stop and say so.
