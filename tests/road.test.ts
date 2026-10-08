import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { URL } from "node:url";
import {
  correctStatus,
  defaultWhatsAppTestMessage,
  editCase,
  fromLegacy,
  restoreEvidence,
  impact,
  inPeriod,
  missing,
  normalizePlate,
  recipient,
  reportText,
  validation,
  whatsapp,
  whatsappTest,
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
  testRecipient: "60123456789",
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
  assert.equal(recipient(prefs, c), "60123456789");
  const url = whatsapp(c, prefs);
  assert.ok(decodeURIComponent(url).includes("A & B / café?"));
  assert.ok(!reportText(c, prefs).includes("Private name"));
  assert.ok(
    reportText(c, { ...prefs, includePersonal: true }).includes("Private name"),
  );
  assert.ok(reportText(c, prefs).includes("DEMO"));
  c.provenance.isDemo = false;
  assert.equal(recipient(prefs, c), "60134498997");
  c.region = "SG";
  assert.throws(() => whatsapp(c, prefs), /Singapore/);
});

test("demo drafts require an explicit test recipient and never fall back to authority", () => {
  const c = base();
  assert.throws(
    () => whatsapp(c, { ...prefs, testRecipient: "" }),
    /test WhatsApp/,
  );
  assert.ok(whatsapp(c, prefs).startsWith("https://wa.me/60123456789?"));
  assert.ok(
    decodeURIComponent(whatsapp(c, prefs)).includes("Location / Lokasi:"),
  );
});

test("WhatsApp test UI opens a harmless encoded draft to a normalized number", () => {
  const url = whatsappTest("+81 70-1234-5678");
  assert.ok(url.startsWith("https://wa.me/817012345678?text="));
  assert.match(decodeURIComponent(url), /DEMO — TRAFFIC REPORT TEST/);
  assert.match(decodeURIComponent(url), /No real complaint/);
  assert.equal(
    decodeURIComponent(whatsappTest("817012345678", "My editable test")),
    "https://wa.me/817012345678?text=My editable test",
  );
  assert.ok(defaultWhatsAppTestMessage.includes("Running a red light"));
  assert.throws(() => whatsappTest("817012345678", "  "), /test message/);
  assert.throws(() => whatsappTest("070-1234"), /international number/);
});

test("editing facts preserves original model evidence and records user provenance", () => {
  const c = base();
  c.analysis = {
    vehicle: { ...c.vehicle },
    incident: { ...c.incident },
    offences: structuredClone(c.offences),
    timeline: [],
  };
  const original = structuredClone(c.analysis);
  const updated = editCase(c, {
    vehicle: { ...c.vehicle, plate: "USER 2" },
    incident: { ...c.incident, location: "User location" },
  });
  assert.deepEqual(updated.analysis, original);
  assert.deepEqual(updated.edited, ["plate", "location"]);
  assert.equal(updated.vehicle.plate, "USER 2");
  const changedAgain = editCase(updated, {
    reporting: { status: "opened", confirmedByUser: false },
  });
  assert.deepEqual(changedAgain.analysis, original);
  assert.deepEqual(changedAgain.edited, ["plate", "location"]);
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

test("new GCP case contract keeps server IDs, citations, tracks and cited excerpt", () => {
  const id = "RR-ABC12345";
  const i = {
    id: "DR-new-contract",
    file: "file:///local-original.mov",
    thumbnail: "file:///local-thumb.jpg",
    result: {
      review_id: "a".repeat(32),
      verdict: "Report it",
      reportable: [
        {
          vehicle_id: "v1",
          appearance: "White MPV WA 4978 R",
          conduct: "Overtook across double lines",
          start_seconds: 10,
          end_seconds: 14,
          confidence: 0.95,
          legal_basis: "Act 333, section 43(1)",
          penalty: "Fine",
          reasoning: "Visible unsafe pass",
        },
      ],
      follow_up_exhausted: false,
      tracks: [{ vehicleTrackId: "v1", frames: [] }],
      evidence: {
        timeline: [{ start_seconds: 10, end_seconds: 14, event: "Pass" }],
      },
      annotated_video_url: "https://example.com/annotated.mp4",
      excerpt_video_url: "https://example.com/excerpt.mp4",
      case: {
        id,
        version: 1,
        region: "MY",
        vehicle: { plate: "WA 4978 R", type: "White MPV", model: null },
        incident: {
          date: null,
          time: null,
          timeZone: "Asia/Kuala_Lumpur",
          location: null,
          description: "Report it",
        },
        offences: [
          {
            id: `${id}-offence-1`,
            code: "queue_cut",
            label: "Overtook across double lines",
            atSeconds: 10,
            confidence: 0.95,
            included: true,
            lawSources: [
              {
                title: "Road Transport Act 1987",
                section: "Section 43(1)",
                url: "https://example.com/act.pdf",
              },
            ],
          },
        ],
        evidence: {
          durationSeconds: 18,
          originalVideoUrl: "https://example.com/original.mp4",
          annotatedVideoUrl: "https://example.com/annotated.mp4",
          thumbnailUrl: null,
          tracks: [{ vehicleTrackId: "v1", frames: [] }],
          isSynthetic: false,
        },
        reporting: { status: "ready", confirmedByUser: false },
        authorityOutcome: { status: "unknown", source: null, updatedAt: null },
        provenance: {
          isDemo: false,
          factsSource: "gemini_video_analysis",
          legalRetrieval: "rag_act_333",
        },
      },
      decision_trail: {
        excerptVideoUrl: "https://example.com/excerpt.mp4",
        verdict: "Report it",
        offences: [
          {
            offenceId: `${id}-offence-1`,
            observed: "Overtook across double lines",
            reasoning: "Visible unsafe pass",
            legalBasis: "Act 333, section 43(1)",
            penalty: "Fine",
            confidence: 0.95,
            window: { startSeconds: 10, endSeconds: 14 },
          },
        ],
        citations: [
          {
            statute: "Road Transport Act 1987",
            section: "Section 43(1)",
            quote: "A person who drives...",
            penalty: "Fine",
            relevance: 0.9,
          },
        ],
        gaps: ["Rule not retrieved"],
        roundsUsed: 3,
        followUpExhausted: false,
        outstandingQuestions: { video: [], lawyer: [] },
      },
    },
  } as unknown as Incident;
  const [c] = fromLegacy(i, "MY");
  assert.equal(c.id, id);
  assert.equal(c.sourceId, i.id);
  assert.equal(c.reviewId, "a".repeat(32));
  assert.equal(c.evidence.originalVideoUrl, i.file);
  assert.equal(
    c.evidence.annotatedVideoUrl,
    "https://example.com/annotated.mp4",
  );
  assert.equal(c.evidence.excerptVideoUrl, "https://example.com/excerpt.mp4");
  assert.equal(c.offences[0].code, "double_line");
  assert.equal(c.offences[0].reasoning, "Visible unsafe pass");
  assert.equal(c.decisionTrail?.citations[0].quote, "A person who drives...");
  assert.equal(c.reporting.status, "needs_info");
});

test("app updates relink local evidence without changing reviews or remote/demo media", () => {
  const c = base();
  c.provenance.isDemo = false;
  c.sourceId = "source-1";
  c.evidence.originalVideoUrl =
    "file:///old-container/Documents/evidence/source-1.mp4";
  c.evidence.thumbnailUrl =
    "file:///old-container/Documents/evidence/source-1.jpg";
  const source = {
    id: "source-1",
    file: "file:///new-container/Documents/evidence/source-1.mp4",
    thumbnail: "file:///new-container/Documents/evidence/source-1.jpg",
  };
  const updated = restoreEvidence(c, source);
  assert.equal(updated.evidence.originalVideoUrl, source.file);
  assert.equal(updated.evidence.thumbnailUrl, source.thumbnail);
  assert.deepEqual(updated.offences, c.offences);
  assert.deepEqual(updated.reporting, c.reporting);
  assert.deepEqual(updated.incident, c.incident);
  assert.equal(restoreEvidence(c), c);
  assert.equal(restoreEvidence(c, { ...source, id: "other-clip" }), c);
  c.evidence.originalVideoUrl = "https://example.com/signed-video";
  assert.equal(
    restoreEvidence(c, source).evidence.originalVideoUrl,
    c.evidence.originalVideoUrl,
  );
  c.provenance.isDemo = true;
  assert.equal(restoreEvidence(c, source), c);
});

test("submission sample drafts let the tester choose a chat, never default to JPJ", () => {
  const c = base();
  c.provenance.factsSource = "submission_fixture_v1";
  const link = new URL(whatsapp(c, { ...prefs, testRecipient: "" }));
  assert.equal(link.pathname, "/");
  assert.match(link.searchParams.get("text")!, /DEMO/);
  assert.doesNotMatch(link.searchParams.get("text")!, /demerit points/i);
  c.provenance.isDemo = false;
  c.region = "MY";
  assert.equal(new URL(whatsapp(c, prefs)).pathname, "/60134498997");
});
