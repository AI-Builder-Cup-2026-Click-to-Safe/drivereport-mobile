import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, AppState, Platform } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useStore } from "../lib/store";
import {
  fromLegacy,
  fromServerReview,
  mergeServerCase,
  editCase,
  correctStatus,
  validation,
  defaultWhatsAppTestMessage,
  MALAYSIA_JPJ_WHATSAPP,
  type RoadCase,
  type Preferences,
  type Region,
} from "./model";
import { applyReportDefaults, type ReportDefaults } from "./report-defaults";
import { applyIncidentLocation, createIncidentLocationResolver, needsIncidentLocation } from "./incident-location";
import fixtures from "./submission-fixtures.json";
import { isSubmissionDemo, pendingCases } from "./submission-model";
import { mergeCaseHistory, linkLocalEvidence, loadHistoryDetails } from "./case-history";
import { DEMO_STAGE_MS } from "./analysis-timing";
export type Job = {
  id: string;
  mode: "demo" | "live";
  status: "running" | "complete" | "error" | "cancelled";
  stage: number;
  progress: number | null;
  sourceIds: string[];
  caseIds: string[];
  completedReviews?: { sourceId: string; reviewId: string; caseIds: string[] }[];
  region: Region;
  error?: string;
  recordingDiagnostics?: string;
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
  demo: false,
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
  fillReportDefaults: (expected: RoadCase, defaults: ReportDefaults) => Promise<void>;
  resolveIncidentLocation: (expected: RoadCase, isActive: () => boolean) => Promise<void>;
  refreshEvidence: (id: string) => Promise<RoadCase>;
  syncCases: (force?: boolean) => Promise<void>;
  syncingCases: boolean;
  historyError: string;
  prepareRecording: (sourceIds?: string[]) => void;
  recordingSaved: (sourceId: string) => void;
  failRecording: (message: string, diagnostics?: string) => void;
  job: Job | null;
  begin: (ids: string[], demo?: boolean, retryJobId?: string) => Promise<void>;
  cancel: () => void;
  dismissNotice: () => void;
  dismissCases: (ids: string[]) => Promise<void>;
  reduced: boolean;
  foreground: boolean;
  seed: () => Promise<void>;
  undo: { id: string; until: number } | null;
  confirmSent: (id: string, deferUndo?: boolean) => Promise<void>;
  startUndo: (id: string) => void;
  undoSent: () => Promise<void>;
};
const resolveIncidentAddress = createIncidentLocationResolver(async (coordinates) => {
  const active = () => AppState.currentState !== "background";
  if (Platform.OS === "web" || !active()) return [];
  // iOS can resolve coordinates without reading the device position. Android
  // requires foreground location permission for its native geocoder.
  if (Platform.OS === "android" && !(await Location.requestForegroundPermissionsAsync()).granted)
    return [];
  if (!active()) return [];
  return Location.reverseGeocodeAsync(coordinates);
});
const RoadContext = createContext<Context | null>(null);
const dismissedMigrationKey = "road.dismissed-reviews.v1";
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
    [foreground, setForeground] = useState(AppState.currentState === "active"),
    [syncingCases, setSyncingCases] = useState(false),
    [historyError, setHistoryError] = useState("");
  const [undo, setUndo] = useState<{ id: string; until: number } | null>(null);
  const [screenReader, setScreenReader] = useState(false);
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
    alive = useRef(true),
    lastHistorySync = useRef(0),
    historySync = useRef<Promise<void> | null>(null);
  const pendingDismissals = useRef<string[]>([]);
  const replaceCases = useCallback(async (next: RoadCase[]) => {
    cr.current = next;
    setCases(next);
  }, []);
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
    return work;
  };
  const prepareRecording = (sourceIds: string[] = []) => {
    updateJob({
      id: `JOB-${Date.now()}`,
      mode: "live",
      status: "running",
      stage: -1,
      progress: null,
      sourceIds: [...new Set(sourceIds)],
      caseIds: [],
      region: pr.current.region,
      notice: false,
    });
  };
  const recordingSaved = (sourceId: string) => {
    const current = jr.current;
    if (!current || current.status !== "running" || current.stage !== -1)
      return;
    updateJob({
      ...current,
      sourceIds: [...new Set([...current.sourceIds, sourceId])],
    });
  };
  const failRecording = (message: string, diagnostics?: string) => {
    const current = jr.current;
    if (!current || current.stage !== -1) return;
    updateJob({ ...current, status: "error", error: message, recordingDiagnostics: diagnostics });
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
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const reader = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReader,
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
      reader.remove();
      app.remove();
    };
  }, []);
  const syncCases = useCallback(
    async (force = false) => {
      if (pr.current.demo || !old.current.settings.token.trim()) return;
      if (!force && Date.now() - lastHistorySync.current < 15000) return;
      if (historySync.current) return historySync.current;
      const work = (async () => {
        setSyncingCases(true);
        setHistoryError("");
        try {
          const before = new Map(cr.current.map((c) => [c.id, c]));
          let history = await old.current.listReviews();
          if (pendingDismissals.current.length) {
            const pending = pendingDismissals.current;
            const results = await Promise.allSettled(pending.map(async (id) => {
              const summary = history.find((item) => item.reviewId === id);
              if (typeof summary?.dismissed === "boolean")
                return { id, dismissed: summary.dismissed };
              const review = await old.current.getReview(id);
              const serverCase = review.case && typeof review.case === "object"
                ? review.case as Record<string, unknown>
                : undefined;
              const dismissed = typeof review.dismissed === "boolean"
                ? review.dismissed
                : serverCase?.dismissed;
              // Explicit server state, including false, supersedes the old
              // device-only flag. Migrate only records with no server field.
              if (typeof dismissed === "boolean") return { id, dismissed };
              await old.current.syncReviewDismissal(id, true);
              return { id, dismissed: true };
            }));
            const resolved = new Map(results.flatMap((result) =>
              result.status === "fulfilled" ? [[result.value.id, result.value.dismissed] as const] : [],
            ));
            history = history.map((item) => resolved.has(item.reviewId)
              ? { ...item, dismissed: resolved.get(item.reviewId)! }
              : item,
            );
            pendingDismissals.current = pending.filter((_, index) => results[index].status === "rejected");
            if (pendingDismissals.current.length)
              await AsyncStorage.setItem(dismissedMigrationKey, JSON.stringify(pendingDismissals.current));
            else await AsyncStorage.removeItem(dismissedMigrationKey);
          }
          history = history.filter((item) =>
            !pendingDismissals.current.includes(item.reviewId),
          );
          const known = new Set(
            cr.current.map((c) => c.reviewId).filter(Boolean),
          );
          const missing = history.filter((item) => !known.has(item.reviewId));
          const fetched = await loadHistoryDetails(
            missing, async (item) => {
              const review = await old.current.getReview(item.reviewId);
              if (!review.created_at) review.created_at = item.createdAt;
              return fromServerReview(review, pr.current.region).map((c) =>
                linkLocalEvidence(c, old.current.records),
              );
            },
          );
          const remote = fetched.flatMap((result) =>
            result.status === "fulfilled" ? result.value : [],
          );
          const present = new Set(history.map((item) => item.reviewId));
          const retained = cr.current.filter((c) =>
            c.provenance.isDemo || !before.has(c.id) ||
            (c.reviewId && present.has(c.reviewId)),
          );
          // Keep edits completed during the request, but otherwise the latest
          // server history owns membership and reporting state on every device.
          const changedReporting = new Set(retained.filter((c) =>
            before.has(c.id) && before.get(c.id)!.reporting !== c.reporting,
          ).map((c) => c.reviewId));
          const changedDismissals = new Set(retained.filter((c) =>
            before.has(c.id) && before.get(c.id)!.dismissed !== c.dismissed,
          ).map((c) => c.reviewId));
          const latestHistory = history.map((item) => ({
            ...item,
            ...(changedReporting.has(item.reviewId) ? { reportingStatus: undefined } : {}),
            ...(changedDismissals.has(item.reviewId) ? { dismissed: undefined } : {}),
          }));
          await replaceCases(mergeCaseHistory(retained, remote, latestHistory));
          lastHistorySync.current = Date.now();
          if (fetched.some((result) => result.status === "rejected"))
            setHistoryError("Some server cases could not be downloaded. Retry.");
          if (pendingDismissals.current.length)
            setHistoryError("Some previous dismissals could not be synced. Retry when connected.");
        } catch (e) {
          setHistoryError(
            e instanceof Error
              ? e.message
              : "Could not sync server case history.",
          );
        } finally {
          setSyncingCases(false);
        }
      })();
      historySync.current = work;
      try {
        await work;
      } finally {
        historySync.current = null;
      }
    },
    [replaceCases],
  );
  useEffect(() => {
    if (!legacy.ready) return;
    let disposed = false;
    void (async () => {
      try {
        const [legacyCases, settings, savedJob, pending] = await Promise.all([
          AsyncStorage.getItem("road.cases.v1"),
          SecureStore.getItemAsync("road.preferences.v1"),
          AsyncStorage.getItem("road.job.v1"),
          AsyncStorage.getItem(dismissedMigrationKey),
        ]);
        if (disposed) return;
        // Preserve only pending dismissal commands, never cached case data.
        const reviewIds = new Set<string>();
        try {
          const previous = pending ? JSON.parse(pending) : [];
          if (Array.isArray(previous))
            for (const id of previous)
              if (typeof id === "string" && /^[a-f0-9]{32}$/i.test(id)) reviewIds.add(id);
        } catch { /* Ignore malformed legacy migration metadata. */ }
        try {
          const previous = legacyCases ? JSON.parse(legacyCases) : [];
          if (Array.isArray(previous))
            for (const c of previous)
              if (c?.dismissed && !c.provenance?.isDemo && typeof c.reviewId === "string" && /^[a-f0-9]{32}$/i.test(c.reviewId))
                reviewIds.add(c.reviewId);
        } catch { /* Old case contents are never restored. */ }
        pendingDismissals.current = [...reviewIds];
        if (reviewIds.size)
          await AsyncStorage.setItem(dismissedMigrationKey, JSON.stringify([...reviewIds]));
        await AsyncStorage.removeItem("road.cases.v1");
        const p: Preferences = settings
          ? { ...defaults, ...JSON.parse(settings) }
          : defaults;
        pr.current = p;
        setPreferences(p);
        // Start from server history each launch. Only authored demo fixtures
        // are seeded locally, in memory, without restoring cached reviews.
        const next: RoadCase[] = p.demo
          ? JSON.parse(JSON.stringify(fixtures.allCases))
          : [];
        await replaceCases(next);
        const visible = next.filter((c) => c.provenance.isDemo === p.demo);
        select((p.demo ? visible[0] : pendingCases(visible)[0])?.id || "");
        if (!p.demo) void syncCases(true);
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
  }, [legacy.ready, replaceCases, syncCases]);
  useEffect(() => {
    if (ready && foreground && !prefs.demo) void syncCases();
  }, [foreground, prefs.demo, ready, syncCases]);
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
              stage: ["queued", "preparing", "uploading"].includes(i?.stage || "queued") ? 0 : 1,
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
    if (current?.reviewId && (status === "opened" || status === "sent"))
      await old.current.syncReviewReporting(
        current.reviewId,
        status,
        patch.vehicle?.plate ?? current.vehicle.plate,
      );
    await replaceCases(
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
  const fillReportDefaults = useCallback(async (expected: RoadCase, defaults: ReportDefaults) => {
    const current = cr.current.find((c) => c.id === expected.id);
    if (!current) return;
    const next = applyReportDefaults(current, expected, defaults);
    if (next !== current)
      await replaceCases(cr.current.map((c) => c === current ? next : c));
  }, [replaceCases]);
  const resolveIncidentLocation = useCallback(async (expected: RoadCase, isActive: () => boolean) => {
    if (!isActive() || !needsIncidentLocation(expected)) return;
    const address = await resolveIncidentAddress(expected.incident.location!);
    if (!alive.current || !isActive()) return;
    const current = cr.current.find((c) => c.id === expected.id);
    if (!current) return;
    const next = applyIncidentLocation(current, expected, address);
    if (next !== current)
      await replaceCases(cr.current.map((c) => c === current ? next : c));
  }, [replaceCases]);
  const refreshEvidence = async (id: string) => {
    const current = cr.current.find((c) => c.id === id);
    if (!current) throw Error("Case not found.");
    if (!current.reviewId) return current;
    const serverCases = fromServerReview(
      await old.current.getReview(current.reviewId),
      current.region,
    );
    const refreshed =
      serverCases.find((serverCase) => serverCase.id === current.id) ||
      serverCases[0];
    if (!refreshed) return current;
    // GPS defaults and edits can finish while signed evidence links refresh.
    const latest = cr.current.find((c) => c.id === id);
    if (!latest) throw Error("Case not found.");
    if (latest.sourceId !== current.sourceId || latest.reviewId !== current.reviewId ||
        latest.analysis !== current.analysis) return latest;
    const next = {
      ...mergeServerCase(latest, refreshed),
      ...(latest.dismissed !== current.dismissed ? { dismissed: latest.dismissed } : {}),
    };
    await replaceCases(cr.current.map((c) => (c === latest ? next : c)));
    return next;
  };
  const confirmSent = async (id: string, deferUndo = false) => {
    await changeCase(id, {
      reporting: { status: "sent", confirmedByUser: true },
    });
    if (!deferUndo) setUndo({ id, until: Date.now() + 8000 });
  };
  const dismissCases = async (ids: string[]) => {
    const targets = cr.current.filter((c) => ids.includes(c.id));
    const results = await Promise.allSettled(targets.map(async (c) => {
      if (!c.provenance.isDemo) {
        if (!c.reviewId) throw Error("This case has no server reference. Refresh Cases and retry.");
        await old.current.syncReviewDismissal(c.reviewId, true);
      }
      return c.id;
    }));
    const confirmed = new Set(results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ));
    await replaceCases(cr.current.map((c) => confirmed.has(c.id) ? { ...c, dismissed: true } : c));
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
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
      await replaceCases([
        ...JSON.parse(JSON.stringify(additions)),
        ...cr.current,
      ]);
    await setPrefs({ demo: true });
  };
  const begin = async (ids: string[], demo = false, retryJobId?: string) => {
    const preparedRecording =
      !demo &&
      jr.current?.status === "running" &&
      jr.current.mode === "live" &&
      jr.current.stage === -1;
    if (jr.current?.status === "running" && !preparedRecording)
      throw Error("An analysis is already running.");
    if (!ready || error) throw Error(error || "Still restoring your data.");
    if (!demo && pr.current.region !== "MY")
      throw Error(
        "Live analysis supports Malaysia only. Set the region to Malaysia in Settings.",
      );
    if (!demo && !old.current.settings.token)
      throw Error("This build isn’t connected to the analysis server yet. Add its access token in Developer settings.");
    const previous = jr.current;
    const retry = previous && previous.id === retryJobId &&
      ["error", "cancelled"].includes(previous.status) &&
      previous.mode === (demo ? "demo" : "live") &&
      previous.region === pr.current.region &&
      previous.sourceIds.length === ids.length &&
      previous.sourceIds.every((id, index) => id === ids[index]);
    const completedCaseIds = new Set(retry ? previous.caseIds : []);
    const generation = ++run.current;
    const j: Job = preparedRecording
      ? {
          ...jr.current!,
          stage: 0,
          progress: 0,
          sourceIds: ids,
          error: undefined,
        }
      : {
          id: retry ? previous.id : `JOB-${Date.now()}-${generation}`,
          mode: demo ? "demo" : "live",
          status: "running",
          stage: 0,
          progress: 0,
          sourceIds: ids,
          caseIds: [],
          completedReviews: retry ? [...(previous.completedReviews || [])] : [],
          region: pr.current.region,
          notice: false,
        };
    updateJob(j);
    try {
      if (demo) {
        for (const [stage, ms, progress] of DEMO_STAGE_MS.map(
          (ms, stage) => [stage, ms, [15, 40, 65, 86][stage]] as const,
        )) {
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
        await replaceCases([
          base,
          ...cr.current.filter((c) => c.id !== base.id),
        ]);
        j.caseIds = [base.id];
        select(base.id);
      } else {
        for (const id of ids) {
          if (run.current !== generation) return;
          // Only an explicit retry of this job may reuse its completed clips.
          // Starting Analyse again always requests a new server review.
          const checkpoint = retry
            ? previous.completedReviews?.find((entry) => entry.sourceId === id)
            : undefined;
          let completed = cr.current.filter((c) =>
            checkpoint
              ? c.reviewId === checkpoint.reviewId
              : c.sourceId === id && completedCaseIds.has(c.id),
          );
          if (checkpoint && !completed.length) {
            // Case data is never restored from disk. Recover the completed
            // review from the API when startup history has not loaded it yet.
            const review = await old.current.getReview(checkpoint.reviewId);
            if (run.current !== generation) return;
            completed = fromServerReview(review, j.region).map((c) =>
              linkLocalEvidence(c, old.current.records),
            );
            if (!completed.length)
              throw Error("The completed review could not be loaded. Retry when the server is available.");
            await replaceCases([
              ...completed,
              ...cr.current.filter((c) => c.reviewId !== checkpoint.reviewId),
            ]);
          }
          if (completed.length) {
            j.caseIds.push(...completed.map((c) => c.id));
            select(completed[0].id);
            continue;
          }
          const record = await old.current.analyse(id, j.region, {
            jobId: j.id,
            reuseUpload: !!retry,
          });
          if (run.current !== generation) return;
          if (!record || record.stage === "error")
            throw Error(record?.error || "Analysis unavailable.");
          const mapped = fromLegacy(record, j.region, new Date().toISOString());
          await replaceCases([
            ...mapped,
            ...cr.current.filter((c) => !mapped.some((next) => next.id === c.id)),
          ]);
          j.caseIds.push(...mapped.map((c) => c.id));
          if (record.result?.review_id) {
            j.completedReviews = [
              ...(j.completedReviews || []).filter((entry) => entry.sourceId !== id),
              { sourceId: id, reviewId: record.result.review_id, caseIds: mapped.map((c) => c.id) },
            ];
          }
          // Commit only references after every clip, before starting the next
          // one, so a force-quit cannot turn completed work into a fresh review.
          await updateJob({ ...j, caseIds: [...j.caseIds] });
          if (mapped[0]) select(mapped[0].id);
        }
      }
      if (run.current === generation && alive.current) {
        updateJob({
          ...j,
          status: "complete",
          stage: 4,
          progress: 100,
          notice: true,
        });
        AccessibilityInfo.announceForAccessibility(
          "I’ve documented the audacity. The case is ready in Cases.",
        );
      }
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
        fillReportDefaults,
        resolveIncidentLocation,
        refreshEvidence,
        syncCases,
        syncingCases,
        // Demo mode never syncs, so a live sync's failure must not linger over the sample cases.
        historyError: prefs.demo ? "" : historyError,
        prepareRecording,
        recordingSaved,
        failRecording,
        job,
        begin,
        cancel,
        dismissCases,
        dismissNotice: () => {
          if (jr.current) updateJob({ ...jr.current, notice: false });
        },
        reduced: prefs.reduced || osReduced,
        foreground,
        seed,
        undo,
        confirmSent,
        startUndo: (id) => {
          // VoiceOver users hear the toast instead of seeing it, so give them longer to reach Undo.
          const seconds = screenReader ? 20 : 8;
          setUndo({ id, until: Date.now() + seconds * 1000 });
          AccessibilityInfo.announceForAccessibility(
            `Marked sent. Fat-fingered it? Undo is available for ${seconds} seconds.`,
          );
        },
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
