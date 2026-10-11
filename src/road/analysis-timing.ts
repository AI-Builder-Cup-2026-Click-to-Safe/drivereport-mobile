/**
 * Demo run stage lengths in ms (Upload, Watch, Law, Judge), matching the reference's
 * boundaries at 2.6 s, 10.6 s, 14.6 s and 19.2 s.
 */
export const DEMO_STAGE_MS = [2600, 8000, 4000, 4600] as const;

/** Replay of a finished live review's real results (Watch, Law, Judge); index 0 unused. */
export const REVEAL_STAGE_MS = [0, 1800, 1400, 1800] as const;
