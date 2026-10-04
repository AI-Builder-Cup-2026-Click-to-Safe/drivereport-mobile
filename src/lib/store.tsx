import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as FS from "expo-file-system/legacy";
import * as Thumbnails from "expo-video-thumbnails";
import { Asset } from "expo-asset";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { analyseVideo } from "./api";
import { Incident, initialSettings, Settings } from "./domain";

const RECORDS = "drivereport.records.v1";
const SETTINGS = "drivereport.settings.v1";
const root = `${FS.documentDirectory}evidence/`;
const localUri = (name: string) =>
  name.startsWith("file:") ? name : `${root}${name}`;
type Context = {
  ready: boolean;
  error: string;
  records: Incident[];
  settings: Settings;
  active?: string;
  progress: number;
  saveSettings: (s: Settings) => Promise<void>;
  importVideo: (uri: string, name: string, mime?: string) => Promise<string>;
  importSample: () => Promise<string>;
  analyse: (id: string) => Promise<void>;
  cancel: () => void;
  update: (id: string, p: Partial<Incident>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
const StoreContext = createContext<Context | null>(null);
export function StoreProvider({ children }: React.PropsWithChildren) {
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [records, setRecords] = useState<Incident[]>([]),
    recordsRef = useRef<Incident[]>([]);
  const [settings, setSettings] = useState(initialSettings);
  const [active, setActive] = useState<string>(),
    [progress, setProgress] = useState(0);
  const running = useRef<AbortController | null>(null),
    writes = useRef(Promise.resolve());
  const persist = (next: Incident[]) => {
    recordsRef.current = next;
    setRecords(next);
    const serializable = next.map((i) => ({
      ...i,
      file: i.file.split("/").pop(),
      thumbnail: i.thumbnail?.split("/").pop(),
    }));
    const write = writes.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(RECORDS, JSON.stringify(serializable)));
    writes.current = write;
    return write;
  };
  const update = (id: string, patch: Partial<Incident>) =>
    persist(
      recordsRef.current.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  useEffect(() => {
    (async () => {
      try {
        await FS.makeDirectoryAsync(root, { intermediates: true });
        const [raw, secure] = await Promise.all([
          AsyncStorage.getItem(RECORDS),
          SecureStore.getItemAsync(SETTINGS),
        ]);
        if (raw) {
          const restored: Incident[] = JSON.parse(raw);
          const next = restored.map((i) => ({
            ...i,
            file: localUri(i.file),
            thumbnail: i.thumbnail ? localUri(i.thumbnail) : undefined,
            ...(["uploading", "reviewing"].includes(i.stage)
              ? {
                  stage: "error" as const,
                  error:
                    "The previous session was interrupted. Tap retry to continue.",
                }
              : {}),
          }));
          recordsRef.current = next;
          setRecords(next);
        }
        let config = secure
          ? { ...initialSettings, ...JSON.parse(secure) }
          : initialSettings;
        // Simulator-only provisioning: never bundle an API token in JavaScript.
        if (__DEV__) {
          const path = `${FS.documentDirectory}connection.local.json`;
          if ((await FS.getInfoAsync(path)).exists) {
            const local = JSON.parse(await FS.readAsStringAsync(path));
            config = { ...config, apiUrl: local.apiUrl, token: local.token };
            await SecureStore.setItemAsync(SETTINGS, JSON.stringify(config));
            await FS.deleteAsync(path, { idempotent: true });
          }
        }
        setSettings(config);
      } catch {
        setError(
          "Could not restore local data. Restart the app before importing more videos.",
        );
      } finally {
        setReady(true);
      }
    })();
  }, []);
  const saveSettings = async (s: Settings) => {
    await SecureStore.setItemAsync(SETTINGS, JSON.stringify(s));
    setSettings(s);
  };
  const importVideo = async (
    uri: string,
    name: string,
    suppliedMime?: string,
  ) => {
    if (error) throw new Error(error);
    const suffix = name.toLowerCase().split(".").pop();
    const mime =
      suppliedMime &&
      ["video/mp4", "video/quicktime", "video/webm", "video/mpeg"].includes(
        suppliedMime,
      )
        ? suppliedMime
        : (
            {
              mov: "video/quicktime",
              mp4: "video/mp4",
              webm: "video/webm",
              mpeg: "video/mpeg",
              mpg: "video/mpeg",
            } as Record<string, string>
          )[suffix ?? ""];
    if (!mime) throw new Error("Choose an MP4, MOV, WebM or MPEG video.");
    const info = await FS.getInfoAsync(uri);
    if (!info.exists || info.isDirectory || !info.size)
      throw new Error("This video cannot be read. Choose it again.");
    if (info.size > 500 * 1024 * 1024)
      throw new Error("Choose a video smaller than 500 MB.");
    const id = `DR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const extension = (
      {
        "video/mp4": "mp4",
        "video/quicktime": "mov",
        "video/webm": "webm",
        "video/mpeg": "mpeg",
      } as Record<string, string>
    )[mime];
    const file = `${root}${id}.${extension}`;
    await FS.copyAsync({ from: uri, to: file });
    let thumbnail: string | undefined;
    try {
      const t = await Thumbnails.getThumbnailAsync(file, { time: 0 });
      thumbnail = `${root}${id}.jpg`;
      await FS.copyAsync({ from: t.uri, to: thumbnail });
    } catch {
      /* Some codecs do not support thumbnails. The original clip remains available. */
    }
    await persist([
      {
        id,
        name,
        file,
        thumbnail,
        mime,
        size: info.size,
        createdAt: new Date().toISOString(),
        stage: "queued",
        plate: "",
        location: "",
        occurredAt: "",
      },
      ...recordsRef.current,
    ]);
    return id;
  };
  const importSample = async () => {
    const asset = Asset.fromModule(require("../../assets/sample-drive.mp4"));
    await asset.downloadAsync();
    return importVideo(
      asset.localUri ?? asset.uri,
      "Sample dashcam · 12 seconds.mp4",
      "video/mp4",
    );
  };
  const analyse = async (id: string) => {
    if (running.current)
      throw new Error(
        "Another video is being analysed. Wait for it to finish.",
      );
    const incident = recordsRef.current.find((i) => i.id === id);
    if (!incident) throw new Error("Video not found.");
    const controller = new AbortController();
    running.current = controller;
    setActive(id);
    setProgress(0);
    const timer = setTimeout(() => controller.abort(), 51 * 60 * 1000);
    await activateKeepAwakeAsync("analysis").catch(() => {});
    try {
      const result = await analyseVideo(
        incident,
        settings,
        controller.signal,
        async (patch, fraction) => {
          if (fraction !== undefined) setProgress(fraction);
          if (Object.keys(patch).length) await update(id, patch);
        },
      );
      await update(id, { stage: "ready", result, error: undefined });
    } catch (e) {
      await update(id, {
        stage: "error",
        error: controller.signal.aborted
          ? "Analysis stopped. Retry to continue. The server may finish a review that already started."
          : e instanceof Error
            ? e.message
            : "Could not analyse this video. Check your connection and retry.",
      });
    } finally {
      clearTimeout(timer);
      running.current = null;
      setActive(undefined);
      void deactivateKeepAwake("analysis");
    }
  };
  const remove = async (id: string) => {
    if (active === id)
      throw new Error("Stop the analysis before deleting this video.");
    const i = recordsRef.current.find((v) => v.id === id);
    await persist(recordsRef.current.filter((v) => v.id !== id));
    if (i)
      await Promise.all([
        FS.deleteAsync(i.file, { idempotent: true }),
        ...(i.thumbnail
          ? [FS.deleteAsync(i.thumbnail, { idempotent: true })]
          : []),
      ]);
  };
  return (
    <StoreContext.Provider
      value={{
        ready,
        error,
        records,
        settings,
        active,
        progress,
        saveSettings,
        importVideo,
        importSample,
        analyse,
        cancel: () => running.current?.abort(),
        update,
        remove,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export const useStore = () => {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Store missing");
  return value;
};
