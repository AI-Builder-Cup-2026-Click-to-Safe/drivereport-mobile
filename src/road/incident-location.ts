import { correctStatus, type RoadCase } from "./model.ts";
import { locationAddress, type LocationLookup } from "./report-defaults.ts";

/** Only complete decimal coordinate pairs qualify; never infer from an address. */
export function incidentCoordinates(value: string | null | undefined) {
  const pair = value?.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!pair) return null;
  const latitude = Number(pair[1]), longitude = Number(pair[2]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}

/** A failed lookup must not turn a coordinate pair into a lone latitude. */
export function shortIncidentLocation(value: string | null | undefined): string {
  const location = value?.trim() || "";
  return incidentCoordinates(location) ? location : location.split(",")[0].trim();
}

export function needsIncidentLocation(c: RoadCase): boolean {
  return !c.provenance.isDemo && !c.dismissed && c.reporting.status !== "sent" &&
    !c.edited?.includes("location") && !!incidentCoordinates(c.incident.location);
}

/** Preserve the evidence and merge only while this same unedited location remains. */
export function applyIncidentLocation(current: RoadCase, expected: RoadCase, address: string): RoadCase {
  const location = address.trim();
  if (!location || incidentCoordinates(location) || !needsIncidentLocation(current) ||
      current.id !== expected.id || current.sourceId !== expected.sourceId ||
      current.reviewId !== expected.reviewId || current.analysis !== expected.analysis ||
      current.incident.location !== expected.incident.location) return current;
  const next = {
    ...current,
    incident: {
      ...current.incident,
      location,
      locationCoordinates: current.incident.location!,
    },
    version: current.version + 1,
  };
  next.reporting = { ...current.reporting, status: correctStatus(next) };
  return next;
}

/** Cache successful lookups and share native work for the same coordinates.
 * No current-device GPS is read. Failed/expired work keeps the original pair and
 * can be retried when the review is reopened. Native requests cannot be cancelled. */
export function createIncidentLocationResolver(
  reverseGeocode: LocationLookup["reverseGeocode"],
  timeoutMs = 8_000,
) {
  const cache = new Map<string, string>();
  const pending = new Map<string, Promise<string | null>>();
  return async (location: string): Promise<string> => {
    const coordinates = incidentCoordinates(location);
    if (!coordinates) return location;
    const key = `${coordinates.latitude},${coordinates.longitude}`;
    const saved = cache.get(key);
    if (saved) return saved;
    let work = pending.get(key);
    if (!work) {
      work = (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const address = await Promise.race([
            Promise.resolve().then(() => reverseGeocode(coordinates))
              .then((addresses) => addresses.map(locationAddress).find(Boolean) || null),
            new Promise<null>((resolve) => {
              timer = setTimeout(() => resolve(null), timeoutMs);
            }),
          ]);
          if (address) {
            // Bound in-memory history; persisted cases already retain their address.
            if (cache.size >= 100) cache.delete(cache.keys().next().value!);
            cache.set(key, address);
          }
          return address;
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
          pending.delete(key);
        }
      })();
      pending.set(key, work);
    }
    return await work || location;
  };
}
