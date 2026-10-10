const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

// SDK 54 emits onCameraReady before its queued startRunning has completed.
// Keep this narrow backport version-checked so upgrading Expo cannot silently
// apply it to a different camera implementation.
const marker = "// click-to-safe: camera readiness v1";
function replaceOnce(source, before, after) {
  if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before))
    throw new Error("expo-camera source changed; review the camera readiness patch.");
  return source.replace(before, after);
}

function patchSession(source) {
  if (source.includes(marker)) return source;
  return replaceOnce(source, `    delegate.sessionQueue.async {
      if delegate.active {
        if !self.session.isRunning {
          self.session.startRunning()
        }
      } else {
        self.session.stopRunning()
      }
    }
  }

  func setCameraMode()`, `    ${marker}
    // Both callers are already on sessionQueue. Enqueuing again let readiness
    // overtake camera startup, allowing recordAsync to run on an idle session.
    if delegate.active {
      if !session.isRunning {
        session.startRunning()
      }
    } else {
      session.stopRunning()
    }
  }

  func setCameraMode()`);
}

function patchView(source) {
  if (source.includes(marker)) return source;
  return replaceOnce(source,
    "  func record(options: CameraRecordingOptions, promise: Promise) async {\n",
    `  func record(options: CameraRecordingOptions, promise: Promise) async {
    ${marker}
    // Drain pending configuration before inspecting the recording output.
    await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
      sessionQueue.async { continuation.resume() }
    }
    guard session.isRunning else {
      promise.reject("ERR_CAMERA_SESSION_IDLE", "The camera session has not started. Try recording again.")
      return
    }
    NSLog("[ClickToSafeCamera] record requested; session running")
`);
}

function patchRecording(source) {
  if (source.includes(marker)) return source;
  let result = replaceOnce(source,
    "    guard !videoFileOutput.isRecording && videoRecordedPromise == nil else {\n      return\n    }",
    `    ${marker}
    guard !videoFileOutput.isRecording && videoRecordedPromise == nil else {
      promise.reject("ERR_CAMERA_RECORDING_BUSY", "A camera recording is already in progress.")
      return
    }
    NSLog("[ClickToSafeCamera] configuring video output")`);
  result = replaceOnce(result,
    "    videoFileOutput.startRecording(to: fileUrl, recordingDelegate: self)",
    `    NSLog("[ClickToSafeCamera] starting movie file")
    videoFileOutput.startRecording(to: fileUrl, recordingDelegate: self)`);
  result = replaceOnce(result,
    "    videoFileOutput?.stopRecording()",
    `    NSLog("[ClickToSafeCamera] stop requested; isRecording=%d", videoFileOutput?.isRecording == true ? 1 : 0)
    videoFileOutput?.stopRecording()`);
  return replaceOnce(result,
    "    var success = true",
    `    NSLog("[ClickToSafeCamera] finished movie file; error=%ld", (error as NSError?)?.code ?? 0)
    var success = true`);
}

function applyCameraPatch(root) {
  const packageFile = require.resolve("expo-camera/package.json", { paths: [root] });
  const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  if (pkg.version !== "17.0.10")
    throw new Error(`Review withCameraReadiness for expo-camera ${pkg.version}.`);
  const dir = path.join(path.dirname(packageFile), "ios", "Current");
  const patches = [
    ["CameraSessionManager.swift", patchSession],
    ["CameraView.swift", patchView],
    ["CameraVideoRecording.swift", patchRecording],
  ].map(([name, patch]) => {
    const file = path.join(dir, name);
    return [file, patch(fs.readFileSync(file, "utf8"))];
  });
  for (const [file, contents] of patches) fs.writeFileSync(file, contents);
}

module.exports = (config) => withDangerousMod(config, ["ios", async (config) => {
  applyCameraPatch(config.modRequest.projectRoot);
  return config;
}]);
module.exports.patchSession = patchSession;
module.exports.patchView = patchView;
module.exports.patchRecording = patchRecording;
module.exports.applyCameraPatch = applyCameraPatch;
