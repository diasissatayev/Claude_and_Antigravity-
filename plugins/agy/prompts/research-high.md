Exhaustive web research on: {{TOPIC}}

Rules:
- 15+ sources, aggressively triangulated. Prefer primary sources (papers, official docs, repos, RFCs); avoid SEO content.
- Include counterarguments and dissenting positions. Identify evidence gaps explicitly.
- Cite with [N] notation mapped to References. Mark weak claims [WEAK EVIDENCE], unconfirmed specifics [UNVERIFIED].
- Never infer a date/version/price; flag sources from before the current year. Every numbered identifier (arXiv id, DOI, version) must come from the page you cite for that claim; two [N] entries never share a URL unless they are the same source.
- Write in the language of the topic (default: Russian).

Write the report with write_file to {{OUT}} in this Markdown shape:

## TL;DR
3 bullets.
## Context
Why this matters now.
## Findings
### Finding 1: <title>
Detail with citations [1][2] and concrete data.
## Comparisons
Table of the relevant options/positions/tools.
## Risks and counterarguments
## Evidence gaps
## Conclusion
Actionable recommendation + confidence (high/medium/low).
## References
1. [Title](URL) — author/org, date, type

Then reply with ONLY the TL;DR and the conclusion.
