import { test } from "node:test";
import assert from "node:assert/strict";
import { shortDate, typedPlate, zoneLabel } from "../src/road/format.ts";

const now = new Date("2026-10-10T04:00:00Z");

test("incident dates read like the reference, never ISO", () => {
  assert.equal(shortDate("2026-10-03", "en-GB", { now }), "3 Oct");
  assert.equal(shortDate("2026-10-03", "en-US", { now }), "Oct 3");
  assert.equal(shortDate("2025-12-31", "en-GB", { now }), "31 Dec 2025");
  assert.equal(shortDate(null, "en-GB", { now }), "Date unknown");
  assert.equal(shortDate("not a date", "en-GB", { now }), "not a date");
});

test("list dates say Today in the case's own time zone", () => {
  const options = { now, relative: true, timeZone: "Asia/Kuala_Lumpur" };
  assert.equal(shortDate("2026-10-10", "en-GB", options), "Today");
  assert.equal(shortDate("2026-10-09", "en-GB", options), "9 Oct");
  assert.equal(shortDate("2026-10-10", "en-GB", { now }), "10 Oct");
});

test("typed plates are uppercase with single spaces", () => {
  assert.equal(typedPlate("abc 1234"), "ABC 1234");
  assert.equal(typedPlate("  wxy   2048"), "WXY 2048");
  assert.equal(typedPlate("vbn "), "VBN ");
});

test("incident time zones read as a GMT offset", () => {
  assert.equal(zoneLabel("Asia/Kuala_Lumpur", now), "GMT+8");
  assert.equal(zoneLabel("Asia/Kolkata", now), "GMT+5:30");
  // Sydney observes daylight saving from October to April.
  const july = new Date("2026-07-01T00:00:00Z");
  assert.equal(zoneLabel("Australia/Sydney", july), "GMT+10");
  assert.equal(zoneLabel("Australia/Sydney", now), "GMT+11");
  assert.equal(zoneLabel("UTC", now), "UTC");
  assert.equal(zoneLabel("Not/AZone", now), "Not/AZone");
});
