import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { URL } from "node:url";
import * as domain from "../src/lib/domain.ts";
import * as model from "../src/road/model.ts";
import * as history from "../src/road/case-history.ts";
import * as submission from "../src/road/submission-model.ts";
import * as defaults from "../src/road/report-defaults.ts";
import * as location from "../src/road/incident-location.ts";
import { impactCases } from "../src/road/impact-cases.ts";
import type { ReviewHistoryItem } from "../src/lib/history.ts";
import { DEMO_STAGE_MS } from "../src/road/analysis-timing.ts";

const ts = createRequire(import.meta.url)("typescript");
const fixture = JSON.parse(readFileSync(new URL("../src/road/submission-fixtures.json", import.meta.url), "utf8"));

// Exercise the actual providers with deterministic React/native boundaries.
// Re-renders retain hook state; asynchronous storage and API effects still run.
function provider(file: string, exportName: string, dependencies: Record<string, any>) {
  const hooks: any[] = [];
  let cursor = 0;
  const effects: (() => void)[] = [];
  const same = (a: unknown[] | undefined, b: unknown[]) => a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createContext: () => ({ Provider: "Provider" }),
    createElement: (_type: unknown, props: any) => props.value,
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      return [hooks[index], (next: any) => { hooks[index] = typeof next === "function" ? next(hooks[index]) : next; }];
    },
    useRef: (initial: any) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useCallback: (fn: any, deps: unknown[]) => {
      const index = cursor++;
      if (!same(hooks[index]?.deps, deps)) hooks[index] = { deps, fn };
      return hooks[index].fn;
    },
    useEffect: (fn: () => void, deps: unknown[]) => {
      const index = cursor++;
      if (!same(hooks[index], deps)) { hooks[index] = deps; effects.push(fn); }
    },
  };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", "__DEV__", code)((name: string) => {
    if (name === "react") return react;
    if (name in dependencies) return dependencies[name];
    throw Error(`Missing test dependency: ${name}`);
  }, module, module.exports, false);
  const render = () => { cursor = 0; return module.exports[exportName]({}); };
  return {
    render,
    async flush() {
      for (let i = 0; i < 20; i++) {
        render();
        while (effects.length) effects.shift()!();
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      return render();
    },
  };
}
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    data, writes,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { writes.push(key); data.set(key, value); },
    removeItem: async (key: string) => { data.delete(key); },
  };
}
function review(id: string): domain.Review {
  const c = structuredClone(fixture.allCases[0]);
  c.id = `RR-${id}`;
  c.provenance.isDemo = false;
  return domain.parseReview({ review_id: id, case: c, reportable: [], verdict: "Review", created_at: "2026-10-18T00:00:00Z" });
}
function recording(id = "clip"): domain.Incident {
  return {
    id, name: "sample.mp4", file: "clip.mp4", thumbnail: "clip.jpg", mime: "video/mp4", size: 123,
    stage: "ready", createdAt: "2026-10-17T00:00:00Z", plate: "", location: "Recorded street", occurredAt: "2026-10-17",
    result: review("old"), remoteUri: "gs://bucket/upload", remoteAudioRemoved: true,
    dashcamSession: "drive", protected: true,
    draft: "Old analysis report", selectedVehicleId: "vehicle-1", openedAt: "2026-10-17", reportedAt: "2026-10-17",
  };
}
function footageStore(disk: ReturnType<typeof storage>, analyseVideo: (...args: any[]) => Promise<domain.Review> = async () => review("fresh")) {
  return provider("../src/lib/store.tsx", "StoreProvider", {
    "@react-native-async-storage/async-storage": disk,
    "expo-secure-store": { getItemAsync: async () => null },
    "expo-file-system/legacy": { documentDirectory: "file:///documents/", makeDirectoryAsync: async () => {} },
    "expo-video-thumbnails": {},
    "expo-keep-awake": { activateKeepAwakeAsync: async () => {}, deactivateKeepAwake: () => {} },
    "./api": { analyseVideo },
    "./domain": domain,
    "./video-preparation": {}, "./video-policy": {}, "./sample": {},
  });
}
function roadStore(disk: ReturnType<typeof storage>, overrides: Record<string, any> = {}) {
  const records = [recording()];
  const analysed: string[] = [];
  const legacy = {
    ready: true, records, settings: { token: "fixture-token" },
    listReviews: async () => [],
    getReview: async (id: string) => review(id),
    syncReviewDismissal: async () => {},
    analyse: async (id: string) => {
      analysed.push(id);
      return { ...recording(id), result: review(`fresh-${analysed.length}`) };
    },
    ...overrides,
  };
  const app = provider("../src/road/context.tsx", "RoadProvider", {
    "@react-native-async-storage/async-storage": disk,
    "expo-secure-store": { getItemAsync: async () => null, setItemAsync: async () => {} },
    "expo-device": { isDevice: false },
    "expo-location": {},
    "react-native": {
      Platform: { OS: "ios" },
      AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
      AccessibilityInfo: {
        isReduceMotionEnabled: async () => false, isScreenReaderEnabled: async () => false,
        addEventListener: () => ({ remove() {} }), announceForAccessibility() {},
      },
    },
    "../lib/store": { useStore: () => legacy },
    "./model": model, "./report-defaults": defaults, "./incident-location": location,
    "./submission-fixtures.json": fixture, "./submission-model": submission,
    "./case-history": history, "./analysis-timing": { DEMO_STAGE_MS },
  });
  return { ...app, legacy, analysed };
}

test("upgrade removes old responses from footage records without removing recordings or upload recovery", async () => {
  const disk = storage({ "drivereport.records.v1": JSON.stringify([recording()]) });
  const app = footageStore(disk);
  let value = await app.flush();
  assert.equal(value.records[0].result, undefined);
  assert.equal(value.records[0].file, "file:///documents/evidence/clip.mp4");
  const saved = JSON.parse(disk.data.get("drivereport.records.v1")!)[0];
  assert.equal("result" in saved, false);
  for (const field of ["draft", "selectedVehicleId", "openedAt", "reportedAt"])
    assert.equal(field in saved, false, `${field} must not remain in device storage`);
  assert.equal(saved.remoteUri, "gs://bucket/upload");
  assert.equal(saved.dashcamSession, "drive");
  assert.equal(saved.location, "Recorded street");
  assert.equal(saved.protected, true);

  await value.analyse("clip");
  value = app.render();
  assert.equal(value.records[0].result.review_id, "fresh", "new response is usable in the current session");
  assert.equal("result" in JSON.parse(disk.data.get("drivereport.records.v1")!)[0], false);
  const restarted = await footageStore(disk).flush();
  assert.equal(restarted.records[0].result, undefined);
});

test("launch discards even malformed case cache and loads Cases/Impact history only from the API", async () => {
  const disk = storage({ "road.cases.v1": "legacy malformed cache" });
  const app = roadStore(disk, { listReviews: async () => [{ reviewId: "server", createdAt: "2026-10-18T00:00:00Z" }] });
  const value = await app.flush();
  assert.equal(disk.data.has("road.cases.v1"), false);
  assert.deepEqual(value.allCases.map((c: model.RoadCase) => c.reviewId), ["server"]);
  assert.deepEqual(value.cases, value.allCases);
  assert.equal(value.prefs.demo, false, "fresh installs default to live, including simulators");
});

test("failed startup history never reconstructs cases from legacy footage responses", async () => {
  const disk = storage({ "road.cases.v1": JSON.stringify([fixture.allCases[0]]) });
  const app = roadStore(disk, { listReviews: async () => { throw Error("Offline"); } });
  const value = await app.flush();
  assert.equal(value.allCases.length, 0);
  assert.equal(value.historyError, "Offline");
  assert.equal(disk.data.has("road.cases.v1"), false);
});

test("legacy history without eligibility metadata remains loadable with at most four concurrent detail requests", async () => {
  const items = Array.from({ length: 93 }, (_, index) => ({
    reviewId: `server-${index}`, createdAt: "2026-10-18T00:00:00Z",
  }));
  const requests: string[] = [];
  let active = 0;
  let peak = 0;
  const disk = storage();
  const app = roadStore(disk, {
    listReviews: async () => items,
    getReview: async (id: string) => {
      requests.push(id);
      active++;
      peak = Math.max(peak, active);
      try {
        if (active > 4) throw Error("Detail request capacity exceeded");
        await new Promise<void>((resolve) => setImmediate(resolve));
        return review(id);
      } finally {
        active--;
      }
    },
  });
  const started = await app.flush();
  await started.syncCases(true);
  const value = app.render();
  assert.equal(peak, 4);
  assert.equal(active, 0);
  assert.deepEqual(requests, items.map((item) => item.reviewId));
  assert.deepEqual(value.allCases.map((c: model.RoadCase) => c.reviewId), requests);
  assert.equal(value.historyError, "");
  assert.equal(value.syncingCases, false);
  assert.equal(disk.writes.includes("road.cases.v1"), false);
});

test("93 summaries request only 11 visible Needs you and 8 Sent details, then restore a newly visible duplicate", async () => {
  let items: ReviewHistoryItem[] = [
    ...Array.from({ length: 11 }, (_, index): ReviewHistoryItem => ({
      reviewId: `pending-${index}`, createdAt: "2026-10-18T00:00:00Z",
      reportingStatus: index % 2 ? "needs_info" : "ready", reportableCount: 1, plate: `ABC ${index}`,
    })),
    ...Array.from({ length: 8 }, (_, index): ReviewHistoryItem => ({
      reviewId: `sent-${index}`, createdAt: "2026-10-18T00:00:00Z",
      reportingStatus: "sent", reportableCount: 0, plate: "ABC 0",
    })),
    ...Array.from({ length: 5 }, (_, index): ReviewHistoryItem => ({
      reviewId: `duplicate-${index}`, createdAt: "2026-10-17T00:00:00Z",
      reportingStatus: "opened", reportableCount: 1, plate: `abc${index}`,
    })),
    ...Array.from({ length: 30 }, (_, index): ReviewHistoryItem => ({
      reviewId: `dismissed-${index}`, createdAt: "2026-10-18T00:00:00Z",
      reportingStatus: "ready", reportableCount: 1, dismissed: true,
    })),
    ...Array.from({ length: 39 }, (_, index): ReviewHistoryItem => ({
      reviewId: `clean-${index}`, createdAt: "2026-10-18T00:00:00Z",
      reportingStatus: index % 2 ? "clean" : undefined, reportableCount: 0,
    })),
  ];
  const requests: string[] = [];
  let peak = 0;
  let active = 0;
  const app = roadStore(storage(), {
    listReviews: async () => items,
    getReview: async (id: string) => {
      requests.push(id);
      peak = Math.max(peak, ++active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      active--;
      const result = review(id);
      const c = result.case as model.RoadCase;
      c.vehicle.plate = items.find((item) => item.reviewId === id)?.plate ?? null;
      return result;
    },
  });
  let value = await app.flush();
  assert.equal(items.length, 93);
  assert.equal(peak, 4);
  assert.deepEqual(requests, items.slice(0, 19).map((item) => item.reviewId));
  assert.equal(value.allCases.length, 19);
  assert.equal(submission.pendingCases(value.cases).length, 11);
  assert.equal(impactCases(value.cases).all.length, 19);
  assert.equal(impactCases(value.cases).sent.length, 8);

  items = items.map((item) => item.reviewId === "pending-0" ? { ...item, dismissed: true } : item);
  requests.length = 0;
  await value.syncCases(true);
  value = app.render();
  assert.deepEqual(requests, ["duplicate-0"]);
  assert.equal(submission.pendingCases(value.cases).length, 11);
  assert.equal(impactCases(value.cases).all.length, 19);
  assert.equal(value.allCases.find((c: model.RoadCase) => c.reviewId === "pending-0").dismissed, true);
});

test("summary clean/dismissed states hide known cases and restoring either state fetches fresh details", async () => {
  let item: ReviewHistoryItem = {
    reviewId: "server", createdAt: "2026-10-18T00:00:00Z",
    reportingStatus: "ready", reportableCount: 1, dismissed: true,
  };
  const requests: string[] = [];
  const app = roadStore(storage(), {
    listReviews: async () => [item],
    getReview: async (id: string) => { requests.push(id); return review(id); },
  });
  let value = await app.flush();
  assert.deepEqual(requests, []);
  assert.equal(value.allCases.length, 0);

  item = { ...item, dismissed: false };
  await value.syncCases(true);
  value = app.render();
  assert.deepEqual(requests, ["server"]);
  assert.equal(submission.pendingCases(value.cases).length, 1);

  for (const hidden of [{ reportingStatus: "clean" as const }, { dismissed: true }]) {
    item = { ...item, ...hidden };
    requests.length = 0;
    await value.syncCases(true);
    value = app.render();
    assert.deepEqual(requests, []);
    assert.equal(impactCases(value.cases).all.length, 0);

    item = { ...item, reportingStatus: "ready", dismissed: false };
    await value.syncCases(true);
    value = app.render();
    assert.deepEqual(requests, ["server"]);
    assert.equal(submission.pendingCases(value.cases).length, 1);
  }
});

test("a failed detail does not stop queued history requests and retry only downloads the missing case", async () => {
  const items = Array.from({ length: 11 }, (_, index) => ({
    reviewId: `server-${index}`, createdAt: "2026-10-18T00:00:00Z",
  }));
  const requests: string[] = [];
  let fail = true;
  const disk = storage();
  const app = roadStore(disk, {
    listReviews: async () => items,
    getReview: async (id: string) => {
      requests.push(id);
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (id === "server-1" && fail) throw Error("Detail timed out");
      return review(id);
    },
  });
  let value = await app.flush();
  assert.deepEqual(requests, items.map((item) => item.reviewId));
  assert.deepEqual(value.allCases.map((c: model.RoadCase) => c.reviewId),
    requests.filter((id) => id !== "server-1"));
  assert.equal(value.historyError, "Some server cases could not be downloaded. Retry.");
  assert.equal(value.syncingCases, false);

  fail = false;
  requests.length = 0;
  await value.syncCases(true);
  value = app.render();
  assert.deepEqual(requests, ["server-1"]);
  assert.equal(value.allCases.length, items.length);
  assert.equal(value.historyError, "");
  assert.equal(disk.writes.includes("road.cases.v1"), false);
});

test("normal Analyse twice calls the API twice and retains both server reviews without writing cases", async () => {
  const disk = storage();
  const app = roadStore(disk);
  let value = await app.flush();
  await value.begin(["clip"]);
  value = app.render();
  await value.begin(["clip"]);
  value = app.render();
  assert.deepEqual(app.analysed, ["clip", "clip"]);
  assert.equal(value.allCases.length, 2);
  assert.equal(disk.writes.includes("road.cases.v1"), false);
  assert.ok(disk.writes.includes("road.job.v1"), "recording/job recovery remains durable");
});

test("only Retry of the same interrupted multi-clip job skips completed clips", async () => {
  const calls: string[] = [];
  let fail = true;
  const app = roadStore(storage(), { analyse: async (id: string) => {
    calls.push(id);
    if (id === "second" && fail) throw Error("Network interrupted");
    return { ...recording(id), result: review(id) };
  } });
  let value = await app.flush();
  await value.begin(["first", "second"]);
  value = app.render();
  assert.equal(value.job.status, "error");
  fail = false;
  await value.begin(value.job.sourceIds, false, value.job.id);
  value = app.render();
  assert.deepEqual(calls, ["first", "second", "second"]);
  assert.equal(value.job.status, "complete");
  assert.equal(value.job.caseIds.length, 2);
});

test("new analyses use separate uploads; only a retry with the same upload job can reuse one", async () => {
  const disk = storage({ "drivereport.records.v1": JSON.stringify([recording()]) });
  const inputs: domain.Incident[] = [];
  const app = footageStore(disk, async (incident, _settings, _signal, update) => {
    inputs.push(incident);
    await update({ remoteUri: "gs://bucket/new-upload", remoteAudioRemoved: true });
    return review(`run-${inputs.length}`);
  });
  let value = await app.flush();
  await value.analyse("clip", "MY", { jobId: "job-1", reuseUpload: false });
  assert.equal(inputs[0].remoteUri, undefined);
  assert.equal(inputs[0].result, undefined);
  value = app.render();
  await value.analyse("clip", "MY", { jobId: "job-1", reuseUpload: true });
  assert.equal(inputs[1].remoteUri, "gs://bucket/new-upload");
  assert.equal(inputs[1].result, undefined);
  value = app.render();
  await value.analyse("clip", "MY", { jobId: "job-2", reuseUpload: true });
  assert.equal(inputs[2].remoteUri, undefined, "a restart before reset must not reuse another job's upload");
  assert.equal(JSON.parse(disk.data.get("drivereport.records.v1")!)[0].uploadJobId, "job-2");
});

for (const loadedFromHistory of [true, false]) {
  test(`force-quit between clips recovers completed server review (${loadedFromHistory ? "history" : "detail API"}) without re-analysis`, async () => {
    const disk = storage();
    let reachedSecond!: () => void;
    let finishOld!: () => void;
    const secondStarted = new Promise<void>((resolve) => { reachedSecond = resolve; });
    const stopped = new Promise<void>((resolve) => { finishOld = resolve; });
    const original = roadStore(disk, { analyse: async (id: string) => {
      if (id === "second") {
        reachedSecond();
        await stopped;
        throw Error("Old process stopped");
      }
      return { ...recording(id), result: review("completed-first") };
    } });
    const initial = await original.flush();
    const interrupted = initial.begin(["first", "second"]);
    await secondStarted;
    const checkpoint = JSON.parse(disk.data.get("road.job.v1")!);
    assert.equal(checkpoint.status, "running");
    assert.deepEqual(checkpoint.completedReviews, [{ sourceId: "first", reviewId: "completed-first", caseIds: ["RR-completed-first"] }]);
    assert.deepEqual(checkpoint.caseIds, ["RR-completed-first"]);
    assert.doesNotMatch(JSON.stringify(checkpoint), /offences|evidence|verdict|reportable/);
    const restartedDisk = storage(Object.fromEntries(disk.data));
    const fetched: string[] = [];
    const restarted = roadStore(restartedDisk, {
      listReviews: async () => loadedFromHistory
        ? [{ reviewId: "completed-first", createdAt: "2026-10-18T00:00:00Z" }]
        : [],
      getReview: async (id: string) => { fetched.push(id); return review(id); },
    });
    let value = await restarted.flush();
    assert.equal(value.job.status, "error");
    if (loadedFromHistory) assert.equal(value.allCases[0].sourceId, "cloud:completed-first");
    await value.begin(value.job.sourceIds, false, value.job.id);
    value = restarted.render();
    assert.deepEqual(restarted.analysed, ["second"]);
    assert.deepEqual(fetched, ["completed-first"]);
    assert.equal(value.job.status, "complete");
    assert.equal(value.job.caseIds.length, 2);
    finishOld();
    await interrupted;
  });
}

test("successful history sync removes deleted server cases and applies server reporting changes", async () => {
  let items = ["one", "two"].map((reviewId) => ({ reviewId, createdAt: "2026-10-18T00:00:00Z", reportingStatus: "sent" }));
  const app = roadStore(storage(), { listReviews: async () => items });
  let value = await app.flush();
  assert.equal(value.allCases.length, 2);
  items = [{ ...items[0], reportingStatus: "opened" }];
  await value.syncCases(true);
  value = app.render();
  assert.deepEqual(value.allCases.map((c: model.RoadCase) => c.reviewId), ["one"]);
  assert.equal(value.allCases[0].reporting.status, "opened");
});

test("dismissing a live case updates memory only after the API confirms it", async () => {
  let confirm!: () => void;
  const response = new Promise<void>((resolve) => { confirm = resolve; });
  const calls: [string, boolean][] = [];
  const disk = storage();
  const app = roadStore(disk, {
    listReviews: async () => [{ reviewId: "server", createdAt: "2026-10-18T00:00:00Z" }],
    syncReviewDismissal: async (id: string, dismissed: boolean) => { calls.push([id, dismissed]); await response; },
  });
  let value = await app.flush();
  const request = value.dismissCases(["RR-server"]);
  assert.equal(app.render().allCases[0].dismissed, false);
  confirm();
  await request;
  value = app.render();
  assert.deepEqual(calls, [["server", true]]);
  assert.equal(value.allCases[0].dismissed, true);
  assert.equal(disk.writes.includes("road.cases.v1"), false);
});

test("failed dismissal stays visible and can be retried", async () => {
  const app = roadStore(storage(), {
    listReviews: async () => [{ reviewId: "server", createdAt: "2026-10-18T00:00:00Z" }],
    syncReviewDismissal: async () => { throw Error("Offline"); },
  });
  const value = await app.flush();
  await assert.rejects(value.dismissCases(["RR-server"]), /Offline/);
  assert.equal(app.render().allCases[0].dismissed, false);
});

test("legacy dismissals migrate only review IDs, stay hidden offline, and resume syncing after restart", async () => {
  const id = "a".repeat(32);
  const oldCase = { ...fixture.allCases[0], reviewId: id, dismissed: true, provenance: { isDemo: false } };
  const disk = storage({ "road.cases.v1": JSON.stringify([oldCase]) });
  const item = { reviewId: id, createdAt: "2026-10-18T00:00:00Z" };
  const app = roadStore(disk, {
    listReviews: async () => [item],
    syncReviewDismissal: async () => { throw Error("Offline"); },
  });
  const value = await app.flush();
  assert.equal(value.allCases.length, 0);
  assert.match(value.historyError, /dismissals could not be synced/);
  assert.equal(disk.data.has("road.cases.v1"), false);
  assert.deepEqual(JSON.parse(disk.data.get("road.dismissed-reviews.v1")!), [id]);
  const calls: string[] = [];
  const restarted = roadStore(disk, {
    listReviews: async () => [item],
    syncReviewDismissal: async (id: string) => { calls.push(id); },
  });
  const restored = await restarted.flush();
  assert.deepEqual(calls, [id]);
  assert.equal(restored.allCases.length, 0, "a migrated dismissal stays outside the displayed detail queue");
  assert.equal(disk.data.has("road.dismissed-reviews.v1"), false);
});

for (const source of ["summary", "detail", "case"]) {
  test(`explicit server dismissed=false in ${source} overrides legacy local dismissal`, async () => {
    const id = "b".repeat(32);
    const oldCase = { ...fixture.allCases[0], reviewId: id, dismissed: true, provenance: { isDemo: false } };
    const disk = storage({ "road.cases.v1": JSON.stringify([oldCase]) });
    const calls: string[] = [];
    const app = roadStore(disk, {
      listReviews: async () => [{ reviewId: id, createdAt: "2026-10-18T00:00:00Z", ...(source === "summary" ? { dismissed: false } : {}) }],
      getReview: async () => {
        const result = review(id);
        if (source === "detail") result.dismissed = false;
        if (source === "case") result.case = { ...(result.case as object), dismissed: false };
        return result;
      },
      syncReviewDismissal: async (id: string) => { calls.push(id); },
    });
    const value = await app.flush();
    assert.deepEqual(calls, [], "legacy migration must not overwrite an authoritative restore");
    assert.equal(value.allCases[0].dismissed, false);
    assert.equal(disk.data.has("road.cases.v1"), false);
    assert.equal(disk.data.has("road.dismissed-reviews.v1"), false);
  });
}

test("a slow evidence refresh cannot undo a dismissal or replace a source's newer analysis", async () => {
  let resolveRefresh!: (value: domain.Review) => void;
  const delayed = new Promise<domain.Review>((resolve) => { resolveRefresh = resolve; });
  let reads = 0;
  const app = roadStore(storage(), {
    listReviews: async () => [{ reviewId: "server", createdAt: "2026-10-18T00:00:00Z" }],
    getReview: async () => ++reads === 1 ? review("server") : delayed,
    refresh: async () => { throw Error("Must not mutate footage results during case refresh"); },
  });
  const value = await app.flush();
  const refresh = value.refreshEvidence("RR-server");
  await value.dismissCases(["RR-server"]);
  app.legacy.records[0].result = review("newer-source-analysis");
  resolveRefresh(review("server"));
  await refresh;
  assert.equal(app.render().allCases[0].dismissed, true);
  assert.equal(app.legacy.records[0].result.review_id, "newer-source-analysis");
});
