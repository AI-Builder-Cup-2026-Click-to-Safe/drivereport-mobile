import { correctStatus, type RoadCase } from "./model.ts";

export type ReportDefaults = Partial<Pick<RoadCase["incident"], "date" | "location">>;

/** Calendar date on this device; UTC conversion can move it to another day. */
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function needsReportDefault(c: RoadCase, key: "date" | "location"): boolean {
  return !c.provenance.isDemo && !c.dismissed && c.reporting.status !== "sent" &&
    c.offences.length > 0 && !c.incident[key]?.trim() && !c.edited?.includes(key);
}

/** Merge against the latest case, never the snapshot from before GPS completed. */
export function applyReportDefaults(
  current: RoadCase,
  expected: RoadCase,
  defaults: ReportDefaults,
): RoadCase {
  if (current.id !== expected.id || current.sourceId !== expected.sourceId ||
      current.reviewId !== expected.reviewId || current.analysis !== expected.analysis)
    return current;
  const incident = { ...current.incident };
  const defaulted = new Set(current.defaulted || []);
  let changed = false;
  for (const key of ["date", "location"] as const) {
    const value = defaults[key]?.trim();
    if (!value || !needsReportDefault(current, key)) continue;
    incident[key] = value;
    defaulted.add(key);
    changed = true;
  }
  if (!changed) return current;
  const next = { ...current, incident, defaulted: [...defaulted], version: current.version + 1 };
  next.reporting = { ...current.reporting, status: correctStatus(next) };
  return next;
}

type Coordinates = { latitude: number; longitude: number };
type Address = {
  formattedAddress?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
};
export type LocationLookup = {
  servicesEnabled: () => Promise<boolean>;
  requestPermission: () => Promise<{ granted: boolean }>;
  currentPosition: () => Promise<{ coords: Coordinates }>;
  reverseGeocode: (coordinates: Coordinates) => Promise<Address[]>;
};

export function locationAddress(address: Address): string | null {
  if (address.formattedAddress?.trim()) return address.formattedAddress.trim();
  const street = [address.streetNumber, address.street].filter(Boolean).join(" ");
  const parts = [street, address.district, address.city, address.region, address.country]
    .map((part) => part?.trim()).filter((part): part is string => !!part);
  return [...new Set(parts)].join(", ") || null;
}

/** Native location cannot be cancelled; bound waiting and discard late results. */
export async function currentLocationDefault(
  lookup: LocationLookup,
  isActive: () => boolean,
  timeoutMs = 15_000,
): Promise<string | null> {
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const active = () => !finished && isActive();
  const locate = async () => {
    if (!active() || !(await lookup.servicesEnabled()) || !active()) return null;
    const permission = await lookup.requestPermission();
    if (!active() || !permission.granted) return null;
    const position = await lookup.currentPosition();
    if (!active()) return null;
    const addresses = await lookup.reverseGeocode(position.coords);
    if (!active()) return null;
    return addresses.map(locationAddress).find(Boolean) || null;
  };
  try {
    return await Promise.race([
      locate(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch {
    // Permission denial, disabled services and offline geocoding keep manual entry.
    return null;
  } finally {
    finished = true;
    clearTimeout(timer);
  }
}
