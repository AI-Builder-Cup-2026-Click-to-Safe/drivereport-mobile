import { test } from "node:test";
import assert from "node:assert/strict";
import { lawPlaceholder } from "../src/road/analysis-progress.ts";

test("completed reviews with no citations stop showing a law-search spinner", () => {
  assert.deepEqual(lawPlaceholder(4, true, false), {
    value: "No applicable offence found", wait: false,
  });
  assert.deepEqual(lawPlaceholder(4, true, true), {
    value: "No law citation returned", wait: false,
  });
  assert.deepEqual(lawPlaceholder(2, false, false), {
    value: "Searching JPJ law", wait: true,
  });
});
