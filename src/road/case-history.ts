import type { ReviewHistoryItem } from "../lib/history.ts";
import type { Incident } from "../lib/domain.ts";
import { correctStatus, mergeServerCase, type RoadCase } from "./model.ts";
import { isPendingStatus, latestByPlate } from "./submission-model.ts";

/** Download only the Cases queue and actual Sent records when summaries suffice. */
export function visibleHistoryDetails(history: readonly ReviewHistoryItem[]): ReviewHistoryItem[] {
  const eligible = history.filter((item) => !item.dismissed &&
    item.reportingStatus !== "clean" &&
    (item.reportingStatus === "sent" || isPendingStatus(item.reportingStatus) || item.reportableCount !== 0),
  );
  const pending = eligible.filter((item) => item.reportingStatus !== "sent" &&
    (isPendingStatus(item.reportingStatus) || (item.reportableCount ?? 0) > 0),
  );
  const pendingIds = new Set(pending.map((item) => item.reviewId));
  const selected = new Set(latestByPlate(pending, (item) => item.plate ?? null)
    .map((item) => item.reviewId));
  // Unknown legacy metadata must be fetched to establish whether it is visible.
  // It cannot reserve a plate or suppress an explicitly pending case yet.
  return eligible.filter((item) => !pendingIds.has(item.reviewId) || selected.has(item.reviewId));
}

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
    const updated: RoadCase = {
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
    // The summary selects queue membership; detailed facts determine whether a
    // pending report still needs its plate, location or other required fields.
    if (item.reportingStatus === "ready" || item.reportingStatus === "needs_info")
      updated.reporting.status = correctStatus(updated);
    return updated;
  });
}
