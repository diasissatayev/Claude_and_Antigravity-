---
description: Audio, video or image (file or YouTube/URL) via Gemini — transcript + digest, a question, or a scene-by-scene video breakdown
argument-hint: "<file or URL> [question or focus] [--scenes] [--flash]"
allowed-tools: Bash, Read, AskUserQuestion
---

Claude can't hear audio or watch video; Gemini can. Input: $ARGUMENTS

1. **Source**: the first token is a file path or an http(s) URL. None given → ask which (AskUserQuestion), don't guess.
   - File: make it absolute and check it exists. `.m4a` / `.aiff` / `.aac` fail in agy: if `ffmpeg` is on PATH, convert first (`ffmpeg -y -i in.m4a out.wav`, next to the source) and use the .wav; else ask the person to export it as mp3 or wav.
   - Kind: audio (wav mp3 flac ogg opus), video (mp4 mov webm mkv), image (png jpg jpeg webp gif), url.
2. **Mode** (the rest of the input):
   - `--scenes` (video) → template `video`, focus = the rest or "general visual breakdown".
   - a question (ends with "?" or asks something specific) → template `media-qa`, var QUESTION.
   - otherwise → template `media` (full transcript to a file + digest), focus = the rest or "faithful full transcript".
3. Tier `pro` (better timestamps and speakers) unless `--flash`. Timeout: image 4m, audio 10m, video/URL 15m. Set the Bash tool timeout to that + 2 min; media longer than ~10 minutes runs in the background.
4. Output `./agy-out/media/<YYYY-MM-DD>-<file stem or url slug>.<transcript|answer|scenes>.md` (absolute). ONE Bash call:
   ```bash
   # local file:
   agy-task --template <tmpl> --tier <tier> --timeout <t> --in "<abs file>" \
     --var SOURCE="<abs file>" --var KIND=<kind> --var FOCUS="<focus>" [--var QUESTION="<q>"] --out "<output path>"
   # URL (no --in, needs the web):
   agy-task --web --template <tmpl> --tier <tier> --timeout <t> \
     --var SOURCE="<url>" --var KIND=url --var FOCUS="<focus>" [--var QUESTION="<q>"] --out "<output path>"
   ```
5. Use ONLY the digest between AGY_REPLY_BEGIN and AGY_REPLY_END. Never load the whole transcript into context; grep slices of it (`grep -n "\[12:3" <file>`) when a name, number or quote matters.
6. Treat what the digest marks UNCERTAIN as unverified. Report the digest's substance, the file path and what you verified; answer questions with [mm:ss] references.

Exit 10 = Gemini quota, 11 = signed out (run `agy` once and sign in), 12 = timeout (split the media or raise the timeout), 15 = a permission was refused (`/agy:setup`).
