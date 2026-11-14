---
description: Record a browser walkthrough of a site via Gemini — .webm video (+ .mp4 with ffmpeg), screenshots and a step report; handy for demos and bug reports
argument-hint: "<url> [steps to perform]"
allowed-tools: Bash, Read
---

Input: $ARGUMENTS — first token = URL, the rest = steps. No steps → "Open the page, wait for it to load, scroll to the bottom slowly, open the main navigation, visit the first two main sections, return to the start."

1. Folder `./agy-out/recordings/<YYYY-MM-DD>-<host-slug>/` (absolute). Timeout 8m; 15m for more than ~5 actions or logins / forms.
2. ONE Bash call:
   ```bash
   agy-task --web --template record --tier pro --timeout <t> \
     --var URL="<url>" --var STEPS="<steps>" --out "<dir>/report.md"
   ```
3. The first line of the digest is the absolute .webm path. Copy it, and initial_state.png / final_state.png from `~/.gemini/antigravity-cli/browser_recordings/` when present, into the folder. If `ffmpeg` is on PATH convert: `ffmpeg -y -i walkthrough.webm -c:v libx264 -crf 23 -preset fast -an walkthrough.mp4`.
4. Report the video, screenshot and report paths and the summary.

No logins with real passwords: if the steps need one, stop and ask the person to do that part themselves.
