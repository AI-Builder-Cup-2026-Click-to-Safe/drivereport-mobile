import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useVideoPlayer, VideoView } from "expo-video";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as FS from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import {
  Badge,
  Button,
  C,
  Card,
  handleError,
  Icon,
  Notice,
  Screen,
  Txt,
} from "../../components/ui";
import { useStore } from "../../lib/store";
import { findingTitle, Incident, timecode } from "../../lib/domain";
import {
  MIN_FREE_BYTES,
  nextReview,
  recordSegments,
  rotationCandidates,
  SEGMENT_SECONDS,
} from "../../lib/dashcam";

export default function Capture() {
  const store = useStore();
  const currentStore = useRef(store);
  currentStore.current = store;
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [preview, setPreview] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoReview, setAutoReview] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [session, setSession] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(0);
  const [notice, setNotice] = useState("");
  const [alert, setAlert] = useState<Incident>();
  const [reviewEpoch, setReviewEpoch] = useState(0);
  const wanted = useRef(false);
  const starting = useRef(false);
  const mounted = useRef(true);
  const sessionTask = useRef<Promise<void> | null>(null);
  const protectedUntil = useRef(0);
  const scanRef = useRef(false);
  const worker = useRef(false);
  const deleting = useRef(new Set<string>());
  const clockStarted = useRef(0);

  const stop = useCallback((message?: string) => {
    wanted.current = false;
    scanRef.current = false;
    setScanning(false);
    camera.current?.stopRecording();
    if (message) setNotice(message);
  }, []);
  const fail = useCallback(
    (error: unknown) => {
      stop(
        error instanceof Error
          ? error.message
          : "Recording stopped. Check your saved clips in History.",
      );
    },
    [stop],
  );

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && wanted.current)
        stop(
          "Recording stopped because the app left the foreground. Saved clips are in History. Tap Start to resume.",
        );
    });
    return () => {
      mounted.current = false;
      wanted.current = false;
      scanRef.current = false;
      // Camera mounts after this effect; cleanup must use its latest instance.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      camera.current?.stopRecording();
      subscription.remove();
      void deactivateKeepAwake("dashcam");
    };
  }, [stop]);
  useFocusEffect(
    useCallback(
      () => () => {
        stop();
        setShowCamera(false);
        setCameraReady(false);
      },
      [stop],
    ),
  );
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - clockStarted.current) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [recording]);

  // One server review at a time. Capture and disk persistence keep running.
  useEffect(() => {
    if (!scanning || !scanRef.current || worker.current || store.active) return;
    const next = nextReview(
      store.records.filter((i) => !deleting.current.has(i.id)),
      session,
    );
    if (!next) return;
    worker.current = true;
    void currentStore.current
      .analyse(next.id)
      .then((result) => {
        if (!mounted.current) return;
        if (result?.result?.reportable.length) setAlert(result);
        if (result?.stage === "error") {
          scanRef.current = false;
          setScanning(false);
          setNotice(
            "AI review paused after an error. Recording continues locally. Retry the clip in History.",
          );
        }
      })
      .catch((error) => {
        if (mounted.current)
          setNotice(
            error instanceof Error ? error.message : "AI review unavailable.",
          );
        scanRef.current = false;
        setScanning(false);
      })
      .finally(() => {
        worker.current = false;
        if (mounted.current) setReviewEpoch((value) => value + 1);
      });
  }, [store.records, store.active, scanning, session, reviewEpoch]);

  const start = async () => {
    if (!cameraReady || sessionTask.current || starting.current) return;
    starting.current = true;
    wanted.current = true;
    try {
      if ((await FS.getFreeDiskStorageAsync()) < MIN_FREE_BYTES)
        throw new Error(
          "At least 400 MB of free space is needed to start. Free some storage first.",
        );
      await activateKeepAwakeAsync("dashcam");
    } catch (error) {
      starting.current = false;
      wanted.current = false;
      handleError(error);
      return;
    }
    starting.current = false;
    if (!wanted.current || AppState.currentState !== "active") {
      wanted.current = false;
      void deactivateKeepAwake("dashcam");
      return;
    }
    const id = `drive-${Date.now()}`;
    const cloud = autoReview && Boolean(currentStore.current.settings.token);
    setSession(id);
    setSaved(0);
    setElapsed(0);
    setAlert(undefined);
    setNotice(
      cloud
        ? "AI reviews saved clips in order. Results may take several minutes."
        : "Recording locally. Enable cloud analysis in Settings to scan for violations.",
    );
    clockStarted.current = Date.now();
    protectedUntil.current = 0;
    wanted.current = true;
    scanRef.current = cloud;
    setScanning(cloud);
    setRecording(true);
    const task = recordSegments({
      shouldContinue: () => wanted.current,
      record: async () => {
        if (!camera.current)
          throw new Error("Camera unavailable. Saved clips are in History.");
        return camera.current.recordAsync({
          maxDuration: SEGMENT_SECONDS,
          maxFileSize: 80 * 1024 * 1024,
          ...(Platform.OS === "ios" ? { codec: "avc1" as const } : {}),
        });
      },
      save: async (uri, startedAt) => {
        const protect = Date.parse(startedAt) <= protectedUntil.current;
        const ext = Platform.OS === "ios" ? "mov" : "mp4";
        await currentStore.current.importVideo(
          uri,
          `Drive · ${new Date(startedAt).toLocaleTimeString()}.${ext}`,
          ext === "mov" ? "video/quicktime" : "video/mp4",
          { dashcamSession: id, createdAt: startedAt, protected: protect },
        );
        await FS.deleteAsync(uri, { idempotent: true });
        if (mounted.current) setSaved((value) => value + 1);
        const candidates = rotationCandidates(
          currentStore.current.getRecords(),
        );
        candidates.forEach((key) => deleting.current.add(key));
        try {
          for (const key of candidates) {
            // Re-evaluate after async work: a user or review may have protected it.
            if (
              rotationCandidates(currentStore.current.getRecords()).includes(
                key,
              )
            )
              await currentStore.current.remove(key);
          }
        } finally {
          candidates.forEach((key) => deleting.current.delete(key));
        }
        if ((await FS.getFreeDiskStorageAsync()) < MIN_FREE_BYTES)
          fail(
            new Error(
              "Recording stopped: storage is nearly full. Protected evidence has been kept.",
            ),
          );
      },
      onError: fail,
    });
    sessionTask.current = task;
    try {
      await task;
    } finally {
      sessionTask.current = null;
      wanted.current = false;
      scanRef.current = false;
      void deactivateKeepAwake("dashcam");
      if (mounted.current) {
        setRecording(false);
        setScanning(false);
      }
    }
  };
  const close = async () => {
    stop();
    await sessionTask.current;
    setShowCamera(false);
    setCameraReady(false);
  };
  const saveMoment = async () => {
    protectedUntil.current = Date.now() + SEGMENT_SECONDS * 1000;
    const recent = currentStore.current
      .getRecords()
      .filter((i) => i.dashcamSession === session)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (recent)
      await currentStore.current.update(recent.id, { protected: true });
    setNotice(
      "Moment protected: previous clip, current clip and the next minute will be kept.",
    );
  };
  const open = async (task: () => Promise<string | undefined>) => {
    setBusy(true);
    try {
      const id = await task();
      if (id) router.push(`/evidence/${id}`);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };
  const pending = store.records.filter(
    (i) => i.dashcamSession === session && i.stage === "queued",
  ).length;
  const finding = alert?.result?.reportable[0];
  const status = store.active
    ? store.records.find((i) => i.id === store.active)?.stage === "uploading"
      ? `UPLOADING · ${Math.round(store.progress * 100)}%`
      : "AI REVIEW IN PROGRESS"
    : scanning
      ? `AI SCAN ACTIVE · ${pending} WAITING`
      : "LOCAL RECORDING";

  return (
    <>
      <Screen
        title="Active Dashcam"
        subtitle="RECORD YOUR DRIVE. PRESERVE THE EVIDENCE."
        right={<Badge text="STANDBY" />}
      >
        <Card style={{ alignItems: "center", paddingVertical: 30 }}>
          <View style={styles.cameraIcon}>
            <Icon name="videocam-outline" size={46} />
          </View>
          <Txt style={{ fontSize: 23, fontWeight: "800" }}>
            Your drive, covered.
          </Txt>
          <Txt muted style={{ textAlign: "center", lineHeight: 22 }}>
            Keep recording until you stop.{"\n"}Save important moments without
            ending your drive.
          </Txt>
          <Button
            title="Open dashcam"
            icon="camera-outline"
            disabled={busy || !store.ready || Boolean(store.error)}
            onPress={() => {
              void (async () => {
                const p = permission?.granted
                  ? permission
                  : await requestPermission();
                if (!p.granted)
                  throw new Error(
                    "Allow camera access in device Settings, or import a video below.",
                  );
                setCameraReady(false);
                setPreview(false);
                setShowCamera(true);
              })().catch(handleError);
            }}
          />
          <Button
            title="Preview dashcam UI"
            kind="outline"
            icon="play-circle-outline"
            onPress={() => {
              setPreview(true);
              setAlert(undefined);
              setNotice(
                "Sample footage only. Saved findings are previous analysis results, not detections from this preview.",
              );
              setShowCamera(true);
            }}
          />
        </Card>
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: "700" }}>Scan while recording</Txt>
              <Txt muted style={{ fontSize: 12 }}>
                Upload saved clips for cloud AI review
              </Txt>
            </View>
            <Switch
              accessibilityLabel="Scan while recording"
              value={autoReview}
              onValueChange={setAutoReview}
              trackColor={{ true: "#087c86" }}
            />
          </View>
          <Txt muted style={{ fontSize: 12, lineHeight: 19 }}>
            Results arrive after analysis, not instantly. Recording continues
            while the server reviews footage. Each scan uses mobile data or
            Wi-Fi.
          </Txt>
        </Card>
        <Notice>
          Keep this screen open. Locking the phone or switching apps stops
          recording. Older unprotected clips rotate out after 15 clips or 500
          MB, including clips not yet reviewed. Saved moments and detected
          incidents are kept.
        </Notice>
        <Card>
          <Txt style={{ fontWeight: "700" }}>Already have dashcam footage?</Txt>
          <Button
            title="Choose from Photos"
            icon="images-outline"
            busy={busy}
            onPress={() =>
              void open(async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["videos"],
                  allowsEditing: false,
                  quality: 1,
                });
                if (result.canceled) return;
                const a = result.assets[0];
                return store.importVideo(
                  a.uri,
                  a.fileName ??
                    `video.${a.uri.toLowerCase().includes(".mov") ? "mov" : "mp4"}`,
                  a.mimeType,
                );
              })
            }
          />
          <Button
            title="Import from Files"
            icon="folder-open-outline"
            kind="outline"
            disabled={busy}
            onPress={() =>
              void open(async () => {
                const result = await DocumentPicker.getDocumentAsync({
                  type: "video/*",
                  copyToCacheDirectory: true,
                });
                if (result.canceled) return;
                const a = result.assets[0];
                return store.importVideo(a.uri, a.name, a.mimeType);
              })
            }
          />
          <Txt muted style={{ fontSize: 11 }}>
            MP4, MOV, WebM or MPEG · up to 500 MB / 10 minutes per imported clip
          </Txt>
        </Card>
        <Button
          title="Try a 12-second sample clip"
          icon="play-circle-outline"
          kind="outline"
          disabled={busy}
          onPress={() => void open(store.importSample)}
        />
        {notice ? <Notice>{notice}</Notice> : null}
      </Screen>
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => void close()}
      >
        <SafeAreaProvider style={styles.cameraRoot}>
          {showCamera && preview ? <DashcamPreview /> : null}
          {showCamera && permission?.granted && !preview ? (
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              mode="video"
              facing="back"
              mute
              videoQuality="720p"
              videoBitrate={2_000_000}
              onCameraReady={() => setCameraReady(true)}
              onMountError={(error) => {
                setCameraReady(false);
                fail(new Error(error.message));
              }}
            />
          ) : null}
          <SafeAreaView style={styles.overlay}>
            <View style={styles.row}>
              <View style={styles.recordBadge}>
                <Txt
                  style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}
                >
                  <Txt style={{ color: recording ? "#ff493c" : C.muted }}>
                    ●{" "}
                  </Txt>
                  {preview
                    ? "SAMPLE PREVIEW"
                    : recording
                      ? `REC ${timecode(elapsed)}`
                      : "READY TO RECORD"}
                </Txt>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dashcam"
                style={styles.close}
                onPress={() => void close()}
              >
                <Icon name="close" color={C.white} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }} />
            {finding && alert ? (
              <View style={styles.violation}>
                <View style={styles.row}>
                  <Txt
                    style={{ color: C.amber, fontSize: 11, fontWeight: "800" }}
                  >
                    ● POTENTIAL VIOLATION
                  </Txt>
                  <Txt style={{ color: C.cyan, fontSize: 11 }}>
                    Confidence: {Math.round(finding.confidence * 100)}%
                  </Txt>
                </View>
                <Txt style={{ fontSize: 22, fontWeight: "800" }}>
                  {findingTitle(finding)}
                </Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {finding.appearance || finding.vehicle_id}
                </Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  Recorded {new Date(alert.createdAt).toLocaleTimeString()} ·{" "}
                  {timecode(finding.start_seconds)}–
                  {timecode(finding.end_seconds)}
                </Txt>
                <Txt muted style={{ fontSize: 11 }}>
                  Evidence protected. Verify the finding before preparing a
                  report.
                </Txt>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Dismiss"
                      kind="outline"
                      onPress={() => setAlert(undefined)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Stop & review"
                      kind="green"
                      onPress={() => {
                        const id = alert.id;
                        void close()
                          .then(() => router.push(`/evidence/${id}`))
                          .catch(handleError);
                      }}
                    />
                  </View>
                </View>
              </View>
            ) : null}
            <View style={styles.bottom}>
              <View style={styles.status}>
                <Icon
                  name={scanning ? "pulse" : "shield-checkmark-outline"}
                  size={16}
                />
                <Txt style={{ color: C.cyan, fontSize: 11, fontWeight: "700" }}>
                  {preview
                    ? "SAMPLE FOOTAGE · PREVIEW"
                    : recording
                      ? status
                      : "DASHCAM STANDBY"}
                </Txt>
              </View>
              <Txt
                style={{ color: "#d4dfe7", textAlign: "center", fontSize: 11 }}
              >
                {saved} clips saved · {pending} awaiting review · Audio off
              </Txt>
              {notice ? (
                <Txt
                  style={{ textAlign: "center", fontSize: 12, lineHeight: 17 }}
                >
                  {notice}
                </Txt>
              ) : null}
              {recording ? (
                <Button
                  title="Save moment"
                  icon="bookmark-outline"
                  kind="outline"
                  onPress={() => void saveMoment().catch(handleError)}
                />
              ) : null}
              <Button
                title={
                  preview
                    ? "Show saved finding"
                    : recording
                      ? "STOP SCANNING"
                      : cameraReady
                        ? "START RECORDING"
                        : "Starting camera…"
                }
                icon={recording ? "stop" : "radio-button-on"}
                kind={recording ? "danger" : "primary"}
                disabled={
                  preview
                    ? !store.records.some((i) => i.result?.reportable.length)
                    : !cameraReady || (!recording && busy)
                }
                onPress={() => {
                  if (preview)
                    setAlert(
                      store.records.find((i) => i.result?.reportable.length),
                    );
                  else if (recording)
                    stop("Drive ended. Your saved clips are in History.");
                  else void start();
                }}
              />
              <Txt muted style={{ textAlign: "center", fontSize: 10 }}>
                Keep the app open · Clips rotate every minute · Brief gaps may
                occur between clips
              </Txt>
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cameraIcon: { padding: 25, borderRadius: 60, backgroundColor: "#102e38" },
  cameraRoot: { flex: 1, backgroundColor: "#05090d" },
  overlay: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  recordBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#090f17c9",
    borderWidth: 1,
    borderColor: "#ff574d",
  },
  close: { padding: 10, borderRadius: 25, backgroundColor: "#090f17c9" },
  bottom: {
    backgroundColor: "#060c13dd",
    marginHorizontal: -20,
    padding: 20,
    gap: 10,
  },
  status: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.cyan,
    borderRadius: 30,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  violation: {
    backgroundColor: "#0a1019ee",
    borderColor: "#ffaa00",
    borderWidth: 2,
    borderRadius: 20,
    padding: 18,
    gap: 10,
    marginBottom: 15,
  },
});

function DashcamPreview() {
  const player = useVideoPlayer(
    require("../../../assets/sample-drive.mp4"),
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    },
  );
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}
