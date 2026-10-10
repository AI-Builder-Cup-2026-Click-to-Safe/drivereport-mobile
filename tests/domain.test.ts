import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDraft,
  initialSettings,
  parseReview,
  statusLabel,
  timecode,
  validateApiUrl,
  whatsappUrl,
} from "../src/lib/domain.ts";
import type { Incident } from "../src/lib/domain.ts";
const finding = {
  vehicle_id: "v1",
  conduct: "Unsafe lane change",
  legal_basis: "Road Transport Act section cited by backend",
  reasoning: "Visible in the clip",
  confidence: 0.9,
  start_seconds: 3,
  end_seconds: 7,
};
const incident: Incident = {
  id: "DR-TEST",
  name: "clip.mp4",
  file: "file:///clip.mp4",
  mime: "video/mp4",
  size: 123,
  createdAt: "2026-10-04",
  stage: "ready",
  plate: "ABC 123",
  location: "Verified road",
  occurredAt: "3 Oct 2026, 14:35 MYT",
  result: parseReview({
    reportable: [finding],
    verdict: "Review the evidence.",
  }),
};
test("parses actual review contract and preserves no-findings result", () => {
  assert.equal(incident.result?.reportable[0].confidence, 0.9);
  assert.equal(
    parseReview({ reportable: [], verdict: "Nothing reportable." }).reportable
      .length,
    0,
  );
  assert.throws(() => parseReview({ error: "upstream failed" }));
  assert.throws(() =>
    parseReview({ reportable: [{ vehicle_id: "x" }], verdict: "" }),
  );
});
test("keeps malformed confidence finite and flags incomplete reviews", () => {
  const r = parseReview({
    reportable: [{ ...finding, confidence: Infinity }],
    verdict: "",
    follow_up_exhausted: true,
    evidence: { timeline: [null, { event: "Lane change", start_seconds: 3 }] },
  });
  assert.equal(r.reportable[0].confidence, 0);
  assert.equal(r.follow_up_exhausted, true);
  assert.equal(r.evidence.timeline.length, 1);
});
test("preserves the backend case, decision trail and playable HTTPS URLs", () => {
  const serverCase = { id: "RR-ABC12345", vehicle: { plate: "WA 4978 R" } };
  const trail = {
    caseId: "RR-ABC12345",
    excerptVideoUrl: "https://example.com/e.mp4",
  };
  const review = parseReview({
    reportable: [finding],
    verdict: "Review it",
    review_id: "a".repeat(32),
    created_at: "2026-10-09T10:00:00+00:00",
    case: serverCase,
    decision_trail: trail,
    tracks: [{ vehicleTrackId: "v1" }],
    original_video_url: "gs://private/original",
    annotated_video_url: "https://example.com/a.mp4",
    excerpt_video_url: "https://example.com/e.mp4",
  });
  assert.deepEqual(review.case, serverCase);
  assert.deepEqual(review.decision_trail, trail);
  assert.equal(review.review_id, "a".repeat(32));
  assert.equal(review.created_at, "2026-10-09T10:00:00+00:00");
  assert.equal(review.original_video_url, undefined);
  assert.equal(review.annotated_video_url, "https://example.com/a.mp4");
  assert.equal(review.tracks.length, 1);
});
test("requires verified metadata and never inserts inaccessible GCS URLs", () => {
  assert.throws(() => buildDraft({ ...incident, plate: "" }, initialSettings));
  const draft = buildDraft(
    { ...incident, remoteUri: "gs://private-bucket/object" },
    { ...initialSettings, name: "Tester" },
  );
  assert.match(draft, /ABC 123/);
  assert.match(draft, /00:03–00:07/);
  assert.match(draft, /Tester/);
  assert.doesNotMatch(draft, /gs:\/\//);
  assert.throws(() =>
    buildDraft(
      { ...incident, result: parseReview({ reportable: [], verdict: "" }) },
      initialSettings,
    ),
  );
});
test("encodes edited WhatsApp drafts and rejects malformed recipients", () => {
  const url = whatsappUrl("+60 (12) 345-6789", "A&B\n#1");
  assert.equal(url, "whatsapp://send?phone=60123456789&text=A%26B%0A%231");
  assert.throws(() => whatsappUrl("abc", "text"));
});
test("does not claim delivery from opening a draft", () => {
  assert.equal(statusLabel({ ...incident, openedAt: "now" }), "Draft opened");
  assert.equal(
    statusLabel({ ...incident, reportedAt: "now" }),
    "Marked reported",
  );
});
test("requires selecting a vehicle when multiple vehicles have findings", () => {
  const result = parseReview({
    reportable: [
      finding,
      { ...finding, vehicle_id: "v2", conduct: "Second vehicle conduct" },
    ],
    verdict: "",
  });
  assert.throws(() => buildDraft({ ...incident, result }, initialSettings));
  const draft = buildDraft(
    { ...incident, result, selectedVehicleId: "v2" },
    initialSettings,
  );
  assert.match(draft, /Second vehicle conduct/);
  assert.doesNotMatch(draft, /Unsafe lane change/);
});
test("accepts secure API hosts only and formats timestamps", () => {
  assert.equal(validateApiUrl("https://example.com/"), "https://example.com");
  assert.throws(() => validateApiUrl("http://example.com"));
  assert.throws(() => validateApiUrl("https://user:secret@example.com"));
  assert.equal(timecode(65.2), "01:05");
});

test("keeps server cost including zero, without treating missing or invalid cost as free", () => {
  for (const value of [0, 0.03456789]) {
    assert.equal(parseReview({ reportable: [], verdict: "", estimated_ai_cost_usd: value }).estimated_ai_cost_usd, value);
  }
  for (const value of [undefined, null, -1, Infinity, "0.1"]) {
    assert.equal(parseReview({ reportable: [], verdict: "", estimated_ai_cost_usd: value }).estimated_ai_cost_usd, undefined);
  }
});
