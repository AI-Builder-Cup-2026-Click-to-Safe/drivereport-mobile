import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { patchSession, patchView, patchRecording } = require("../plugins/withCameraReadiness.js");
const native = join(dirname(require.resolve("expo-camera/package.json")), "ios", "Current");

test("camera startup stays on the session queue before the ready event", () => {
  const source = readFileSync(join(native, "CameraSessionManager.swift"), "utf8");
  const patched = patchSession(source);
  const activate = patched.slice(patched.indexOf("  func updateCameraIsActive()"), patched.indexOf("  func setCameraMode()"));
  assert.doesNotMatch(activate, /sessionQueue\.async/);
  assert.match(activate, /session\.startRunning\(\)/);
  const startup = patched.slice(patched.indexOf("  private func startSession()"));
  assert.ok(startup.indexOf("updateCameraIsActive()") < startup.indexOf("onCameraReady()"));
  assert.equal(patchSession(patched), patched);
});

test("recording waits for configuration and rejects an idle or busy camera", () => {
  const view = patchView(readFileSync(join(native, "CameraView.swift"), "utf8"));
  const recording = patchRecording(readFileSync(join(native, "CameraVideoRecording.swift"), "utf8"));
  assert.ok(view.indexOf("continuation.resume()") < view.indexOf("await videoRecording.record"));
  assert.match(view, /ERR_CAMERA_SESSION_IDLE/);
  assert.match(recording, /ERR_CAMERA_RECORDING_BUSY/);
  assert.equal(patchView(view), view);
  assert.equal(patchRecording(recording), recording);
});

test("an incompatible native implementation fails prebuild instead of silently skipping the fix", () => {
  for (const patch of [patchSession, patchView, patchRecording])
    assert.throws(() => patch("an unfamiliar camera implementation"), /source changed/);
});
