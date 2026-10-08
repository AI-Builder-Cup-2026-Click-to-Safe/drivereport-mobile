import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { URL } from "node:url";
import { type RoadCase, validation } from "../src/road/model.ts";
import {
  casePoints,
  licenceRecord,
  pendingCases,
  topOffender,
  deathSentence,
  deathStats,
} from "../src/road/submission-model.ts";
const cases = (): RoadCase[] =>
  JSON.parse(
    fs.readFileSync(
      new URL("../src/road/submission-fixtures.json", import.meta.url),
      "utf8",
    ),
  ).allCases;
test("submission queue exposes the complete and unreadable samples; sent reports remain out", () => {
  const q = pendingCases(cases());
  assert.equal(q.length, 2);
  assert.equal(validation(q[0]), "");
  assert.match(validation(q[1]), /plate/);
  q[0].reporting.status = "sent";
  assert.equal(pendingCases(q).length, 1);
});
test("licence meter only adds sent, unissued reports and does not infer records for live video", () => {
  const c = cases(),
    sample = c[0];
  assert.equal(topOffender(c)?.record, 10);
  assert.equal(topOffender(c)?.pending, 0);
  sample.reporting.status = "opened";
  assert.equal(topOffender(c)?.pending, 0);
  sample.reporting.status = "sent";
  assert.equal(topOffender(c)?.pending, 10);
  sample.authorityOutcome.status = "issued";
  assert.equal(topOffender(c)?.pending, 0);
  sample.provenance.isDemo = false;
  assert.equal(licenceRecord(sample), null);
  sample.offences.forEach((o) => (o.demeritPoints = undefined));
  assert.equal(casePoints(sample), 0);
});
test("edited plates and excluded offences update the fixture lookup and pending contribution", () => {
  const c = cases();
  c[0].vehicle.plate = "ABC123";
  assert.equal(licenceRecord(c[0]), null);
  c[0].vehicle.plate = "wxy 2048";
  assert.equal(licenceRecord(c[0])?.points, 10);
  c[0].reporting.status = "sent";
  c[0].offences[0].included = false;
  assert.equal(topOffender(c)?.pending, 0);
});
test("road statistic retains eleven authored markets with singular and three-day grammar", () => {
  assert.equal(deathStats.length, 11);
  assert.equal(deathSentence(0), "18 people die on Malaysian roads every day.");
  assert.equal(
    deathSentence(10),
    "1 person dies on Singapore roads every 3 days.",
  );
});
test("native nav uses all 72 paired points from the authored geometry", () => {
  const forms = JSON.parse(
    fs.readFileSync(
      new URL("../design/submission/nav-geometry.json", import.meta.url),
      "utf8",
    ),
  );
  for (const form of Object.values(forms) as {
    geometry: { a: number[][]; b: number[][] };
  }[]) {
    assert.equal(form.geometry.a.length, 72);
    assert.equal(form.geometry.b.length, 72);
    assert.ok(form.geometry.a.flat().every(Number.isFinite));
  }
});
