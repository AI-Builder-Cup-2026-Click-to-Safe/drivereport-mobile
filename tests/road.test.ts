import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { URL } from "node:url";
import {
  correctStatus,
  fromLegacy,
  impact,
  inPeriod,
  missing,
  normalizePlate,
  recipient,
  reportText,
  validation,
  whatsapp,
  type RoadCase,
  type Preferences,
} from "../src/road/model.ts";
import type { Incident } from "../src/lib/domain.ts";
const fixture = JSON.parse(
  fs.readFileSync(
    new URL("../src/road/fixtures.json", import.meta.url),
    "utf8",
  ),
);
const base = (): RoadCase => structuredClone(fixture.allCases[0]);
const prefs: Preferences = {
  region: "SG",
  language: "en-GB",
  reduced: false,
  recipients: { MY: "60134498997", SG: "", JP: "" },
  includePersonal: false,
  name: "Private name",
  identity: "secret",
  address: "",
  phone: "",
  email: "",
  demo: true,
};
test("review gates all required facts and at least one offence, but not personal details", () => {
  const c = base();
  assert.equal(validation(c), "");
  for (const key of ["date", "time", "location", "description"] as const) {
    const x = base();
    x.incident[key] = null;
    assert.ok(validation(x));
    assert.ok(missing(x).includes(key));
  }
  c.offences.forEach((o) => (o.included = false));
  assert.ok(validation(c));
  const invalid = base();
  invalid.incident.date = "2026-02-30";
  assert.ok(validation(invalid));
  invalid.incident.date = "2026-10-03";
  invalid.incident.time = "99:90";
  assert.ok(validation(invalid));
});
test("report uses case jurisdiction, encoded factual draft and opt-in private details", () => {
  const c = base();
  c.incident.description = "A & B / café?";
  assert.equal(recipient(prefs, c), "60134498997");
  const url = whatsapp(c, prefs);
  assert.ok(decodeURIComponent(url).includes("A & B / café?"));
  assert.ok(!reportText(c, prefs).includes("Private name"));
  assert.ok(
    reportText(c, { ...prefs, includePersonal: true }).includes("Private name"),
  );
  assert.ok(reportText(c, prefs).includes("DEMO"));
  c.region = "SG";
  assert.throws(() => whatsapp(c, prefs), /Singapore/);
});
test("reporting completion, opening, sending and fine outcome remain independent", () => {
  const c = base();
  c.reporting.status = "opened";
  assert.equal(correctStatus(c), "opened");
  c.reporting.status = "sent";
  c.reporting.confirmedByUser = true;
  assert.equal(correctStatus(c), "sent");
  assert.equal(c.authorityOutcome.status, "unknown");
  c.reporting.status = "opened";
  assert.equal(correctStatus(c), "opened");
  c.incident.location = "";
  assert.equal(correctStatus(c), "needs_info");
  c.offences = [];
  assert.equal(correctStatus(c), "clean");
});
test("impact deduplicates known plates and counts occurrences independently of inclusion", () => {
  const a = base(),
    b = base(),
    unknown = base();
  a.reporting.status = "sent";
  b.reporting.status = "sent";
  b.vehicle.plate = "wxy2048";
  unknown.vehicle.plate = null;
  unknown.reporting.status = "sent";
  a.offences.forEach((o) => (o.included = false));
  b.authorityOutcome.status = "issued";
  const d = impact([a, b, unknown]);
  assert.equal(d.sent, 1);
  assert.equal(d.billed, 1);
  assert.equal(d.counts.red_light, 3);
  assert.equal(d.recurring?.[1], 2);
  b.reporting.status = "opened";
  assert.equal(impact([b]).billed, 1);
  assert.equal(impact([b]).sent, 0);
  assert.equal(normalizePlate(" wxy 2048 "), "WXY2048");
});
test("date scopes use current clock in case timezone and exclude future dates", () => {
  const c = base();
  c.incident.date = "2026-10-05";
  assert.ok(inPeriod(c, "today", new Date("2026-10-04T18:00:00Z")));
  assert.ok(!inPeriod(c, "today", new Date("2026-10-04T10:00:00Z")));
  assert.ok(inPeriod(c, "week", new Date("2026-10-10T00:00:00Z")));
  assert.ok(!inPeriod(c, "week", new Date("2026-10-12T00:00:00Z")));
});
test("GCP adapter splits vehicles without inventing dates, plate assignments, tracking, or fine outcomes", () => {
  const i = {
    id: "DR-test",
    file: "file:///drive.mov",
    createdAt: "2026-10-05",
    plate: "USER 1",
    location: "User location",
    selectedVehicleId: "a",
    result: {
      verdict: "review",
      reportable: ["a", "b"].map((vehicle_id) => ({
        vehicle_id,
        appearance: "Sedan",
        conduct: "Unsafe conduct",
        start_seconds: 3,
        end_seconds: 5,
        confidence: 0.8,
        legal_basis: "Backend citation",
        penalty: "",
        reasoning: "",
      })),
      evidence: { timeline: [] },
      follow_up_exhausted: false,
    },
  } as unknown as Incident;
  const cases = fromLegacy(i, "MY");
  assert.equal(cases.length, 2);
  assert.equal(cases[0].vehicle.plate, "USER 1");
  assert.equal(cases[1].vehicle.plate, null);
  for (const c of cases) {
    assert.equal(c.incident.date, null);
    assert.equal(c.authorityOutcome.status, "unknown");
    assert.deepEqual(c.evidence.tracks, []);
    assert.equal(c.offences[0].code, "other");
    assert.equal(c.offences[0].lawSources[0].title, "Backend citation");
  }
});
test("no-findings GCP result becomes a clean case with real video retained", () => {
  const i = {
    id: "DR-clean",
    file: "file:///clean.mov",
    result: {
      verdict: "Nothing to report",
      reportable: [],
      evidence: { timeline: [] },
      follow_up_exhausted: false,
    },
  } as unknown as Incident;
  const [c] = fromLegacy(i, "MY");
  assert.equal(c.reporting.status, "clean");
  assert.equal(c.evidence.originalVideoUrl, i.file);
  assert.equal(c.provenance.isDemo, false);
});
