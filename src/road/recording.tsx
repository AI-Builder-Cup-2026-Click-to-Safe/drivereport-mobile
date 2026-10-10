import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Device from "expo-device";
import * as FS from "expo-file-system/legacy";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useStore } from "../lib/store";
import { recordSegments, MIN_FREE_BYTES } from "../lib/dashcam";
import { finishRecording } from "../lib/recording-finalization";
import { useRoad } from "./context";
import { duration } from "./model";
import { T, go, showError } from "./ui";
export function Recording() {
  const rr = useRoad(),
    store = useStore(),
    current = useRef(store),
    road = useRef(rr);
  current.current = store;
  road.current = rr;
  const demo = rr.prefs.demo;
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
  const wanted = useRef(true),
    started = useRef(false),
    mounted = useRef(true),
    task = useRef<Promise<void> | null>(null),
    ids = useRef<string[]>([]),
    startTime = useRef(0),
    endingRef = useRef(false);
  const permissionRequest = useRef(requestPermission);
  const permissionAtMount = useRef(permission?.granted);
  const stop = useCallback(() => {
    wanted.current = false;
    camera.current?.stopRecording();
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (!demo && !Device.isDevice) {
      setError(
        "The simulator has no camera. Use Demo dataset in Developer to preview the recording flow.",
      );
      wanted.current = false;
    } else if (!demo && !permissionAtMount.current) {
      void permissionRequest
        .current()
        .then((p) => {
          if (!p.granted) {
            wanted.current = false;
            setBlocked(true);
            setError("Click-to-Safe needs the camera to record. Allow it in Settings.");
          }
        })
        .catch(showError);
    }
    const sub = AppState.addEventListener("change", (s) => {
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
  }, [demo, stop]);
  useEffect(() => {
    if (started.current || !wanted.current || (!demo && !ready)) return;
    started.current = true;
    void (async () => {
      try {
        if (!demo && (await FS.getFreeDiskStorageAsync()) < MIN_FREE_BYTES)
          throw Error("At least 400 MB of free space is needed.");
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
          if (mounted.current)
            setError(
              e instanceof Error
                ? e.message
                : "Recording stopped. Saved clips are kept.",
            );
        };
        task.current = recordSegments({
          shouldContinue: () => wanted.current,
          record: async () => {
            if (!camera.current) throw Error("Camera unavailable.");
            capturing.current = true;
            try {
              return await camera.current.recordAsync({
                maxDuration: 60,
                maxFileSize: 80 * 1024 * 1024,
                ...(Platform.OS === "ios" ? { codec: "avc1" as const } : {}),
              });
            } finally {
              capturing.current = false;
            }
          },
          save: async (uri, createdAt) => {
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
            if (mounted.current && finalizing.current) road.current.recordingSaved(id);
            // Cleanup and a space check must not block the final saved clip.
            void FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
            if (wanted.current)
              void FS.getFreeDiskStorageAsync().then((free) => {
                if (wanted.current && free < MIN_FREE_BYTES)
                  fail(new Error("Storage is nearly full. Recording stopped; all saved clips are kept."));
              }).catch(fail);
          },
          onError: fail,
        });
        await task.current;
      } catch (e) {
        stop();
        failure.current = e instanceof Error ? e.message : "Unable to start recording.";
        if (mounted.current)
          setError(
            e instanceof Error ? e.message : "Unable to start recording.",
          );
      } finally {
        if (!demo) void deactivateKeepAwake("road-recording");
      }
    })();
  }, [ready, demo, stop]);
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
  const end = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    finalizing.current = true;
    try {
      if (!demo) rr.prepareRecording(ids.current);
      saveStageRef.current = capturing.current ? "Closing the camera file" : "Saving the video on this device";
      setSaveStage(`${saveStageRef.current}…`);
      // Do not push another native screen until the camera's final callback and
      // original-file persistence finish; detaching its view can interrupt them.
      await finishRecording({
        stop,
        pending: task.current,
        timeoutMessage: () => `${capturing.current ? "Closing the camera file" : saveStageRef.current} took too long. ${savedCount.current} clip(s) saved. Check Saved recordings before recording again.`,
      });
      finalizing.current = false;
      setCameraReleased(true);
      void deactivateKeepAwake("road-recording");
      if (failure.current) throw new Error(failure.current);
      if (demo) {
        go("analysis", true);
        void rr.begin([], true).catch(showError);
      } else if (ids.current.length) {
        if (!current.current.settings.token) {
          rr.failRecording(
            "Recording saved. This build isn’t connected to the analysis server yet, so the clips wait here.",
          );
          go("analysis", true);
        } else {
          go("analysis", true);
          void rr.begin(ids.current).catch(showError);
        }
      } else if (!demo) {
        rr.failRecording(
          error || "The camera stopped before a recording could be saved.",
        );
        go("analysis", true);
      } else go("home");
    } catch (e) {
      finalizing.current = false;
      if (mounted.current) setCameraReleased(true);
      void deactivateKeepAwake("road-recording");
      if (!demo)
        rr.failRecording(
          e instanceof Error ? e.message : "Could not save the recording.",
        );
      if (!demo) go("analysis", true);
      else showError(e);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>

      {!cameraReleased && !demo && Device.isDevice && permission?.granted && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="video"
          mute
          videoQuality="720p"
          videoBitrate={2000000}
          onCameraReady={() => setReady(true)}
          onMountError={(e) => {
            stop();
            setError(e.message);
          }}
        />
      )}
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#000", paddingHorizontal: 26 }}
      >
        <View style={{ alignItems: "center", paddingTop: 26, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: error ? "#9A9EA5" : "#FF4B4B",
              }}
            />
            <T
              accessibilityLabel="Recording duration"
              style={{
                color: "#eeeae4",
                fontVariant: ["tabular-nums"],
                fontSize: 22,
                lineHeight: 28,
              }}
            >
              {duration(elapsed)}
            </T>
          </View>
          {demo && (
            <T style={{ color: "#a7a1aa", fontSize: 11 }}>
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
              color: "#eeeae4",
              fontWeight: "800",
            }}
          >
            {ending ? "Saving your drive" : "Don’t worry.\nI’ve got your back."}
          </T>
          {ending ? (
            <View style={{ alignItems: "center", gap: 16 }}>
              <ActivityIndicator color="#eeeae4" />
              <T accessibilityLiveRegion="polite" style={{ color: "#eeeae4", textAlign: "center" }}>{saveStage}</T>
              <T style={{ color: "#9A9EA5", textAlign: "center" }}>{`${saveSeconds}s · ${savedCount.current} saved clips`}</T>
              <T style={{ color: "#9A9EA5", textAlign: "center" }}>Keep the app open. Upload starts after saving finishes.</T>
            </View>
          ) : (
            <T style={{ color: "#9A9EA5", textAlign: "center" }}>Eyes on the road. Gemini reads the clip after you stop.</T>
          )}
          {error && (
            <T style={{ color: "#f2b3a0", fontSize: 14, lineHeight: 19, textAlign: "center" }}>
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
                borderColor: "#eeeae4",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <T style={{ color: "#eeeae4", fontWeight: "700" }}>Open Settings</T>
            </Pressable>
          )}
          {!demo && !ready && !error && (
            <T style={{ color: "#a7a1aa" }}>Starting camera…</T>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End recording"
          disabled={ending}
          onPress={() => void end()}
          style={{
            height: 62,
            borderRadius: 999,
            backgroundColor: "#eeeae4",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <T style={{ fontWeight: "700" }}>
            {ending ? "Saving recording…" : "End recording"}
          </T>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
