import { inPeriod, normalizePlate, type RoadCase } from "./model.ts";
import { pendingCases } from "./submission-model.ts";

export function impactCases(
  cases: RoadCase[],
  filters: { period?: string; plate?: string; offence?: string; now?: Date } = {},
) {
  // Select the Cases queue first: a view filter must not revive an older
  // duplicate that the Cases tab already excludes.
  const pending = pendingCases(cases);
  const pendingIds = new Set(pending.map((c) => c.id));
  const eligible = cases.filter((c) =>
    !c.dismissed && (pendingIds.has(c.id) || c.reporting.status === "sent"),
  );
  const savedTime = (c: RoadCase) => {
    const value = Date.parse(c.createdAt || "");
    return Number.isFinite(value) ? value : -Infinity;
  };
  const live = eligible.filter((c) => !c.provenance.isDemo)
    .sort((a, b) => savedTime(b) - savedTime(a) || 0);
  let liveIndex = 0;
  const ordered = eligible.map((c) => c.provenance.isDemo ? c : live[liveIndex++]);
  const plate = normalizePlate(filters.plate || null);
  const matches = (c: RoadCase) =>
    inPeriod(c, filters.period || "all", filters.now) &&
    (!plate || normalizePlate(c.vehicle.plate) === plate) &&
    (!filters.offence || c.offences.some((o) => o.code === filters.offence));
  const all = ordered.filter(matches);
  return {
    all,
    needsYou: pending.filter(matches),
    sent: all.filter((c) => c.reporting.status === "sent"),
  };
}
