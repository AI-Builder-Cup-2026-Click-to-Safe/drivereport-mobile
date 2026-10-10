import { test } from "node:test";
import assert from "node:assert/strict";
import { finishRecording } from "../src/lib/recording-finalization.ts";

test("waits for the camera AND final write before continuing to upload", async () => {
  let releaseCamera!: () => void;
  let releaseDisk!: () => void;
  const camera = new Promise<void>((resolve) => { releaseCamera = resolve; });
  const disk = new Promise<void>((resolve) => { releaseDisk = resolve; });
  const events: string[] = [];
  const pending = (async () => {
    await camera;
    events.push("camera closed");
    await disk;
    events.push("original saved");
  })();
  const finished = finishRecording({
    stop: () => releaseCamera(), pending,
    timeoutMessage: () => "timeout", timeoutMs: 1000,
  }).then(() => events.push("upload"));
  await camera;
  assert.deepEqual(events, ["camera closed"]);
  releaseDisk();
  await finished;
  assert.deepEqual(events, ["camera closed", "original saved", "upload"]);
});

test("retries stop if the first request arrived before native capture started", async () => {
  let finish!: () => void;
  let stops = 0;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  await finishRecording({
    stop: () => { if (++stops === 2) finish(); },
    pending, retryMs: 5, timeoutMs: 1000, timeoutMessage: () => "timeout",
  });
  assert.equal(stops, 2);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(stops, 2, "stop timer is removed after success");
});

test("a missing native callback times out instead of leaving saving active forever", async () => {
  let lateFinish!: () => void;
  let uploaded = false;
  const pending = new Promise<void>((resolve) => { lateFinish = resolve; });
  const finished = finishRecording({
    stop: () => {}, pending, timeoutMs: 10,
    timeoutMessage: () => "Closing the camera file took too long",
  }).then(() => { uploaded = true; });
  await assert.rejects(finished, /Closing the camera file took too long/);
  lateFinish();
  await pending;
  assert.equal(uploaded, false, "late completion does not start upload after timeout");
});

test("uses the current stage when a disk write stalls", async () => {
  let stage = "camera";
  const pending = Promise.resolve().then(() => {
    stage = "local storage";
    return new Promise<void>(() => {});
  });
  await assert.rejects(finishRecording({
    stop: () => {}, pending, timeoutMs: 10,
    timeoutMessage: () => `${stage} timed out`,
  }), /local storage timed out/);
});

test("an idle camera finishes and errors are propagated", async () => {
  await finishRecording({ stop: () => {}, pending: null, timeoutMessage: () => "timeout" });
  await assert.rejects(finishRecording({
    stop: () => {}, pending: Promise.reject(new Error("disk full")),
    timeoutMessage: () => "timeout",
  }), /disk full/);
});
