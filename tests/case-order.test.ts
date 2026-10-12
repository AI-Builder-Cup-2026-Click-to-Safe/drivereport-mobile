import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { URL } from "node:url";
import type { Incident, Review } from "../src/lib/domain.ts";
import { mergeCaseHistory } from "../src/road/case-history.ts";
import { editCase, fromLegacy, fromServerReview, mergeServerCase, type RoadCase } from "../src/road/model.ts";
import { pendingCases } from "../src/road/submission-model.ts";

const fixture = JSON.parse(fs.readFileSync(
  new URL("../src/road/fixtures.json", import.meta.url), "utf8",
));
const older = "2026-10-11T12:00:00Z";
const newer = "2026-10-12T12:00:00Z";
function live(id: string, createdAt?: string): RoadCase {
  const c: RoadCase = structuredClone(fixture.allCases[0]);
  c.id = id;
  c.reviewId = id;
  c.createdAt = createdAt;
  c.vehicle.plate = id;
  c.provenance.isDemo = false;
  c.reporting.status = "ready";
  return c;
}
function review(id: string, createdAt?: string): Review {
  return {
    review_id: id, created_at: createdAt, case: live(id),
    verdict: "Reportable", reportable: [], follow_up_exhausted: false,
    tracks: [], evidence: { timeline: [] },
  };
}
const ids = (cases: RoadCase[]) => pendingCases(cases).map((c) => c.id);

test("initial history maps backend save timestamps and Case 1 is the latest saved", () => {
  const history = [{ reviewId: "new", createdAt: newer }, { reviewId: "old", createdAt: older }];
  const remote = history.flatMap((item) => fromServerReview(review(item.reviewId, item.createdAt), "MY"));
  assert.equal(remote[0].createdAt, newer);
  assert.deepEqual(ids(mergeCaseHistory([], remote, history)), ["new", "old"]);
});

test("incremental sync puts new reviews before cached ones and backfills every known case", () => {
  const old = live("old");
  const middle = live("middle", "2020-01-01T00:00:00Z");
  const sent = live("sent");
  sent.reporting.status = "sent";
  const history = [
    { reviewId: "new", createdAt: newer },
    { reviewId: "middle", createdAt: "2026-10-12T08:00:00Z" },
    { reviewId: "old", createdAt: older },
    { reviewId: "sent", createdAt: older },
  ];
  // Known case details are deliberately absent: history metadata alone migrates them.
  const merged = mergeCaseHistory([old, middle, sent], [live("new")], history);
  assert.deepEqual(ids(merged), ["new", "middle", "old"]);
  assert.equal(merged.find((c) => c.id === "middle")?.createdAt, history[1].createdAt);
  assert.equal(merged.find((c) => c.id === "sent")?.createdAt, older);
  assert.equal(merged.find((c) => c.id === "sent")?.reporting.status, "sent");
  assert.equal(old.createdAt, undefined);
  assert.equal(middle.createdAt, "2020-01-01T00:00:00Z");
});

test("newest pending duplicate plate wins after sorting, excluding dismissed and sent cases", () => {
  const old = live("old", older);
  old.vehicle.plate = "ABC 123";
  const fresh = live("new", newer);
  fresh.vehicle.plate = "abc123";
  assert.deepEqual(ids([old, fresh]), ["new"]);
  assert.deepEqual(ids([old, { ...fresh, dismissed: true }]), ["old"]);
  assert.deepEqual(ids([old, { ...fresh, reporting: { status: "sent", confirmedByUser: true } }]), ["old"]);
});

test("missing, invalid and tied save times are stable and demo ordering is unchanged", () => {
  const unknown = live("unknown");
  const invalid = live("invalid", "not-a-date");
  const first = live("first", newer);
  const tied = live("tied", "2026-10-12T20:00:00+08:00");
  const demo = live("demo", "2099-01-01T00:00:00Z");
  demo.provenance.isDemo = true;
  assert.deepEqual(ids([unknown, first, invalid, tied]), ["first", "tied", "unknown", "invalid"]);
  assert.deepEqual(ids([unknown, demo, first]), ["first", "demo", "unknown"]);
  const olderDemo = { ...demo, id: "demo-old", vehicle: { ...demo.vehicle, plate: "DEMO OLD" }, createdAt: older };
  assert.deepEqual(ids([olderDemo, demo]), ["demo-old", "demo"]);
});

test("editing incident date and persisted GPS defaults never change saved order", () => {
  const old = live("old", older);
  const fresh = live("new", newer);
  const edited = editCase(old, { incident: { ...old.incident, date: "2099-12-31", location: "GPS road" } });
  edited.defaulted = ["date", "location"];
  const restored: RoadCase[] = JSON.parse(JSON.stringify([edited, fresh]));
  assert.deepEqual(ids(restored), ["new", "old"]);
  const merged = mergeCaseHistory(restored, [live("old", older)], [{ reviewId: "old", createdAt: older }]);
  assert.equal(merged[0].incident.date, "2099-12-31");
  assert.deepEqual(merged[0].defaulted, ["date", "location"]);
  assert.deepEqual(ids(merged), ["new", "old"]);
});

test("new live analysis uses completion time only until authoritative save time arrives", () => {
  const result = review("new");
  const record: Incident = {
    id: "old-import", name: "Old footage", file: "file:///old.mp4", mime: "video/mp4", size: 1,
    createdAt: "2020-01-01T00:00:00Z", stage: "ready", result,
    plate: "", location: "", occurredAt: "",
  };
  const completedAt = "2026-10-12T12:00:05Z";
  const [completed] = fromLegacy(record, "MY", completedAt);
  assert.equal(completed.createdAt, completedAt);
  const [refreshed] = fromLegacy(record, "MY");
  assert.equal(refreshed.createdAt, undefined);
  assert.equal(mergeServerCase(completed, refreshed).createdAt, completedAt);
  const [authoritative] = mergeCaseHistory([completed], [], [{ reviewId: "new", createdAt: newer }]);
  assert.equal(authoritative.createdAt, newer);
  result.created_at = newer;
  assert.equal(fromLegacy(record, "MY", completedAt)[0].createdAt, newer);
});

test("legacy split reviews also retain the backend saved timestamp", () => {
  const result = review("legacy", older);
  delete result.case;
  const [c] = fromServerReview(result, "MY");
  assert.equal(c.createdAt, older);
});

test("history reporting updates retain locally sent reports and ignore invalid timestamp replacements", () => {
  const opened = live("opened", older);
  const sent = live("sent", newer);
  sent.reporting = { status: "sent", confirmedByUser: true };
  const merged = mergeCaseHistory([opened, sent], [], [
    { reviewId: "opened", createdAt: older, reportingStatus: "opened" },
    { reviewId: "sent", createdAt: "invalid", reportingStatus: "opened" },
  ]);
  assert.equal(merged[0].reporting.status, "opened");
  assert.equal(merged[1].reporting.status, "sent");
  assert.equal(merged[1].createdAt, newer);
});
