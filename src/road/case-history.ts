import type { ReviewHistoryItem } from "../lib/history.ts";
import type { Incident } from "../lib/domain.ts";
import { mergeServerCase, type RoadCase } from "./model.ts";

/** Limit cold-start detail requests while retaining successful partial results. */
export async function loadHistoryDetails<T>(
  history: readonly ReviewHistoryItem[],
  load: (item: ReviewHistoryItem) => Promise<T>,
): Promise<PromiseSettledResult<T>[]> {
  const results = new Array<PromiseSettledResult<T>>(history.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, history.length) }, async () => {
    while (next < history.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await load(history[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }));
  return results;
}

/** Link an API case to retained footage without restoring a cached review. */
export function linkLocalEvidence(c: RoadCase, records: Incident[]): RoadCase {
  if (c.provenance.isDemo || !c.evidence.originalVideoUrl) return c;
  let objectUri: string;
  try {
    const url = new URL(c.evidence.originalVideoUrl);
    if (url.protocol !== "https:" || url.hostname !== "storage.googleapis.com") return c;
    objectUri = `gs:/${decodeURIComponent(url.pathname)}`;
  } catch { return c; }
  const source = records.find((record) => record.remoteUri === objectUri &&
    record.file.startsWith("file:") &&
    (!record.result?.review_id || record.result.review_id === c.reviewId),
  );
  return source ? {
    ...c,
    sourceId: source.id,
    evidence: { ...c.evidence, originalVideoUrl: source.file },
  } : c;
}

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
      dismissed: item.dismissed ?? c.dismissed,
      evidence: item.thumbnailUrl !== undefined
        ? { ...c.evidence, thumbnailUrl: item.thumbnailUrl }
        : c.evidence,
      reporting: item.reportingStatus
        ? { status: item.reportingStatus, confirmedByUser: item.reportingStatus === "sent" }
        : c.reporting,
    };
  });
}
