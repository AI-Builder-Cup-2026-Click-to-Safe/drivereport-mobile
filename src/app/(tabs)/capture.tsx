import { useCallback, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
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
export default function Capture() {
  const store = useStore(),
    camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false),
    [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [cameraReady, setCameraReady] = useState(false);
  useFocusEffect(
    useCallback(
      () => () => {
        camera.current?.stopRecording();
        setShowCamera(false);
        setCameraReady(false);
      },
      [],
    ),
  );
  const open = async (task: () => Promise<string | undefined>) => {
    setBusy(true);
    try {
      const id = await task();
      if (id) router.push(`/evidence/${id}`);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };
  const pickFile = () =>
    open(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: "video/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const a = result.assets[0];
      return store.importVideo(a.uri, a.name, a.mimeType);
    });
  const pickLibrary = () =>
    open(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: true,
        videoMaxDuration: 60,
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
    });
  const record = async () => {
    if (recording) {
      camera.current?.stopRecording();
      return;
    }
    setRecording(true);
    try {
      const result = await camera.current?.recordAsync({
        maxDuration: 60,
        maxFileSize: 100 * 1024 * 1024,
      });
      if (result)
        await open(() =>
          store.importVideo(
            result.uri,
            Platform.OS === "ios"
              ? "Camera recording.mov"
              : "Camera recording.mp4",
            Platform.OS === "ios" ? "video/quicktime" : "video/mp4",
          ),
        );
    } catch (e) {
      handleError(e);
    } finally {
      setRecording(false);
      setShowCamera(false);
    }
  };
  return (
    <Screen
      title="Active Dashcam"
      subtitle="CAPTURE NOW. REVIEW AFTER UPLOAD."
      right={
        <Badge
          text={recording ? "● REC" : "STANDBY"}
          color={recording ? C.red : C.cyan}
        />
      }
    >
      {showCamera && permission?.granted ? (
        <View
          style={{
            height: 370,
            borderRadius: 18,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: C.line,
          }}
        >
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            mode="video"
            facing="back"
            mute
            videoQuality="720p"
            onCameraReady={() => setCameraReady(true)}
            onMountError={(e) => {
              setShowCamera(false);
              handleError(new Error(e.message));
            }}
          />
          <View
            style={{ position: "absolute", bottom: 15, left: 15, right: 15 }}
          >
            <Button
              title={
                recording ? "Stop recording" : "Start recording · up to 60s"
              }
              icon={recording ? "stop-circle" : "radio-button-on"}
              kind={recording ? "danger" : "primary"}
              disabled={!cameraReady || busy}
              onPress={() => {
                void record();
              }}
            />
          </View>
        </View>
      ) : (
        <Card style={{ alignItems: "center", paddingVertical: 35 }}>
          <View
            style={{
              padding: 28,
              borderRadius: 70,
              backgroundColor: "#102e38",
            }}
          >
            <Icon name="videocam-outline" size={48} />
          </View>
          <Txt style={{ fontSize: 20, fontWeight: "700", marginTop: 8 }}>
            Eyes on the road.
          </Txt>
          <Txt
            muted
            style={{ textAlign: "center", fontSize: 12, lineHeight: 21 }}
          >
            Mount your phone before recording.{`\n`}Use a clear, short clip of
            the incident.
          </Txt>
          <Button
            title="Open camera"
            icon="camera-outline"
            disabled={busy}
            onPress={() => {
              void (async () => {
                const p = permission?.granted
                  ? permission
                  : await requestPermission();
                if (p.granted) setShowCamera(true);
                else
                  handleError(
                    new Error(
                      "Camera permission is required. Enable it in device Settings, or import a video below.",
                    ),
                  );
              })().catch(handleError);
            }}
          />
        </Card>
      )}
      <Card>
        <Txt style={{ fontWeight: "700" }}>Already have dashcam footage?</Txt>
        <Button
          title="Choose from Photos"
          icon="images-outline"
          onPress={() => {
            void pickLibrary();
          }}
          busy={busy}
          disabled={recording}
        />
        <Button
          title="Import from Files"
          icon="folder-open-outline"
          kind="outline"
          onPress={() => {
            void pickFile();
          }}
          disabled={recording || busy}
        />
        <Txt muted style={{ fontSize: 11 }}>
          MP4, MOV, WebM or MPEG · up to 500 MB{`\n`}Short clips are faster to
          review. Maximum 10 minutes.
        </Txt>
      </Card>
      <Button
        title="Try a 12-second sample clip"
        icon="play-circle-outline"
        kind="outline"
        disabled={recording || busy}
        onPress={() => {
          void open(store.importSample);
        }}
      />
      <Notice>
        Recording stays on your device until you tap Analyse. Real-time
        detection boxes are not enabled.
      </Notice>
    </Screen>
  );
}
