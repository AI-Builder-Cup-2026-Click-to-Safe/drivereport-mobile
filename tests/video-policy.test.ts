import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVideo, validateSilentVideo, reviewWindowMinutes, MAX_VIDEO_BYTES } from "../src/lib/video-policy.ts";
const video = { duration: 1800, videoTracks: 1, audioTracks: 1 };

test("30 minutes and 500 MiB inclusive; oversized or unreadable files rejected", () => {
  assert.doesNotThrow(() => validateVideo(video, MAX_VIDEO_BYTES));
  assert.throws(() => validateVideo({ ...video, duration: 1800.001 }), /30 minutes/);
  assert.throws(() => validateVideo(video, MAX_VIDEO_BYTES + 1), /500 MiB/);
  for (const duration of [0, -1, NaN, Infinity])
    assert.throws(() => validateVideo({ ...video, duration }), /playable/);
  assert.throws(() => validateVideo({ ...video, videoTracks: 0 }), /playable/);
});

test("audio or truncation in an exported video blocks upload", () => {
  assert.doesNotThrow(() => validateSilentVideo(video, { ...video, audioTracks: 0 }, 123));
  assert.throws(() => validateSilentVideo(video, video, 123), /Audio could not be removed/);
  assert.throws(() => validateSilentVideo(video, { ...video, audioTracks: 0, duration: 60 }, 123), /length changed/);
  assert.throws(() => validateSilentVideo(video, { ...video, audioTracks: 0 }, 0), /1 byte/);
});

test("long videos request affordable server windows without changing the source", () => {
  assert.equal(reviewWindowMinutes(60), 1);
  assert.equal(reviewWindowMinutes(600), 2);
  assert.equal(reviewWindowMinutes(1800), 5);
  assert.throws(() => reviewWindowMinutes(NaN), /duration is unavailable/);
});
