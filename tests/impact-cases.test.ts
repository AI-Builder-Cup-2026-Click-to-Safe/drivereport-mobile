import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { impactCases } from "../src/road/impact-cases.ts";
import { pendingCases } from "../src/road/submission-model.ts";
import type { RoadCase } from "../src/road/model.ts";

const fixture = JSON.parse(readFileSync(
  new URL("../src/road/fixtures.json", import.meta.url), "utf8",
));
function live(id: string, status: RoadCase["reporting"]["status"] = "ready", day = 18): RoadCase {
  const c: RoadCase = structuredClone(fixture.allCases[0]);
  c.id = id;
  c.vehicle.plate = id;
  c.createdAt = `2026-10-${day}T00:00:00Z`;
  c.incident.date = `2026-10-${day}`;
  c.incident.timeZone = "UTC";
  c.provenance.isDemo = false;
  c.reporting = { status, confirmedByUser: false };
  return c;
}
const ids = (cases: RoadCase[]) => cases.map((c) => c.id);

test("Impact excludes dismissed and clean cases from every tab", () => {
  const pending = live("pending");
  const sent = live("sent", "sent");
  const dismissedPending = { ...live("dismissed-pending"), dismissed: true };
  const dismissedSent = { ...live("dismissed-sent", "sent"), dismissed: true };
  const result = impactCases([pending, live("clean", "clean"), dismissedPending, sent, dismissedSent]);
  assert.deepEqual(ids(result.all), ["pending", "sent"]);
  assert.deepEqual(ids(result.needsYou), ["pending"]);
  assert.deepEqual(ids(result.sent), ["sent"]);
  assert.equal(result.all.length, result.needsYou.length + result.sent.length);
});

test("Needs you is exactly the Cases queue including latest-plate deduplication", () => {
  const older = live("older", "ready", 16);
  const newer = live("newer", "needs_info", 18);
  older.vehicle.plate = "ABC 123";
  newer.vehicle.plate = "abc123";
  const opened = live("opened", "opened", 17);
  const unknown = live("unknown");
  const anotherUnknown = live("another-unknown");
  unknown.vehicle.plate = anotherUnknown.vehicle.plate = null;
  const cases = [older, opened, live("sent", "sent"), newer, unknown, anotherUnknown];
  const result = impactCases(cases);
  assert.deepEqual(result.needsYou, pendingCases(cases));
  assert.deepEqual(ids(result.needsYou), ["newer", "unknown", "another-unknown", "opened"]);
  assert.equal(result.all.some((c) => c.id === "older"), false);
});

test("Sent uses server reporting status and retains separate sent reports for one plate", () => {
  const sent = live("sent", "sent", 17);
  const newerSent = live("newer-sent", "sent", 18);
  const opened = live("opened", "opened");
  sent.vehicle.plate = newerSent.vehicle.plate = opened.vehicle.plate = "ABC123";
  // A browser/WhatsApp handoff is not a report, even if another flag is stale.
  opened.reporting.confirmedByUser = true;
  const result = impactCases([sent, opened, newerSent]);
  assert.deepEqual(ids(result.sent), ["newer-sent", "sent"]);
  assert.deepEqual(ids(result.needsYou), ["opened"]);
  assert.equal(result.all.length, 3);
});

test("period and offence filters never revive an older duplicate excluded by Cases", () => {
  const older = live("older", "ready", 18);
  const newer = live("newer", "ready", 19);
  older.vehicle.plate = newer.vehicle.plate = "ABC123";
  older.offences[0].code = "red_light";
  newer.offences[0].code = "wrong_way";
  const now = new Date("2026-10-18T12:00:00Z");
  assert.deepEqual(impactCases([older, newer], { period: "today", now }).needsYou, []);
  assert.deepEqual(impactCases([older, newer], { offence: "red_light" }).all, []);
});

test("filters apply to all three tabs and never mutate the API cases", () => {
  const pending = live("pending");
  const sent = live("sent", "sent");
  pending.vehicle.plate = "ABC 123";
  sent.vehicle.plate = "abc123";
  const cases = [live("unrelated"), sent, pending];
  const original = structuredClone(cases);
  const result = impactCases(cases, { plate: "Abc 123" });
  assert.deepEqual(ids(result.all), ["sent", "pending"]);
  assert.deepEqual(ids(result.needsYou), ["pending"]);
  assert.deepEqual(ids(result.sent), ["sent"]);
  assert.deepEqual(cases, original);
});
