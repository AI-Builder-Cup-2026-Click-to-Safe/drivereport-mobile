import type { ReviewHistoryItem } from "../lib/history.ts";
import { mergeServerCase, type RoadCase } from "./model.ts";

/** Reconcile fetched details and history metadata with the latest local edits. */
export function mergeCaseHistory(
  local: RoadCase[],
  remote: RoadCase[],
  history: ReviewHistoryItem[],
): RoadCase[] {
  const next = [...local];
  for (const serverCase of remote) {
    const index = next.findIndex((c) =>
      (c.reviewId && c.reviewId === serverCase.reviewId) || c.id === serverCase.id,
    );
    if (index >= 0) next[index] = mergeServerCase(next[index], serverCase);
    else next.push(serverCase);
  }
  const byReview = new Map(history.map((item) => [item.reviewId, item]));
  return next.map((c) => {
    const item = c.reviewId ? byReview.get(c.reviewId) : undefined;
    if (!item || c.provenance.isDemo) return c;
    return {
      ...c,
      // Also backfill already-known cases, which do not need another detail fetch.
      createdAt: Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt : c.createdAt,
      reporting: item.reportingStatus && c.reporting.status !== "sent"
        ? { status: item.reportingStatus, confirmedByUser: item.reportingStatus === "sent" }
        : c.reporting,
    };
  });
}
