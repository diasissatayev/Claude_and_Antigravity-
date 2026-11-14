---
description: Show the Gemini models your Antigravity plan offers and set which ones the flash / pro tiers use
argument-hint: "[list] | [tier <flash|flash-lo|pro> <exact model name>] | [default <flash|flash-lo|pro>]"
allowed-tools: Bash, Read, Edit
---

Input: $ARGUMENTS

- **No input or `list`** → `timeout 60 agy models < /dev/null` and show the list, then the current mapping: the plugin options `default_tier`, `tier_flash`, `tier_flash_lo`, `tier_pro` under `pluginConfigs["agy@<marketplace>"].options` in `~/.claude/settings.json` (empty = the built-in defaults of agy-delegate: Gemini Flash High for flash, Flash Low for flash-lo, the strongest Pro model for pro).
- **`tier <name> <model>`** → the model must appear in `agy models` exactly. Set `tier_<name>` (flash-lo → `tier_flash_lo`) in that options object (Edit the JSON; keep every other key).
- **`default <tier>`** → set `default_tier`.

Explain in one line what changes: pro = better reasoning and media timestamps but spends the quota faster; flash = the everyday workhorse; flash-lo = cheapest for trivial bulk work.
