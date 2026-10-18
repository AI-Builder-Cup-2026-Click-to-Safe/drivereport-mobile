import { normalizePlate, type RoadCase } from "./model.ts";
export const submissionSource = "submission_fixture_v1";
export const isSubmissionDemo = (c: RoadCase) =>
  c.provenance.isDemo && c.provenance.factsSource === submissionSource;
export const isPendingStatus = (status: string | undefined) =>
  status === "ready" || status === "needs_info" || status === "opened";

/** Shared queue ordering for API summaries and loaded cases. */
export function latestByPlate<T extends { createdAt?: string }>(
  items: readonly T[],
  plateOf: (item: T) => string | null,
  isDemo: (item: T) => boolean = () => false,
): T[] {
  const plates = new Set<string>();
  const savedTime = (c: T) => {
    const value = Date.parse(c.createdAt || "");
    return Number.isFinite(value) ? value : -Infinity;
  };
  // Sort live cases before deduplication so the newest review of a plate wins.
  // Stable ties/unknown dates retain input order; authored demo positions stay put.
  const live = items.filter((c) => !isDemo(c))
    .sort((a, b) => savedTime(b) - savedTime(a) || 0);
  let liveIndex = 0;
  return items.map((c) => isDemo(c) ? c : live[liveIndex++]).filter((c) => {
    // One case per plate: analysing the same clip again must not queue it twice.
    const plate = normalizePlate(plateOf(c));
    if (!plate) return true;
    if (plates.has(plate)) return false;
    plates.add(plate);
    return true;
  });
}
export const pendingCases = (cases: RoadCase[]) => latestByPlate(
  cases.filter((c) => !c.dismissed && isPendingStatus(c.reporting.status)),
  (c) => c.vehicle.plate,
  (c) => c.provenance.isDemo,
);
export const casePoints = (c: RoadCase) =>
  c.offences
    .filter((o) => o.included)
    .reduce((sum, o) => sum + (o.demeritPoints ?? 0), 0);
// The current API has no licence lookup. Never use the sample record for live footage.
export function licenceRecord(c: RoadCase) {
  return isSubmissionDemo(c) && normalizePlate(c.vehicle.plate) === "WXY2048"
    ? { points: 10, summonses: 1 }
    : null;
}
export function topOffender(cases: RoadCase[]) {
  const plates = new Map<
    string,
    { case: RoadCase; record: number; pending: number; reports: number }
  >();
  for (const c of [...cases].sort((a, b) =>
    (b.incident.date || "").localeCompare(a.incident.date || ""),
  )) {
    const key = normalizePlate(c.vehicle.plate);
    if (!key) continue;
    const entry = plates.get(key) || {
      case: c,
      record: licenceRecord(c)?.points ?? 0,
      pending: 0,
      reports: 0,
    };
    if (c.reporting.status === "sent" && c.authorityOutcome.status !== "issued") {
      entry.pending += casePoints(c);
      entry.reports += 1;
    }
    plates.set(key, entry);
  }
  return [...plates.values()]
    .filter((x) => x.record + x.pending > 0)
    .sort((a, b) => b.record + b.pending - a.record - a.pending)[0];
}
export const deathStats = [
  [18, "Malaysian"],
  [564, "Indian"],
  [85, "Indonesian"],
  [50, "Thai"],
  [47, "Vietnamese"],
  [30, "Philippine"],
  [10, "South Korean"],
  [9, "Japanese"],
  [3, "Australian"],
  [1, "New Zealand"],
  [1, "Singapore"],
] as const;
export function deathSentence(index: number) {
  const [n, place] = deathStats[index];
  return `${n} ${n === 1 ? "person dies" : "people die"} on ${place} roads ${place === "Singapore" ? "every 3 days." : "every day."}`;
}
