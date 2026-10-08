import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import { useStore } from "../lib/store";
import {
  fromLegacy,
  editCase,
  restoreEvidence,
  correctStatus,
  validation,
  defaultWhatsAppTestMessage,
  MALAYSIA_JPJ_WHATSAPP,
  type RoadCase,
  type Preferences,
  type Region,
} from "./model";
import fixtures from "./submission-fixtures.json";
import { isSubmissionDemo } from "./submission-model";
export type Job = {
  id: string;
  mode: "demo" | "live";
  status: "running" | "complete" | "error" | "cancelled";
  stage: number;
  progress: number | null;
  sourceIds: string[];
  caseIds: string[];
  region: Region;
  error?: string;
  notice: boolean;
};
const defaults: Preferences = {
  region: "MY",
  language: "en-GB",
  reduced: false,
  recipients: { MY: MALAYSIA_JPJ_WHATSAPP, SG: "", JP: "" },
  includePersonal: false,
  name: "",
  identity: "",
  address: "",
  phone: "",
  email: "",
  demo: !Device.isDevice,
  testMessage: defaultWhatsAppTestMessage,
};
type Context = {
  ready: boolean;
  error: string;
  cases: RoadCase[];
  allCases: RoadCase[];
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => Promise<void>;
  selected: string;
  select: (id: string) => void;
  changeCase: (id: string, patch: Partial<RoadCase>) => Promise<void>;
  refreshEvidence: (id: string) => Promise<RoadCase>;
  job: Job | null;
  begin: (ids: string[], demo?: boolean) => Promise<void>;
  cancel: () => void;
  dismissNotice: () => void;
  reduced: boolean;
  foreground: boolean;
  seed: () => Promise<void>;
  undo: { id: string; until: number } | null;
  confirmSent: (id: string, deferUndo?: boolean) => Promise<void>;
  startUndo: (id: string) => void;
  undoSent: () => Promise<void>;
};
const RoadContext = createContext<Context | null>(null);
export function RoadProvider({ children }: React.PropsWithChildren) {
  const legacy = useStore(),
    old = useRef(legacy);
  old.current = legacy;
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [cases, setCases] = useState<RoadCase[]>([]),
    [prefs, setPreferences] = useState(defaults),
    [selected, select] = useState(""),
    [job, setJob] = useState<Job | null>(null),
    [osReduced, setOSReduced] = useState(false),
    [motionReady, setMotionReady] = useState(false),
    [foreground, setForeground] = useState(AppState.currentState === "active");
  const [undo, setUndo] = useState<{ id: string; until: number } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () => setUndo(null),
      Math.max(0, undo.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo]);
  const cr = useRef(cases),
    pr = useRef(prefs),
    jr = useRef(job),
    writes = useRef(Promise.resolve()),
    run = useRef(0),
    alive = useRef(true);
  const persistCases = (next: RoadCase[]) => {
    cr.current = next;
    setCases(next);
    const text = JSON.stringify(next);
    const work = writes.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem("road.cases.v1", text));
    writes.current = work;
    return work;
  };
  const updateJob = (next: Job | null) => {
    jr.current = next;
    setJob(next);
    const text = JSON.stringify(next);
    const work = writes.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem("road.job.v1", text));
    writes.current = work;
    void work.catch(() =>
      setError("Could not save analysis state. Keep the app open."),
    );
  };
  useEffect(() => {
    alive.current = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setOSReduced)
      .catch(() => setOSReduced(true))
      .finally(() => setMotionReady(true));
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setOSReduced,
    );
    const app = AppState.addEventListener("change", (s) =>
      setForeground(s === "active"),
    );
    return () => {
      alive.current = false;
      // Invalidate the active asynchronous job on provider teardown.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      run.current++;
      motion.remove();
      app.remove();
    };
  }, []);
  useEffect(() => {
    if (!legacy.ready) return;
    let disposed = false;
    void (async () => {
      try {
        const [data, settings, savedJob] = await Promise.all([
          AsyncStorage.getItem("road.cases.v1"),
          SecureStore.getItemAsync("road.preferences.v1"),
          AsyncStorage.getItem("road.job.v1"),
        ]);
        if (disposed) return;
        const p: Preferences = settings
          ? { ...defaults, ...JSON.parse(settings) }
          : defaults;
        pr.current = p;
        setPreferences(p);
        const stored: RoadCase[] = data ? JSON.parse(data) : [];
        const sources = new Map(old.current.records.map((i) => [i.id, i]));
        const restored = stored.map((c) =>
          restoreEvidence(c, sources.get(c.sourceId || "")),
        );
        // Preserve the old evidence store; migrate analysed records once into the new case model.
        const known = new Set(restored.map((c) => c.sourceId));
        const migrated = old.current.records
          .filter((i) => i.result && !known.has(i.id))
          .flatMap((i) => fromLegacy(i, "MY"));
        const next = [...restored, ...migrated];
        if (p.demo)
          for (const sample of fixtures.allCases) {
            if (!next.some((c) => c.id === sample.id))
              next.push(JSON.parse(JSON.stringify(sample)));
          }
        await persistCases(next);
        select(next.find((c) => c.provenance.isDemo === p.demo)?.id || "");
        if (savedJob) {
          const j: Job | null = JSON.parse(savedJob);
          if (j) {
            if (j.status === "running") {
              j.status = "error";
              j.error =
                "The app closed before this review finished. Your saved footage is available. Retry the analysis.";
            }
            updateJob(j);
          }
        }
      } catch {
        setError(
          "Could not restore Click-to-Safe data. Restart before making changes.",
        );
      } finally {
        if (!disposed) setReady(true);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [legacy.ready]);
  useEffect(() => {
    if (
      jr.current?.status === "running" &&
      jr.current.mode === "live" &&
      legacy.active
    ) {
      const i = legacy.records.find((v) => v.id === legacy.active);
      setJob((j) =>
        j
          ? {
              ...j,
              stage: i?.stage === "uploading" ? 0 : 1,
              progress:
                i?.stage === "uploading"
                  ? Math.round(legacy.progress * 100)
                  : null,
            }
          : j,
      );
    }
  }, [legacy.active, legacy.progress, legacy.records]);
  const setPrefs = async (patch: Partial<Preferences>) => {
    const next = { ...pr.current, ...patch };
    pr.current = next;
    setPreferences(next);
    const work = writes.current
      .catch(() => {})
      .then(() =>
        SecureStore.setItemAsync("road.preferences.v1", JSON.stringify(next)),
      );
    writes.current = work;
    await work;
  };
  const changeCase = async (id: string, patch: Partial<RoadCase>) => {
    const current = cr.current.find((c) => c.id === id);
    const status = patch.reporting?.status;
    if (
      current?.sourceId &&
      current.reviewId &&
      (status === "opened" || status === "sent")
    )
      await old.current.syncReporting(current.sourceId, status);
    await persistCases(
      cr.current.map((c) => {
        if (c.id !== id) return c;
        if (c.reporting.status === "sent" && !patch.reporting)
          throw Error("Mark this report as not sent before editing.");
        const n = editCase(c, patch);
        if (patch.reporting?.status === "sent" && validation(n))
          throw Error(validation(n));
        n.reporting = { ...n.reporting, status: correctStatus(n) };
        return n;
      }),
    );
  };
  const refreshEvidence = async (id: string) => {
    const current = cr.current.find((c) => c.id === id);
    if (!current) throw Error("Case not found.");
    if (!current.sourceId || !current.reviewId) return current;
    const record = await old.current.refresh(current.sourceId);
    const refreshed = record
      ? fromLegacy(record, current.region)[0]
      : undefined;
    if (!refreshed) return current;
    const next = {
      ...current,
      reviewId: refreshed.reviewId,
      decisionTrail: refreshed.decisionTrail,
      evidence: {
        ...current.evidence,
        annotatedVideoUrl: refreshed.evidence.annotatedVideoUrl,
        excerptVideoUrl: refreshed.evidence.excerptVideoUrl,
        tracks: refreshed.evidence.tracks,
      },
    };
    await persistCases(cr.current.map((c) => (c.id === id ? next : c)));
    return next;
  };
  const confirmSent = async (id: string, deferUndo = false) => {
    await changeCase(id, {
      reporting: { status: "sent", confirmedByUser: true },
    });
    if (!deferUndo) setUndo({ id, until: Date.now() + 8000 });
  };
  const undoSent = async () => {
    if (!undo || Date.now() > undo.until) return;
    await changeCase(undo.id, {
      reporting: { status: "opened", confirmedByUser: false },
    });
    setUndo(null);
  };
  const seed = async () => {
    const additions = fixtures.allCases.filter(
      (f) => !cr.current.some((c) => c.id === f.id),
    );
    if (additions.length)
      await persistCases([
        ...JSON.parse(JSON.stringify(additions)),
        ...cr.current,
      ]);
    await setPrefs({ demo: true });
  };
  const begin = async (ids: string[], demo = false) => {
    if (jr.current?.status === "running")
      throw Error("An analysis is already running.");
    if (!ready || error) throw Error(error || "Still restoring your data.");
    if (!demo && pr.current.region !== "MY")
      throw Error(
        "Live legal analysis is currently configured for Malaysia only. Select Malaysia or use the demo.",
      );
    if (!demo && !old.current.settings.token)
      throw Error("Add your API access token in Developer before analysing.");
    const generation = ++run.current;
    const j: Job = {
      id: `JOB-${Date.now()}`,
      mode: demo ? "demo" : "live",
      status: "running",
      stage: 0,
      progress: 0,
      sourceIds: ids,
      caseIds: [],
      region: pr.current.region,
      notice: false,
    };
    updateJob(j);
    try {
      if (demo) {
        for (const [stage, ms, progress] of [
          [0, 1700, 15],
          [1, 2600, 40],
          [2, 2200, 65],
          [3, 2300, 86],
        ] as const) {
          if (run.current !== generation) return;
          updateJob({ ...j, stage, progress });
          await new Promise((resolve) => setTimeout(resolve, ms));
        }
        if (run.current !== generation) return;
        const base = JSON.parse(
          JSON.stringify(fixtures.allCases[0]),
        ) as RoadCase;
        // Replay the waiting sample without duplicating it or overwriting a sent report.
        const previous = cr.current.find((c) => c.id === base.id);
        if (previous?.reporting.status === "sent")
          base.id = `SUB-REPLAY-${Date.now()}`;
        await persistCases([
          base,
          ...cr.current.filter((c) => c.id !== base.id),
        ]);
        j.caseIds = [base.id];
        select(base.id);
      } else {
        for (const id of ids) {
          if (run.current !== generation) return;
          // Retrying a multi-clip job must not bill or replace already reviewed clips.
          const completed = cr.current.filter((c) => c.sourceId === id);
          if (completed.length) {
            j.caseIds.push(...completed.map((c) => c.id));
            select(completed[0].id);
            continue;
          }
          const record = await old.current.analyse(id, j.region);
          if (run.current !== generation) return;
          if (!record || record.stage === "error")
            throw Error(record?.error || "Analysis unavailable.");
          const mapped = fromLegacy(record, j.region);
          await persistCases([
            ...mapped,
            ...cr.current.filter((c) => c.sourceId !== id),
          ]);
          j.caseIds.push(...mapped.map((c) => c.id));
          if (mapped[0]) select(mapped[0].id);
        }
      }
      if (run.current === generation && alive.current)
        updateJob({
          ...j,
          status: "complete",
          stage: 4,
          progress: 100,
          notice: true,
        });
    } catch (e) {
      if (run.current === generation && alive.current)
        updateJob({
          ...j,
          status: "error",
          error:
            e instanceof Error
              ? e.message
              : "Analysis failed. Retry with your saved video.",
        });
    }
  };
  const cancel = () => {
    run.current++;
    old.current.cancel();
    if (jr.current)
      updateJob({
        ...jr.current,
        status: "cancelled",
        error:
          "Waiting stopped. Saved footage is kept; a server review already started may still finish.",
      });
  };
  return (
    <RoadContext.Provider
      value={{
        ready: ready && legacy.ready && motionReady,
        error,
        cases: cases.filter((c) =>
          prefs.demo ? isSubmissionDemo(c) : !c.provenance.isDemo,
        ),
        allCases: cases,
        prefs,
        setPrefs,
        selected,
        select,
        changeCase,
        refreshEvidence,
        job,
        begin,
        cancel,
        dismissNotice: () => {
          if (jr.current) updateJob({ ...jr.current, notice: false });
        },
        reduced: prefs.reduced || osReduced,
        foreground,
        seed,
        undo,
        confirmSent,
        startUndo: (id) => setUndo({ id, until: Date.now() + 8000 }),
        undoSent,
      }}
    >
      {children}
    </RoadContext.Provider>
  );
}
export const useRoad = () => {
  const c = useContext(RoadContext);
  if (!c) throw Error("RoadProvider missing");
  return c;
};
