import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedFootageSeek, footageState, initialFootageState, initialReviewSeek } from "../src/road/footage-state.ts";

const clip = {
  provenance: { isDemo: false }, vehicle: { plate: "TEST123" },
  evidence: { durationSeconds: 3 },
  offences: [{ included: false, atSeconds: 1 }, { included: true, atSeconds: 2 }],
};

test("live clips start at the first included offence, not the demo's twelve-second mark", () => {
  assert.equal(initialReviewSeek(clip), 2);
  assert.equal(initialReviewSeek({ ...clip, vehicle: { plate: null } }), 2);
  assert.equal(initialReviewSeek({ ...clip, offences: [] }), 0);
  assert.equal(initialReviewSeek({ ...clip, offences: [{ included: false, atSeconds: 1 }] }), 0);
  assert.equal(initialReviewSeek({ ...clip, offences: [{ included: true, atSeconds: 12 }] }), 2.9);
});

test("seek requests never reach the end of a short original or annotated stream", () => {
  for (const requested of [3, 12, 20, 100]) assert.equal(boundedFootageSeek(requested, 3), 2.9);
  assert.equal(boundedFootageSeek(12, 12), 11.9);
  assert.equal(boundedFootageSeek(2, 3), 2);
  assert.equal(boundedFootageSeek(1, 0.05), 0);
});

test("invalid offence timestamps start at zero and unknown duration remains finite", () => {
  for (const atSeconds of [-1, NaN, Infinity, -Infinity]) {
    assert.equal(initialReviewSeek({ ...clip, offences: [{ included: true, atSeconds }] }), 0);
    assert.equal(boundedFootageSeek(atSeconds, NaN), 0);
  }
  for (const duration of [0, -1, NaN, Infinity]) assert.equal(boundedFootageSeek(2, duration), 2);
});

test("demo cases retain their authored twelve- and twenty-second starting positions", () => {
  const demo = { ...clip, provenance: { isDemo: true } };
  assert.equal(initialReviewSeek(demo), 12);
  assert.equal(initialReviewSeek({ ...demo, vehicle: { plate: null } }), 20);
});

test("cached first frame becomes ready without flashing the grace-period loader", () => {
  let state = initialFootageState();
  state = footageState(state, { type: "status", status: "readyToPlay" });
  assert.equal(state.phase, "loading", "AVPlayer buffer readiness is not visible-frame readiness");
  state = footageState(state, { type: "frame" });
  assert.equal(state.phase, "ready");
  assert.equal(state.showLoader, false);
  assert.equal(footageState(state, { type: "grace" }), state);
});

test("frame and buffer notifications may arrive in either order", () => {
  let state = footageState(initialFootageState(), { type: "frame" });
  assert.equal(state.phase, "loading");
  state = footageState(state, { type: "status", status: "readyToPlay" });
  assert.equal(state.phase, "ready");
});

test("slow load survives repeated status events and reveals only once ready", () => {
  let state = footageState(initialFootageState(), { type: "grace" });
  for (let i = 0; i < 4; i++) state = footageState(state, { type: "status", status: "loading" });
  assert.equal(state.showLoader, true);
  state = footageState(state, { type: "frame" });
  assert.equal(state.phase, "loading");
  state = footageState(state, { type: "status", status: "readyToPlay" });
  assert.equal(state.phase, "ready");
  assert.equal(state.showLoader, true, "slow loads retain the reveal animation marker");
});

test("buffering uses a fresh grace period but needs no second first-frame event", () => {
  let state = footageState(initialFootageState(), { type: "frame" });
  state = footageState(state, { type: "status", status: "readyToPlay" });
  state = footageState(state, { type: "status", status: "loading" });
  assert.equal(state.phase, "loading");
  assert.equal(state.showLoader, false);
  state = footageState(state, { type: "grace" });
  state = footageState(state, { type: "status", status: "readyToPlay" });
  assert.equal(state.phase, "ready");
});

test("a failed or timed-out load stays failed through late native callbacks", () => {
  for (const failure of [{ type: "failed" }, { type: "status", status: "error" }] as const) {
    const failed = footageState(initialFootageState(), failure);
    assert.equal(failed.phase, "failed");
    assert.equal(failed.showLoader, false);
    for (const event of [{ type: "frame" }, { type: "status", status: "readyToPlay" }, { type: "grace" }] as const)
      assert.equal(footageState(failed, event), failed);
    const retry = footageState(failed, { type: "retry" });
    assert.deepEqual(retry, initialFootageState());
  }
});
