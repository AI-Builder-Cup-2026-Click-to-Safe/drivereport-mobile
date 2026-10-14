import { test } from "node:test";
import assert from "node:assert/strict";
import { settledTabs, tabMotion, TAB_MOTION_MS } from "../src/road/navigation-motion.ts";

test("one-tab and two-tab travel settle exactly at 620ms with bounded overshoot", () => {
  assert.equal(TAB_MOTION_MS, 620);
  for (const width of [320, 390, 440, 1024]) {
    const spacing = (width - 28) / 3;
    for (const from of [0, 1, 2]) for (const to of [0, 1, 2].filter((i) => i !== from)) {
      const start = settledTabs(from, spacing);
      for (let tick = 0; tick <= 620; tick++) {
        const pose = tabMotion(start, to, spacing, tick / 620);
        assert.ok(pose.pill.x >= Math.min(from, to) * spacing - 10.001);
        assert.ok(pose.pill.x <= Math.max(from, to) * spacing + 10.001);
        assert.ok(pose.icons[to].scaleX <= 1.09 && pose.icons[to].scaleY <= 1.09);
        assert.ok(Math.abs(pose.icons[to].y) <= 2.25);
        assert.equal(pose.icons[from].y, 0, "leaving icons only dip");
        assert.ok(pose.icons[from].scaleX >= 0.9 && pose.icons[from].scaleX <= 1);
      }
      assert.deepEqual(tabMotion(start, to, spacing, 1), settledTabs(to, spacing));
    }
  }
});

test("incoming icon lands as the pill overshoots, then both rebound once", () => {
  const start = settledTabs(0, 120);
  const landed = tabMotion(start, 2, 120, 0.7);
  assert.equal(landed.pill.x, 250);
  assert.equal(landed.icons[2].scaleY, 0.945);
  assert.equal(landed.icons[2].y, 0.5);
  const rebound = tabMotion(start, 2, 120, 0.86);
  assert.equal(rebound.pill.x, 237.5);
  assert.equal(rebound.icons[2].y, -0.5);
});

test("five rapid route changes continue from current transforms and leave nothing offset", () => {
  let current = settledTabs(0, 120);
  for (const to of [1, 2, 0, 2, 1]) {
    const next = tabMotion(current, to, 120, 0, true);
    assert.deepEqual(next, current);
    current = tabMotion(current, to, 120, 0.18, true);
  }
  assert.deepEqual(tabMotion(current, 1, 120, 1, true), settledTabs(1, 120));
});
