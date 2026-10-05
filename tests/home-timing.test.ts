import test from "node:test";
import assert from "node:assert/strict";
import {
  APERTURE_START,
  APERTURE_END,
  HOME_END,
  IRIS_END,
  apertureGeometry,
  entranceAt,
  entranceDuration,
  progress,
} from "../src/road/home-timing.ts";

test("Capture arrives preserves the handover hold, opening, landing and last copy beat", () => {
  assert.equal(entranceAt(170), APERTURE_START);
  assert.equal(entranceAt(170) + entranceDuration(590), APERTURE_END);
  assert.equal(entranceAt(0) + entranceDuration(1250), IRIS_END);
  assert.equal(entranceAt(1030 + 170) + entranceDuration(580), HOME_END);
  assert.ok(APERTURE_END < IRIS_END && IRIS_END < HOME_END);
});

test("the fully open mask clears every corner at small, tall and landscape sizes", () => {
  for (const [width, height] of [
    [320, 568],
    [402, 874],
    [440, 956],
    [844, 390],
  ]) {
    const { x, y, radius } = apertureGeometry(width, height);
    for (const [cx, cy] of [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ])
      assert.ok(radius > Math.hypot(cx - x, cy - y));
  }
});

test("interrupted or delayed frames resolve to bounded opening progress", () => {
  assert.equal(progress(0, APERTURE_START, 885), 0);
  assert.equal(progress(APERTURE_START, APERTURE_START, 885), 0);
  assert.equal(progress(APERTURE_END, APERTURE_START, 885), 1);
  assert.equal(progress(HOME_END, APERTURE_START, 885), 1);
});
