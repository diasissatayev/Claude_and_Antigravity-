---
description: UX / visual audit of a site via Gemini's browser — desktop + mobile screenshots, 10 dimensions, top fixes and a score (great for checking what you vibecoded)
argument-hint: "<url> [focus]"
allowed-tools: Bash, Read
---

Input: $ARGUMENTS — first token = URL (a local dev server like http://localhost:3000 works too), the rest = focus (default "default 10-dimension review").

1. Folder `./agy-out/design-reviews/<YYYY-MM-DD>-<host-slug>/` (absolute).
2. ONE Bash call (timeout 12m; Bash tool timeout 14 min):
   ```bash
   agy-task --web --template design-review --tier pro --timeout 12m \
     --var URL="<url>" --var FOCUS="<focus>" \
     --out "<dir>/review.md"
   ```
   Then copy the screenshot files the review lists into `<dir>` (skip any that do not exist).
3. Report the score and the 3 improvements from the digest, plus the paths. Look at the screenshots yourself (Read the .png) only if the person asks you to fix the design.
4. If the person wants the fixes made in their project: hand the code changes to Codex (`/codex:rescue`) when it is connected and has quota, otherwise make them yourself.
