import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Device from "expo-device";
import * as FS from "expo-file-system/legacy";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useStore } from "../lib/store";
import { recordSegments, MIN_FREE_BYTES } from "../lib/dashcam";
import { useRoad } from "./context";
import { duration } from "./model";
import { T, go, showError } from "./ui";
export function Recording() {
  const rr = useRoad(),
    store = useStore(),
    current = useRef(store);
  current.current = store;
  const demo = rr.prefs.demo;
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [ending, setEnding] = useState(false),
    [error, setError] = useState("");
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
            setError(
              "Camera permission is required. Enable it in device Settings.",
            );
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
            return camera.current.recordAsync({
              maxDuration: 60,
              maxFileSize: 80 * 1024 * 1024,
              ...(Platform.OS === "ios" ? { codec: "avc1" as const } : {}),
            });
          },
          save: async (uri, createdAt) => {
            const ext = Platform.OS === "ios" ? "mov" : "mp4";
            const id = await current.current.importVideo(
              uri,
              `Drive ${createdAt}.${ext}`,
              ext === "mov" ? "video/quicktime" : "video/mp4",
              { dashcamSession: session, createdAt, protected: true },
            );
            ids.current.push(id);
            await FS.deleteAsync(uri, { idempotent: true });
            if ((await FS.getFreeDiskStorageAsync()) < MIN_FREE_BYTES)
              fail(
                Error(
                  "Storage is nearly full. Recording stopped; all saved clips are kept.",
                ),
              );
          },
          onError: fail,
        });
        await task.current;
      } catch (e) {
        stop();
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
  const end = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    stop();
    try {
      await task.current;
      await deactivateKeepAwake("road-recording");
      if (demo) {
        go("analysis");
        void rr.begin([], true).catch(showError);
      } else if (ids.current.length) {
        if (!store.settings.token) {
          go("developer");
          showError(
            Error(
              "Recording saved. Add your API token, then analyse the saved clips in Developer.",
            ),
          );
        } else {
          go("analysis");
          void rr.begin(ids.current).catch(showError);
        }
      } else go("home");
    } catch (e) {
      showError(e);
      setEnding(false);
      endingRef.current = false;
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>

      {!demo && Device.isDevice && permission?.granted && (
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
            {"Don’t worry.\nI’ve got your back."}
          </T>
          <T style={{ color: "#9A9EA5", textAlign: "center" }}>Eyes on the road. Gemini reads the clip after you stop.</T>
          {error && (
            <T style={{ color: "#f2b3a0", fontSize: 12, textAlign: "center" }}>
              {error}
            </T>
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
