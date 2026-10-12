import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { URL } from "node:url";
import {
  applyReportDefaults,
  currentLocationDefault,
  localDate,
  locationAddress,
  needsReportDefault,
  type LocationLookup,
} from "../src/road/report-defaults.ts";
import { editCase, mergeServerCase, type RoadCase } from "../src/road/model.ts";

const fixture = JSON.parse(fs.readFileSync(
  new URL("../src/road/fixtures.json", import.meta.url), "utf8",
));
function liveCase(): RoadCase {
  const c: RoadCase = structuredClone(fixture.allCases[0]);
  c.provenance.isDemo = false;
  c.incident.date = null;
  c.incident.location = null;
  c.reporting.status = "needs_info";
  c.analysis = {
    incident: { ...c.incident }, vehicle: { ...c.vehicle },
    offences: c.offences, timeline: [],
  };
  return c;
}

test("today uses the device calendar across UTC midnight and year boundaries", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Asia/Tokyo";
    assert.equal(localDate(new Date("2026-12-31T16:00:00Z")), "2027-01-01");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(localDate(new Date("2027-01-01T01:00:00Z")), "2026-12-31");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("missing facts receive labelled defaults without changing time, jurisdiction or analysis", () => {
  const c = liveCase();
  const next = applyReportDefaults(c, c, { date: "2026-10-12", location: "Jalan Ampang, Kuala Lumpur" });
  assert.equal(next.incident.date, "2026-10-12");
  assert.equal(next.incident.location, "Jalan Ampang, Kuala Lumpur");
  assert.deepEqual(next.defaulted, ["date", "location"]);
  assert.equal(next.incident.time, c.incident.time);
  assert.equal(next.incident.timeZone, c.incident.timeZone);
  assert.equal(next.region, c.region);
  assert.equal(next.analysis, c.analysis);
  assert.equal(next.analysis?.incident.date, null);
  assert.equal(next.edited, c.edited);
  assert.equal(next.reporting.status, "ready");
  assert.equal(next.version, c.version + 1);
});

test("existing evidence and deliberately cleared facts are never replaced", () => {
  const c = liveCase();
  c.incident.date = "2026-09-20";
  c.incident.location = "Recorded road";
  assert.equal(applyReportDefaults(c, c, { date: "2026-10-12", location: "GPS road" }), c);
  const cleared = editCase(c, { incident: { ...c.incident, date: "", location: "" } });
  assert.equal(needsReportDefault(cleared, "location"), false);
  assert.equal(applyReportDefaults(cleared, c, { date: "2026-10-12", location: "GPS road" }), cleared);
});

test("sent, demo, dismissed and clean cases do not receive defaults", () => {
  for (const change of [
    (c: RoadCase) => { c.reporting.status = "sent"; },
    (c: RoadCase) => { c.provenance.isDemo = true; },
    (c: RoadCase) => { c.dismissed = true; },
    (c: RoadCase) => { c.offences = []; },
  ]) {
    const c = liveCase();
    change(c);
    assert.equal(needsReportDefault(c, "location"), false);
    assert.equal(applyReportDefaults(c, c, { date: "2026-10-12", location: "GPS road" }), c);
  }
});

test("late location merges only the missing field and rejects replaced cases", () => {
  const original = liveCase();
  const withDate = applyReportDefaults(original, original, { date: "2026-10-12" });
  const edited = editCase(withDate, { incident: { ...withDate.incident, description: "User description" } });
  const next = applyReportDefaults(edited, original, { location: "GPS road" });
  assert.equal(next.incident.description, "User description");
  assert.equal(next.incident.date, "2026-10-12");
  assert.deepEqual(next.edited, ["description"]);
  for (const replacement of [
    { ...edited, id: "another-case" },
    { ...edited, sourceId: "another-video" },
    { ...edited, reviewId: "another-review" },
    { ...edited, analysis: structuredClone(edited.analysis) },
  ]) assert.equal(applyReportDefaults(replacement, original, { location: "GPS road" }), replacement);
});

test("defaults and provenance survive storage, server refresh and reopening tomorrow", () => {
  const c = liveCase();
  const saved = applyReportDefaults(c, c, { date: "2026-10-12", location: "GPS road" });
  const restored: RoadCase = JSON.parse(JSON.stringify(saved));
  const remote = liveCase();
  remote.incident.date = "2026-10-13";
  remote.incident.location = "Server road";
  const refreshed = mergeServerCase(restored, remote);
  assert.deepEqual(refreshed.defaulted, ["date", "location"]);
  assert.deepEqual(refreshed.incident, saved.incident);
  assert.equal(applyReportDefaults(refreshed, refreshed, { date: "2026-10-13", location: "New GPS road" }), refreshed);
});

function lookup(overrides: Partial<LocationLookup> = {}): LocationLookup {
  return {
    servicesEnabled: async () => true,
    requestPermission: async () => ({ granted: true }),
    currentPosition: async () => ({ coords: { latitude: 3.16, longitude: 101.71 } }),
    reverseGeocode: async () => [{ street: "Jalan Ampang", city: "Kuala Lumpur", country: "Malaysia" }],
    ...overrides,
  };
}

test("reverse geocoding builds a readable address from nullable platform fields", async () => {
  assert.equal(locationAddress({ formattedAddress: "  Full Android address  " }), "Full Android address");
  assert.equal(locationAddress({ streetNumber: "8", street: "Road", district: "City", city: "City", region: null }), "8 Road, City");
  assert.equal(locationAddress({ city: null, street: "" }), null);
  assert.equal(await currentLocationDefault(lookup(), () => true), "Jalan Ampang, Kuala Lumpur, Malaysia");
});

test("denied permission, disabled services, unavailable GPS and offline geocoding leave manual entry", async () => {
  let positionCalls = 0;
  const position = async () => { positionCalls++; throw Error("No GPS"); };
  assert.equal(await currentLocationDefault(lookup({ servicesEnabled: async () => false, currentPosition: position }), () => true), null);
  assert.equal(await currentLocationDefault(lookup({ requestPermission: async () => ({ granted: false }), currentPosition: position }), () => true), null);
  assert.equal(positionCalls, 0);
  assert.equal(await currentLocationDefault(lookup({ currentPosition: position }), () => true), null);
  assert.equal(positionCalls, 1);
  assert.equal(await currentLocationDefault(lookup({ reverseGeocode: async () => { throw Error("Offline"); } }), () => true), null);
  assert.equal(await currentLocationDefault(lookup({ reverseGeocode: async () => [] }), () => true), null);
});

test("leaving review during permission, GPS or geocoding ignores the result", async () => {
  for (const stage of ["requestPermission", "currentPosition", "reverseGeocode"] as const) {
    let active = true;
    const api = lookup();
    // Each stage resolves after navigation has invalidated this review opening.
    if (stage === "requestPermission") api.requestPermission = async () => { active = false; return { granted: true }; };
    if (stage === "currentPosition") api.currentPosition = async () => { active = false; return { coords: { latitude: 0, longitude: 0 } }; };
    if (stage === "reverseGeocode") api.reverseGeocode = async () => { active = false; return [{ city: "Late city" }]; };
    assert.equal(await currentLocationDefault(api, () => active), null);
  }
});

test("location timeout stops the chain even when native GPS resolves later", async () => {
  let resolvePosition!: (position: { coords: { latitude: number; longitude: number } }) => void;
  const position = new Promise<{ coords: { latitude: number; longitude: number } }>((resolve) => { resolvePosition = resolve; });
  let geocodeCalls = 0;
  assert.equal(await currentLocationDefault(lookup({
    currentPosition: () => position,
    reverseGeocode: async () => { geocodeCalls++; return [{ city: "Late city" }]; },
  }), () => true, 5), null);
  resolvePosition({ coords: { latitude: 0, longitude: 0 } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(geocodeCalls, 0);
});

test("edits, cleared inputs and sending while GPS waits survive completion", async () => {
  for (const changedLocation of ["Typed road", ""]) {
    const c = liveCase();
    const typed = editCase(c, { incident: { ...c.incident, location: "Typed road" } });
    const current = editCase(typed, { incident: { ...typed.incident, location: changedLocation } });
    const location = await currentLocationDefault(lookup(), () => true);
    assert.equal(applyReportDefaults(current, c, { location }), current);
  }
  const c = liveCase();
  const sent: RoadCase = { ...c, reporting: { status: "sent", confirmedByUser: true } };
  const location = await currentLocationDefault(lookup(), () => true);
  assert.equal(applyReportDefaults(sent, c, { location }), sent);
});
