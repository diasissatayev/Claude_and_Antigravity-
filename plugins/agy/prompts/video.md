Video analysis task — a VISUAL breakdown, not just a transcript.

Source ({{KIND}}): {{SOURCE}}
Focus: {{FOCUS}}

WATCH the whole video. Describe what is SHOWN, with timestamps. Write with write_file to {{OUT}} exactly this Markdown:

## Summary
3-6 sentences: what the video is, what happens, the takeaway.
## Scenes
| Span | What is shown | On-screen text / OCR | Audio (summary) |
|------|---------------|----------------------|-----------------|
| mm:ss–mm:ss | ... | ... ("" if none) | ... |
(one row per coherent segment, covering the whole duration in order)
## On-screen text
All legible on-screen text (slides, captions, code, UI, figures), verbatim, grouped by timestamp; "illegible" where unreadable.
## Key moments
- mm:ss — a notable visual event

Be faithful to what is visible; do not invent text or events. Write in the language of the focus (default: Russian), but keep on-screen text verbatim.
Then reply with ONLY the Summary section and the Key moments list.
