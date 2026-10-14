import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { URL } from "node:url";
import {
  applyIncidentLocation,
  createIncidentLocationResolver,
  incidentCoordinates,
  needsIncidentLocation,
  shortIncidentLocation,
} from "../src/road/incident-location.ts";
import { editCase, mergeServerCase, reportText, type Preferences, type RoadCase } from "../src/road/model.ts";

const fixture = JSON.parse(fs.readFileSync(
  new URL("../src/road/fixtures.json", import.meta.url), "utf8",
));
const coordinates = "3.11030, 101.65390";
const address = "Jalan Klang Lama, Kuala Lumpur, Malaysia";
function liveCase(): RoadCase {
  const c: RoadCase = structuredClone(fixture.allCases[0]);
  c.provenance.isDemo = false;
  c.incident.location = coordinates;
  c.reporting.status = "ready";
  c.edited = [];
  c.analysis = { incident: { ...c.incident }, vehicle: { ...c.vehicle }, offences: c.offences, timeline: [] };
  return c;
}

test("only complete in-range decimal coordinate pairs are geocoded", () => {
  assert.deepEqual(incidentCoordinates(coordinates), { latitude: 3.1103, longitude: 101.6539 });
  assert.deepEqual(incidentCoordinates(" -90, +180 "), { latitude: -90, longitude: 180 });
  assert.deepEqual(incidentCoordinates("0,0"), { latitude: 0, longitude: 0 });
  for (const invalid of [null, undefined, "", "3.11030", "91, 101", "3, -181", "NaN, 20", "1e2, 20", "3, 101, 5", "Jalan 3, Kuala Lumpur", "3.1, 101.6 Malaysia"])
    assert.equal(incidentCoordinates(invalid), null, String(invalid));
});

test("receipt uses the road name but preserves both coordinates when offline", () => {
  assert.equal(shortIncidentLocation(address), "Jalan Klang Lama");
  assert.equal(shortIncidentLocation(coordinates), coordinates);
  assert.equal(shortIncidentLocation(" -3, -101 "), "-3, -101");
  assert.equal(shortIncidentLocation(null), "");
});

test("lookup uses the incident pair, shares equivalent in-flight work and caches the address", async () => {
  let count = 0;
  const resolve = createIncidentLocationResolver(async (point) => {
    count++;
    assert.deepEqual(point, { latitude: 3.1103, longitude: 101.6539 });
    return [{ street: "Jalan Klang Lama", city: "Kuala Lumpur", country: "Malaysia" }];
  });
  assert.deepEqual(await Promise.all([resolve(coordinates), resolve("3.1103,101.6539")]), [address, address]);
  assert.equal(await resolve(coordinates), address);
  assert.equal(await resolve("Already named road"), "Already named road");
  assert.equal(count, 1);
});

test("empty, offline and denied lookups preserve the exact pair and remain retryable", async () => {
  let attempts = 0;
  const resolve = createIncidentLocationResolver(async () => {
    attempts++;
    if (attempts === 1) throw Error("Geocoder offline or permission denied");
    if (attempts === 2) return [];
    if (attempts === 3) return [{ street: null, city: null }];
    return [{ formattedAddress: address }];
  });
  for (let i = 0; i < 3; i++) assert.equal(await resolve(coordinates), coordinates);
  assert.equal(await resolve(coordinates), address);
  assert.equal(attempts, 4);
});

test("timeout returns coordinates; late native results cannot replace a newer lookup", async () => {
  let finish!: (value: { city: string }[]) => void;
  const late = new Promise<{ city: string }[]>((resolve) => { finish = resolve; });
  let attempts = 0;
  const resolve = createIncidentLocationResolver(async () => ++attempts === 1 ? late : [{ formattedAddress: address }], 5);
  assert.equal(await resolve(coordinates), coordinates);
  assert.equal(await resolve(coordinates), address);
  finish([{ city: "Late stale place" }]);
  await new Promise((done) => setImmediate(done));
  assert.equal(await resolve(coordinates), address);
  assert.equal(attempts, 2);
});

test("resolved place is persisted with original evidence and included in the WhatsApp draft", () => {
  const c = liveCase();
  const resolved = applyIncidentLocation(c, c, address);
  assert.equal(resolved.incident.location, address);
  assert.equal(resolved.incident.locationCoordinates, coordinates);
  assert.equal(resolved.analysis, c.analysis);
  assert.equal(resolved.analysis?.incident.location, coordinates);
  assert.deepEqual(resolved.edited, []);
  assert.equal(resolved.version, c.version + 1);
  assert.equal(resolved.reporting.status, "ready");
  const restored: RoadCase = JSON.parse(JSON.stringify(resolved));
  const refreshed = mergeServerCase(restored, c);
  assert.equal(refreshed.incident.location, address);
  assert.equal(refreshed.incident.locationCoordinates, coordinates);
  const text = reportText(refreshed, { includePersonal: false } as Preferences);
  assert.ok(text.includes(`Location / Lokasi: ${address}`));
  assert.ok(text.includes(`Recorded coordinates / Koordinat: ${coordinates}`));
});

test("late lookup cannot replace edited, cleared, switched, reanalysed or sent cases", () => {
  const c = liveCase();
  const typed = editCase(c, { incident: { ...c.incident, location: "My chosen road" } });
  const cleared = editCase(typed, { incident: { ...typed.incident, location: "" } });
  const changedBack = editCase(typed, { incident: { ...typed.incident, location: coordinates } });
  for (const current of [
    typed, cleared, changedBack,
    { ...c, id: "different-case" },
    { ...c, sourceId: "different-recording" },
    { ...c, reviewId: "different-review" },
    { ...c, analysis: { ...c.analysis! } },
    { ...c, incident: { ...c.incident, location: "3.5, 102.1" } },
    { ...c, dismissed: true },
    { ...c, reporting: { ...c.reporting, status: "sent" as const } },
    { ...c, provenance: { ...c.provenance, isDemo: true } },
  ]) assert.equal(applyIncidentLocation(current, c, address), current);
  assert.equal(needsIncidentLocation(typed), false);
  assert.equal(applyIncidentLocation(c, c, coordinates), c);
  assert.equal(applyIncidentLocation(c, c, ""), c);
});

test("unrelated edits survive a pending lookup and named locations are never replaced", () => {
  const c = liveCase();
  const edited = editCase(c, { incident: { ...c.incident, description: "My incident description" } });
  const resolved = applyIncidentLocation(edited, c, address);
  assert.equal(resolved.incident.description, "My incident description");
  assert.deepEqual(resolved.edited, ["description"]);
  assert.equal(needsIncidentLocation(resolved), false);
  assert.equal(applyIncidentLocation(resolved, c, "Another map address"), resolved);
});
