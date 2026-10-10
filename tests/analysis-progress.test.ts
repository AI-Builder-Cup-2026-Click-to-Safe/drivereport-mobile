import { test } from "node:test";
import assert from "node:assert/strict";
import { lawPlaceholder, reviewCost } from "../src/road/analysis-progress.ts";

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

test("cost waits for completion and never substitutes demo or partial amounts", () => {
  assert.equal(reviewCost([0.1], true).value, null);
  assert.equal(reviewCost([0.1, undefined], false).value, null);
  assert.equal(reviewCost([], false).value, null);
  assert.equal(reviewCost([0], false).value, 0);
  assert.equal(reviewCost([0.125, 0.25], false).value, 0.375);
});
