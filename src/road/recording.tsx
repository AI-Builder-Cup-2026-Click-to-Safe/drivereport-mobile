import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import * as FS from "expo-file-system/legacy";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useStore } from "../lib/store";
import { recordDrive, MIN_FREE_BYTES } from "../lib/dashcam";
import { inspectVideo, prepareSilentVideo } from "../lib/video-preparation";
import { MAX_VIDEO_SECONDS, MAX_CAPTURE_BYTES } from "../lib/video-policy";
import { finishRecording } from "../lib/recording-finalization";
import { useRoad } from "./context";
import { duration } from "./model";
import { C, T, go, notify, showError } from "./ui";
export function Recording() {
  const params = useLocalSearchParams<{ cameraTest?: string; cameraTestSeconds?: string }>();
  const cameraTest = useRef(params.cameraTest === "1").current;
  const cameraTestSeconds = useRef(params.cameraTestSeconds === "65" ? 65 : 5).current;
  const rr = useRoad(),
    store = useStore(),
    current = useRef(store),
    road = useRef(rr);
  current.current = store;
  road.current = rr;
  // Synthetic cases must never replace camera capture on a physical phone.
  const demo = !cameraTest && !Device.isDevice && rr.prefs.demo;
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [ending, setEnding] = useState(false),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false);
  const [saveStage, setSaveStage] = useState("Closing the camera file…");
  const [saveSeconds, setSaveSeconds] = useState(0);
  const [cameraReleased, setCameraReleased] = useState(false);
  const finalizing = useRef(false);
  const saveStageRef = useRef("Closing the camera file");
  const failure = useRef("");
  const capturing = useRef(false);
  const savedCount = useRef(0);
  const trace = useRef<string[]>([]);
  const stopAttempts = useRef(0);
  const logStep = useCallback((step: string) => {
    trace.current = [...trace.current.slice(-39), `${new Date().toISOString()} ${step}`];
  }, []);
  const diagnostics = () => [
    `Click-to-Safe ${Constants.expoConfig?.version || "unknown"} / recording diagnostics v2`,
    `${Device.modelName || "unknown device"} / ${Platform.OS} ${Device.osVersion || "unknown OS"}`,
    `Camera permission: ${permission?.status || "unknown"}; camera ready: ${ready}`,
    `Mode: ${demo ? "demo" : "camera"}; quality: 720p; audio: muted`,
    `Capture callback pending: ${capturing.current}; stop requests: ${stopAttempts.current}`,
    `Elapsed: ${elapsed}s; saved clips: ${savedCount.current}; upload: not started`,
    ...trace.current,
  ].join("\n");
  const wanted = useRef(true),
    started = useRef(false),
    mounted = useRef(true),
    task = useRef<Promise<void> | null>(null),
    ids = useRef<string[]>([]),
    startTime = useRef(0),
    endingRef = useRef(false);
  const permissionRequest = useRef(requestPermission);
  const endAction = useRef<() => void>(() => {});
  const permissionAtMount = useRef(permission?.granted);
  const stop = useCallback(() => {
    wanted.current = false;
    stopAttempts.current += 1;
    camera.current?.stopRecording();
  }, []);
  useEffect(() => {
    mounted.current = true;
    logStep("Recording screen opened");
    if (Device.isDevice && road.current.prefs.demo)
      void road.current.setPrefs({ demo: false }).catch(showError);
    if (!demo && !Device.isDevice) {
      setError(
        "The simulator has no camera. Use Demo dataset in Developer to preview the recording flow.",
      );
      wanted.current = false;
    } else if (!demo && !permissionAtMount.current) {
      void permissionRequest
        .current()
        .then((p) => {
          logStep(`Camera permission: ${p.status}`);
          if (!p.granted) {
            wanted.current = false;
            setBlocked(true);
            setError("Click-to-Safe needs the camera to record. Allow it in Settings.");
          }
        })
        .catch((e: unknown) => {
          wanted.current = false;
          failure.current = e instanceof Error ? e.message : "Camera permission could not be checked.";
          setError(failure.current);
        });
    }
    const sub = AppState.addEventListener("change", (s) => {
      logStep(`App state: ${s}`);
      if (s !== "active" && wanted.current && startTime.current > 0) {
        stop();
        setError(
          "Recording interrupted. Saved clips are kept. End recording to review them.",
        );
      }
    });
    return () => {
      mounted.current = false;
      stop();
      sub.remove();
      void deactivateKeepAwake("road-recording");
    };
  }, [demo, stop, logStep]);
  useEffect(() => {
    if (started.current || !wanted.current || (!demo && !ready)) return;
    started.current = true;
    void (async () => {
      try {
        if (!demo && (await FS.getFreeDiskStorageAsync()) < MIN_FREE_BYTES)
          throw Error("At least 1.1 GiB of free space is needed to record and save a drive.");
        await activateKeepAwakeAsync("road-recording");
        if (!wanted.current) return;
        startTime.current = Date.now();
        if (demo) {
          setReady(true);
          return;
        }
        const session = `road-${Date.now()}`;
        const fail = (e: unknown) => {
          stop();
          failure.current = e instanceof Error ? e.message : "Recording stopped. Saved clips are kept.";
          logStep("Capture or persistence failed");
          if (mounted.current)
            setError(
              e instanceof Error
                ? e.message
                : "Recording stopped. Saved clips are kept.",
            );
        };
        task.current = recordDrive({
          record: async () => {
            if (!camera.current) throw Error("Camera unavailable.");
            capturing.current = true;
            logStep("Requested native video capture");
            try {
              const result = await camera.current.recordAsync({
                maxDuration: MAX_VIDEO_SECONDS - 1,
                maxFileSize: MAX_CAPTURE_BYTES,
                ...(Platform.OS === "ios" ? { codec: "avc1" as const } : {}),
              });
              logStep(result?.uri ? "Native camera returned a video file" : "Native camera returned no file");
              return result;
            } catch (e) {
              logStep("Native camera rejected capture");
              throw e;
            } finally {
              capturing.current = false;
            }
          },
          save: async (uri, createdAt) => {
            logStep("Saving original video to app storage");
            saveStageRef.current = "Saving the video on this device";
            if (mounted.current && !capturing.current)
              setSaveStage("Saving the video on this device…");
            const ext = Platform.OS === "ios" ? "mov" : "mp4";
            const id = await current.current.importVideo(
              uri,
              `Drive ${createdAt}.${ext}`,
              ext === "mov" ? "video/quicktime" : "video/mp4",
              { dashcamSession: session, createdAt, protected: true },
            );
            ids.current.push(id);
            savedCount.current = ids.current.length;
            logStep(`Original video saved; ${savedCount.current} clip(s)`);
            if (mounted.current && finalizing.current) road.current.recordingSaved(id);
            void FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
          },
          onError: fail,
        });
        await task.current;
        // Native duration/size limits finish the same single-file drive. The
        // promise is settled before end() waits for it, preventing a deadlock.
        if (mounted.current && !endingRef.current && !failure.current)
          endAction.current();
      } catch (e) {
        stop();
        failure.current = e instanceof Error ? e.message : "Unable to start recording.";
        logStep("Recording could not start");
        if (mounted.current)
          setError(
            e instanceof Error ? e.message : "Unable to start recording.",
          );
      } finally {
        if (!demo) void deactivateKeepAwake("road-recording");
      }
    })();
  }, [ready, demo, stop, logStep]);
  useEffect(() => {
    if (demo || !permission?.granted || ready || error) return;
    const timer = setTimeout(() => {
      failure.current = "The camera did not become ready. Close other camera apps and try recording again.";
      logStep("Camera readiness timed out");
      stop();
      setError(failure.current);
    }, 15_000);
    return () => clearTimeout(timer);
  }, [demo, permission?.granted, ready, error, logStep, stop]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (startTime.current && wanted.current)
        setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!ending) return;
    const since = Date.now();
    const timer = setInterval(() => setSaveSeconds(Math.floor((Date.now() - since) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [ending]);
  useEffect(() => {
    if (!ending && ((cameraTest && (elapsed >= cameraTestSeconds || error)) || elapsed >= MAX_VIDEO_SECONDS)) endAction.current();
  }, [cameraTest, cameraTestSeconds, elapsed, ending, error]);
  const end = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    finalizing.current = true;
    logStep("End recording pressed");
    try {
      if (!demo && !cameraTest) rr.prepareRecording(ids.current);
      saveStageRef.current = capturing.current ? "Closing the camera file" : "Saving the video on this device";
      setSaveStage(`${saveStageRef.current}…`);
      // Do not push another native screen until the camera's final callback and
      // original-file persistence finish; detaching its view can interrupt them.
      await finishRecording({
        stop,
        pending: task.current,
        timeoutMs: 120_000,
        timeoutMessage: () => `${capturing.current ? "Closing the camera file" : saveStageRef.current} took too long. ${savedCount.current} clip(s) saved. Check Saved recordings before recording again.`,
      });
      finalizing.current = false;
      setCameraReleased(true);
      void deactivateKeepAwake("road-recording");
      if (failure.current) throw new Error(failure.current);
      if (cameraTest) {
        if (!ids.current.length) throw new Error(error || "No camera file was saved.");
        const recorded = current.current.getRecords().find((record) => record.id === ids.current[0]);
        if (!recorded) throw new Error("Saved camera video not found.");
        const video = await inspectVideo(recorded.file);
        const prepared = await prepareSilentVideo(recorded.file, recorded.mime, new AbortController().signal);
        await prepared.cleanup();
        await FS.writeAsStringAsync(`${FS.documentDirectory}camera-check.json`, JSON.stringify({
          status: "saved", sourceIds: ids.current, video, diagnostics: diagnostics(),
        }));
        go("developer", true);
        notify(`Camera check passed. The ${cameraTestSeconds}-second video is saved and ready to upload without audio. Nothing was uploaded.`);
        return;
      }
      if (demo) {
        go("analysis", true);
        void rr.begin([], true).catch(showError);
      } else if (ids.current.length) {
        if (!current.current.settings.token) {
          rr.failRecording(
            "Recording saved. This build isn’t connected to the analysis server yet, so the clips wait here.",
            diagnostics(),
          );
          go("analysis", true);
        } else {
          go("analysis", true);
          void rr.begin(ids.current).catch(showError);
        }
      } else if (!demo) {
        rr.failRecording(
          error || "The camera stopped before a recording could be saved.",
          diagnostics(),
        );
        go("analysis", true);
      } else go("home");
    } catch (e) {
      logStep("Recording finalization failed");
      finalizing.current = false;
      if (mounted.current) setCameraReleased(true);
      void deactivateKeepAwake("road-recording");
      if (cameraTest) {
        await FS.writeAsStringAsync(`${FS.documentDirectory}camera-check.json`, JSON.stringify({
          status: "error", error: e instanceof Error ? e.message : "Camera check failed", diagnostics: diagnostics(),
        })).catch(() => {});
        // Reuse the normal, copyable recording error screen for local checks.
        rr.prepareRecording(ids.current);
      }
      if (!demo)
        rr.failRecording(
          e instanceof Error ? e.message : "Could not save the recording.",
          diagnostics(),
        );
      if (!demo) go("analysis", true);
      else showError(e);
    }
  };
  endAction.current = () => void end();
  useEffect(() => {
    // Android Back saves the drive like End recording instead of tearing the camera down mid-file.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      endAction.current();
      return true;
    });
    return () => sub.remove();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.dark }}>
      {/* Mounted for as long as Recording is, so any way out restores the dark status bar. */}
      <StatusBar style="light" />

      {!cameraReleased && !demo && Device.isDevice && permission?.granted && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="video"
          // A phone on a landscape dash mount records landscape even with Portrait Orientation Lock on.
          responsiveOrientationWhenOrientationLocked
          onResponsiveOrientationChanged={(e) => logStep(`Camera orientation: ${e.orientation}`)}
          mute
          videoQuality="720p"
          videoBitrate={2000000}
          onCameraReady={() => {
            logStep("Camera ready event received");
            setReady(true);
          }}
          onMountError={(e) => {
            logStep("Native camera session error");
            failure.current = e.message;
            stop();
            setError(e.message);
          }}
        />
      )}
      <SafeAreaView
        style={{ flex: 1, backgroundColor: C.dark, paddingHorizontal: 26 }}
      >
        <View style={{ alignItems: "center", paddingTop: 26, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: error ? C.nightMuted : C.live,
              }}
            />
            <T
              accessibilityRole="timer"
              accessibilityLabel={`Recording duration ${duration(elapsed)}`}
              style={{
                color: C.nightText,
                fontVariant: ["tabular-nums"],
                fontSize: 22,
                lineHeight: 28,
              }}
            >
              {duration(elapsed)}
            </T>
          </View>
          {demo && (
            <T style={{ color: C.nightFaint, fontSize: 11 }}>
              Demo recording · no camera capture
            </T>
          )}
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <T
            style={{
              fontSize: 32,
              lineHeight: 36,
              textAlign: "center",
              color: C.nightText,
              fontWeight: "800",
            }}
          >
            {ending ? "Saving your drive" : cameraTest ? "Checking your camera" : "Don’t worry.\nI’ve got your back."}
          </T>
          {ending ? (
            <View style={{ alignItems: "center", gap: 16 }}>
              <ActivityIndicator color={C.nightText} />
              <T accessibilityLiveRegion="polite" style={{ color: C.nightText, textAlign: "center" }}>{saveStage}</T>
              <T style={{ color: C.nightMuted, textAlign: "center" }}>{`${saveSeconds}s · ${savedCount.current} saved clips`}</T>
              <T style={{ color: C.nightMuted, textAlign: "center" }}>{cameraTest ? "Keep the app open. This camera check only saves on your device." : "Keep the app open. Upload starts after saving finishes."}</T>
            </View>
          ) : (
            <T style={{ color: C.nightMuted, textAlign: "center" }}>{cameraTest ? `Records for ${cameraTestSeconds} seconds, then saves on this device. No upload or AI analysis.` : "Up to 30 minutes · one video · no audio. Gemini reads it after you stop."}</T>
          )}
          {error && (
            <T style={{ color: C.nightError, fontSize: 14, lineHeight: 19, textAlign: "center" }}>
              {error}
            </T>
          )}
          {blocked && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
              onPress={() => void Linking.openSettings()}
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: 18,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: C.nightText,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <T style={{ color: C.nightText, fontWeight: "700" }}>Open Settings</T>
            </Pressable>
          )}
          {!demo && !ready && !error && (
            <T style={{ color: C.nightFaint }}>Starting camera…</T>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End recording"
          disabled={ending}
          onPress={() => void end()}
          style={({ pressed }) => ({
            height: 62,
            borderRadius: 999,
            backgroundColor: C.nightText,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            opacity: pressed || ending ? 0.7 : 1,
          })}
        >
          <T style={{ fontWeight: "700" }}>
            {ending ? "Saving recording…" : "End recording"}
          </T>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
