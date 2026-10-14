export const FOOTAGE_GRACE_MS = 180;
export const FOOTAGE_TIMEOUT_MS = 30_000;

/** Leave a decodable frame before the end, including on a shorter annotated copy. */
export function boundedFootageSeek(requested: number, duration: number): number {
  const time = Number.isFinite(requested) ? Math.max(0, requested) : 0;
  if (!Number.isFinite(duration) || duration <= 0) return time;
  return Math.min(time, Math.max(0, duration - 0.1));
}

export function initialReviewSeek(c: {
  provenance: { isDemo: boolean };
  vehicle: { plate: string | null };
  evidence: { durationSeconds: number };
  offences: readonly { included: boolean; atSeconds: number }[];
}): number {
  if (c.provenance.isDemo) return c.vehicle.plate ? 12 : 20;
  return boundedFootageSeek(
    c.offences.find((offence) => offence.included)?.atSeconds ?? 0,
    c.evidence.durationSeconds,
  );
}

export type FootageState = {
  phase: "loading" | "ready" | "failed";
  frameReady: boolean;
  playerReady: boolean;
  showLoader: boolean;
};
export const initialFootageState = (): FootageState => ({
  phase: "loading", frameReady: false, playerReady: false, showLoader: false,
});
export type FootageEvent =
  | { type: "status"; status: "idle" | "loading" | "readyToPlay" | "error" }
  | { type: "frame" | "grace" | "failed" | "retry" };

/** Buffer readiness alone does not prove that a frame is visible on AVPlayer. */
export function footageState(state: FootageState, event: FootageEvent): FootageState {
  if (event.type === "retry") return initialFootageState();
  // A late decode/status callback must not dismiss a failed load's retry action.
  if (state.phase === "failed") return state;
  if (event.type === "failed" || (event.type === "status" && event.status === "error"))
    return { ...state, phase: "failed", showLoader: false };
  if (event.type === "grace")
    return state.phase === "loading" ? { ...state, showLoader: true } : state;
  const next = { ...state };
  if (event.type === "frame") next.frameReady = true;
  if (event.type === "status") next.playerReady = event.status === "readyToPlay";
  next.phase = next.frameReady && next.playerReady ? "ready" : "loading";
  if (state.phase === "ready" && next.phase === "loading") next.showLoader = false;
  return next;
}
