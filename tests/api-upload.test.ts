import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { createRequire } from "node:module";
import { reviewWindowMinutes } from "../src/lib/video-policy.ts";
import { validateApiUrl, parseReview, notConnectedMessage } from "../src/lib/domain.ts";
import { parseReviewHistory } from "../src/lib/history.ts";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const code = ts.transpileModule(readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function client(options: { failPreparation?: boolean; fetch?: (url: string, options: { signal: AbortSignal }) => Promise<unknown> } = {}) {
  const uploads: { file: string; options: { headers: object } }[] = [];
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  let preparations = 0;
  let cleanups = 0;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", "fetch", code)(
    (name: string) => {
      if (name === "./video-policy") return { reviewWindowMinutes };
      if (name === "./video-preparation") return { inspectVideo: async () => ({ duration: 1800 }) ,
        prepareSilentVideo: async () => {
          preparations++;
          if (options.failPreparation) throw Error("Audio removal failed");
          return { file: "file:///silent.mov", mime: "video/quicktime", size: 123, duration: 1800, cleanup: async () => { cleanups++; } };
        },
      };
      if (name === "expo-file-system/legacy") return {
        FileSystemUploadType: { BINARY_CONTENT: 0 }, FileSystemSessionType: { FOREGROUND: 1 },
        createUploadTask: (_url: string, file: string, options: { headers: object }) => {
          uploads.push({ file, options });
          return { uploadAsync: async () => ({ status: 200 }), cancelAsync: async () => {} };
        },
      };
      if (name === "./domain") return { validateApiUrl, parseReview, notConnectedMessage };
      if (name === "./history") return { parseReviewHistory };
      throw Error(name);
    },
    module, module.exports,
    options.fetch ?? (async (url: string, options: { body: string }) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => url.endsWith("/v1/uploads")
        ? { upload_url: "https://storage.googleapis.com/test/silent", video_uri: "gs://test/silent" }
        : { verdict: "Clear", reportable: [] } };
    }),
  );
  return { run: module.exports.analyseVideo, api: module.exports, uploads, requests, stats: () => ({ preparations, cleanups }) };
}
const incident = { id: "test", file: "file:///original-with-audio.mp4", mime: "video/mp4", size: 999 };
const settings = { token: "fixture-not-a-real-token", apiUrl: "https://example.com" };

test("one 30-minute source uploads only the prepared silent file, with its actual MIME and size", async () => {
  const c = client();
  const patches: any[] = [];
  await c.run(incident, settings, new AbortController().signal, async (patch: unknown) => { patches.push(patch); });
  assert.equal(c.uploads.length, 1);
  assert.equal(c.uploads[0].file, "file:///silent.mov");
  assert.deepEqual(c.uploads[0].options.headers, { "Content-Type": "video/quicktime" });
  assert.deepEqual(c.requests[0].body, { mime_type: "video/quicktime", size_bytes: 123 });
  assert.equal(c.requests[1].body.mime_type, "video/quicktime");
  assert.equal(c.requests[1].body.window_minutes, 5);
  assert.equal(patches[0].stage, "preparing");
  assert.ok(patches.some((p) => p.remoteAudioRemoved === true));
  assert.deepEqual(c.stats(), { preparations: 1, cleanups: 1 });
});

test("failed audio removal makes no network request and never uploads the original", async () => {
  const c = client({ failPreparation: true });
  await assert.rejects(c.run(incident, settings, new AbortController().signal, async () => {}), /Audio removal failed/);
  assert.equal(c.requests.length, 0);
  assert.equal(c.uploads.length, 0);
});

test("retry reuses only uploads verified audio-free for the same server", async () => {
  for (const verified of [false, true]) {
    const c = client();
    await c.run({ ...incident, remoteUri: "gs://test/previous", remoteApiUrl: settings.apiUrl, remoteAudioRemoved: verified, remoteMime: "video/quicktime" },
      settings, new AbortController().signal, async () => {});
    assert.equal(c.uploads.length, verified ? 0 : 1);
    assert.equal(c.stats().preparations, verified ? 0 : 1);
    assert.equal(c.requests.at(-1)?.body.mime_type, "video/quicktime");
  }
});

test("cancellation after preparation cleans the copy without starting an upload", async () => {
  const c = client();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(c.run(incident, settings, controller.signal, async () => {}), /cancelled/);
  assert.equal(c.requests.length, 0);
  assert.deepEqual(c.stats(), { preparations: 1, cleanups: 1 });
});

test("a timed-out request explains the timeout instead of React Native's bare 'Aborted'", async () => {
  const controller = new AbortController();
  const c = client({
    // React Native's fetch rejects an aborted request with DOMException("Aborted", "AbortError").
    fetch: (_url, { signal }) => new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(Object.assign(Error("Aborted"), { name: "AbortError" })))),
  });
  const history = c.api.listReviewHistory(settings, controller.signal);
  controller.abort();
  await assert.rejects(history, /took too long to respond/);
});

test("network failures that were not aborted keep their own message", async () => {
  const c = client({ fetch: async () => { throw TypeError("Network request failed"); } });
  await assert.rejects(c.api.listReviewHistory(settings, new AbortController().signal), /Network request failed/);
});

test("a build without server access points to the demo run, not a token field the app lacks", async () => {
  const c = client();
  await assert.rejects(
    c.run(incident, { ...settings, token: "" }, new AbortController().signal, async () => {}),
    (e: Error) => e.message === notConnectedMessage && /Demo dataset/.test(e.message) && !/token/i.test(e.message),
  );
  assert.equal(c.requests.length, 0);
  assert.equal(c.uploads.length, 0);
});
