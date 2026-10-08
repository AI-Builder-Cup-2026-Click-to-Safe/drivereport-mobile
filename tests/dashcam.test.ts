import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUFFER_CLIPS,
  nextReview,
  recordSegments,
  rotationCandidates,
} from "../src/lib/dashcam.ts";
import type { Incident } from "../src/lib/domain.ts";
const clip = (n: number, patch: Partial<Incident> = {}): Incident => ({
  id: `c${n}`,
  name: "drive.mov",
  file: `file:///c${n}.mov`,
  mime: "video/quicktime",
  size: 1024,
  createdAt: new Date(n * 60000).toISOString(),
  stage: "queued",
  plate: "",
  location: "",
  occurredAt: "",
  dashcamSession: "s1",
  ...patch,
});
test("rotation removes oldest loop clips, never imports or evidence under review", () => {
  const protectedClips = [
    clip(101, { protected: true }),
    clip(102, { dashcamSession: undefined }),
    clip(103, { stage: "uploading" }),
    clip(104, { stage: "reviewing" }),
    clip(105, { draft: "draft" }),
    clip(106, { reportedAt: "today" }),
    clip(107, { openedAt: "today" }),
    clip(108, {
      result: {
        verdict: "",
        reportable: [{} as never],
        follow_up_exhausted: false,
        tracks: [],
        evidence: { timeline: [] },
      },
    }),
  ];
  const rolling = Array.from({ length: BUFFER_CLIPS + 2 }, (_, n) => clip(n));
  assert.deepEqual(
    rotationCandidates([...protectedClips, ...rolling].reverse()),
    ["c0", "c1"],
  );
  assert.deepEqual(rotationCandidates(rolling, ["c0"]), ["c1"]);
});
test("rotation also bounds bytes and review selection respects session and errors", () => {
  assert.deepEqual(
    rotationCandidates([
      clip(0, { size: 300 * 1024 * 1024 }),
      clip(1, { size: 300 * 1024 * 1024 }),
    ]),
    ["c0"],
  );
  assert.equal(
    nextReview(
      [
        clip(0, { dashcamSession: "old" }),
        clip(1, { stage: "error" }),
        clip(3),
        clip(2),
      ],
      "s1",
    )?.id,
    "c2",
  );
});
test("session continues beyond one clip without waiting for disk writes; stop preserves final clip", async () => {
  let running = true;
  let recordings = 0;
  const saved: string[] = [];
  let finishSave!: () => void;
  const disk = new Promise<void>((resolve) => {
    finishSave = resolve;
  });
  const errors: unknown[] = [];
  await recordSegments({
    shouldContinue: () => running,
    record: async () => {
      recordings++;
      if (recordings === 2) {
        running = false;
        finishSave();
      }
      return { uri: `clip${recordings}` };
    },
    save: async (uri) => {
      saved.push(uri);
      await disk;
    },
    onError: (e) => {
      errors.push(e);
      running = false;
    },
  });
  assert.equal(recordings, 2);
  assert.deepEqual(saved, ["clip1", "clip2"]);
  assert.deepEqual(errors, []);
});
test("camera failure stops the session instead of retrying forever", async () => {
  let calls = 0;
  const errors: unknown[] = [];
  await recordSegments({
    shouldContinue: () => true,
    record: async () => {
      calls++;
      throw new Error("camera interrupted");
    },
    save: async () => assert.fail("no video to save"),
    onError: (e) => errors.push(e),
  });
  assert.equal(calls, 1);
  assert.equal(errors.length, 1);
});
test("disk errors stop recording through the controller and are awaited", async () => {
  let running = true;
  const errors: unknown[] = [];
  await recordSegments({
    shouldContinue: () => running,
    record: async () => {
      await new Promise((r) => setTimeout(r, 1));
      return { uri: "clip" };
    },
    save: async () => {
      throw new Error("disk full");
    },
    onError: (e) => {
      errors.push(e);
      running = false;
    },
  });
  assert.ok(errors.length >= 1);
});
