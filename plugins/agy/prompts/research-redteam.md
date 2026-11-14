Red-team task: try to REFUTE this claim using the web.

Overall question: {{QUESTION}}
Claim under attack: {{CLAIM}}

Look for counter-evidence, newer data, failed replications, conflicts of interest, and whether the cited sources really say this. Default to skepticism.

Write JSON with write_file to {{OUT}}, exactly:
{"claim": "...", "refuted": true|false, "refutingEvidence": "...", "refutingSource": "URL or empty", "recencyOk": true|false, "verdict": "holds|weakened|refuted", "newConfidence": "high|medium|low"}

Then reply with ONLY the verdict word and one sentence why.
