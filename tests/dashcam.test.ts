import { test } from "node:test";
import assert from "node:assert/strict";
import { recordDrive } from "../src/lib/dashcam.ts";

test("a duration-limit callback saves one file and never restarts capture", async () => {
  let captures = 0;
  let finishSave!: () => void;
  const disk = new Promise<void>((resolve) => { finishSave = resolve; });
  const saved: string[] = [];
  let done = false;
  const task = recordDrive({
    record: async () => { captures++; return { uri: "whole-30-minute-drive.mov" }; },
    save: async (uri) => { saved.push(uri); await disk; },
    onError: () => assert.fail("unexpected error"),
  }).then(() => { done = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(captures, 1);
  assert.equal(done, false, "handoff must await local persistence");
  finishSave();
  await task;
  assert.deepEqual(saved, ["whole-30-minute-drive.mov"]);
  assert.equal(captures, 1);
});

test("camera failure, empty callback and disk failure each terminate without looping", async () => {
  for (const failure of ["camera", "empty", "disk"]) {
    let captures = 0;
    let saves = 0;
    const errors: unknown[] = [];
    await recordDrive({
      record: async () => {
        captures++;
        if (failure === "camera") throw new Error("camera interrupted");
        return failure === "empty" ? undefined : { uri: "drive" };
      },
      save: async () => { saves++; throw new Error("disk full"); },
      onError: (error) => errors.push(error),
    });
    assert.equal(captures, 1);
    assert.equal(saves, failure === "disk" ? 1 : 0);
    assert.equal(errors.length, 1);
  }
});
