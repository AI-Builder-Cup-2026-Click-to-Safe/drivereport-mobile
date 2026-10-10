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
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  analyseVideo,
  fetchImpact,
  listReviewHistory,
  readReview,
  refreshReview,
  updateReporting,
  type ReviewHistoryItem,
} from "./api";
import {
  applyBuildConnection,
  Incident,
  initialSettings,
  Settings,
  type Review,
  type ImpactSummary,
} from "./domain";
import { inspectVideo } from "./video-preparation";
import { MAX_VIDEO_BYTES, validateVideo } from "./video-policy";
import { SAMPLE_VIDEO, sampleVideoUri } from "./sample";

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
  importVideo: (
    uri: string,
    name: string,
    mime?: string,
    capture?: { dashcamSession: string; createdAt: string; protected: boolean },
    thumbnailAtMs?: number,
  ) => Promise<string>;
  importSample: (options?: { fresh?: boolean }) => Promise<string>;
  analyse: (
    id: string,
    region?: "MY" | "SG" | "JP",
  ) => Promise<Incident | undefined>;
  refresh: (id: string) => Promise<Incident | undefined>;
  syncReporting: (id: string, status: "opened" | "sent") => Promise<void>;
  listReviews: () => Promise<ReviewHistoryItem[]>;
  getReview: (reviewId: string) => Promise<Review>;
  syncReviewReporting: (
    reviewId: string,
    status: "opened" | "sent",
  ) => Promise<void>;
  getImpact: (period: "all" | "week" | "today") => Promise<ImpactSummary>;
  getRecords: () => Incident[];
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
            ...(["preparing", "uploading", "reviewing"].includes(i.stage)
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
        // Local development provisioning remains separate from judging builds.
        if (__DEV__) {
          const path = `${FS.documentDirectory}connection.local.json`;
          if ((await FS.getInfoAsync(path)).exists) {
            const local = JSON.parse(await FS.readAsStringAsync(path));
            config = { ...config, apiUrl: local.apiUrl, token: local.token };
            await SecureStore.setItemAsync(SETTINGS, JSON.stringify(config));
            await FS.deleteAsync(path, { idempotent: true });
          }
        }
        setSettings(applyBuildConnection(config));
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
    const next = applyBuildConnection(s);
    await SecureStore.setItemAsync(SETTINGS, JSON.stringify(next));
    setSettings(next);
  };
  const importVideo = async (
    uri: string,
    name: string,
    suppliedMime?: string,
    capture?: { dashcamSession: string; createdAt: string; protected: boolean },
    thumbnailAtMs = 0,
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
    if (info.size > MAX_VIDEO_BYTES)
      throw new Error("Choose a video no larger than 500 MiB.");
    // Camera recordings already have native duration/size limits. Persist them
    // first; native metadata checks for upload must not delay camera teardown.
    const metadata = capture ? undefined : await inspectVideo(uri);
    if (metadata) validateVideo(metadata, info.size);
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
    // Commit the original before any optional native thumbnail work. An iOS
    // thumbnail callback must never hold up saving a drive or starting upload.
    await persist([
      {
        id,
        name,
        file,
        mime,
        size: info.size,
        durationSeconds: metadata?.duration,
        createdAt: new Date().toISOString(),
        stage: "queued",
        plate: "",
        location: "",
        occurredAt: "",
        ...capture,
      },
      ...recordsRef.current,
    ]);
    void (async () => {
      const t = await Thumbnails.getThumbnailAsync(file, { time: thumbnailAtMs });
      if (!recordsRef.current.some((record) => record.id === id)) return;
      const thumbnail = `${root}${id}.jpg`;
      await FS.copyAsync({ from: t.uri, to: thumbnail });
      await update(id, { thumbnail });
    })().catch(() => {
      // The persisted original remains usable without a thumbnail.
    });
    return id;
  };
  const importSample = async ({ fresh = false } = {}) => {
    // Reuse the copy from an earlier run so its upload and review can be reused too.
    const existing = recordsRef.current.find(
      (i) => i.name === SAMPLE_VIDEO.name && !i.dashcamSession,
    );
    if (!fresh && existing && (await FS.getInfoAsync(existing.file)).exists)
      return existing.id;
    return importVideo(
      await sampleVideoUri(),
      SAMPLE_VIDEO.name,
      "video/mp4",
      undefined,
      SAMPLE_VIDEO.posterMs,
    );
  };
  const analyse = async (id: string, region: "MY" | "SG" | "JP" = "MY") => {
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
        region,
      );
      await update(id, {
        stage: "ready",
        result,
        error: undefined,
        ...(incident.dashcamSession && result.reportable.length
          ? { protected: true }
          : {}),
      });
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
    return recordsRef.current.find((i) => i.id === id);
  };
  const refresh = async (id: string) => {
    const incident = recordsRef.current.find((i) => i.id === id);
    const reviewId = incident?.result?.review_id;
    if (!incident || !reviewId) return incident;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await refreshReview(reviewId, settings, controller.signal);
      await update(id, { result });
      return recordsRef.current.find((i) => i.id === id);
    } finally {
      clearTimeout(timer);
    }
  };
  const syncReporting = async (id: string, status: "opened" | "sent") => {
    const reviewId = recordsRef.current.find((i) => i.id === id)?.result
      ?.review_id;
    if (!reviewId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      await updateReporting(reviewId, status, settings, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  };
  const listReviews = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      return await listReviewHistory(settings, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  };
  const getReview = async (reviewId: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      return await readReview(reviewId, settings, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  };
  const syncReviewReporting = async (
    reviewId: string,
    status: "opened" | "sent",
  ) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      await updateReporting(reviewId, status, settings, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  };
  const getImpact = async (period: "all" | "week" | "today") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetchImpact(period, settings, controller.signal);
    } finally {
      clearTimeout(timer);
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
        refresh,
        syncReporting,
        listReviews,
        getReview,
        syncReviewReporting,
        getImpact,
        getRecords: () => recordsRef.current,
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
