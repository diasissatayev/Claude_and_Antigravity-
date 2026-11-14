export type ProviderId = 'claude' | 'codex' | 'gemini'

/** ok = connected with a reading · missing = not installed · signed-out · unknown = no reading yet · error */
export type ProviderStatus = 'ok' | 'missing' | 'signed-out' | 'unknown' | 'error'

export type Window = {
  /** '5h', 'week', or a bucket name the provider uses */
  kind: string
  /** 0-100 */
  usedPct: number
  /** ms since epoch; null when the provider gave none */
  resetsAt: number | null
}

export type Provider = {
  status: ProviderStatus
  plan: string | null
  windows: Window[]
  /** ms since epoch of the reading */
  updatedAt: number
  note: string | null
  /** Gemini only: plugin runs and tokens in the last 5 hours / 7 days (from ~/.agy-work/usage.log). */
  activity?: { runs5h: number; tokens5h: number; runsWeek: number; tokensWeek: number }
}

export type Snapshot = Record<ProviderId, Provider>

export type Prefs = {
  isBandHidden: boolean
}

declare module 'claude-code' {
  interface PluginState {
    limits: {
      snapshot: Shaped<Snapshot>
      /** What Claude was last told, one line per provider; a change sends a short note. */
      told: string
      prefs: Prefs
      /** Bumped every minute so the pane's "resets in" times move. */
      tick: number
      /** Claude's context window fill, 0-100, from the engine's measurements. */
      ctx: number | null
      /** True while a /compact started from the band runs. */
      compacting: boolean
    }
  }
}
