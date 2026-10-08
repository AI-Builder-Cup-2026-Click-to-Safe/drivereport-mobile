import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReviewHistory } from "../src/lib/history.ts";

test("history parser keeps shared review identity, cursor and reporting state", () => {
  const id = "a".repeat(32);
  const page = parseReviewHistory({
    reviews: [
      {
        review_id: id,
        created_at: "2026-10-09T10:00:00+00:00",
        reporting_status: "sent",
      },
    ],
    next_before: "2026-10-09T10:00:00+00:00",
  });
  assert.deepEqual(page.reviews, [
    {
      reviewId: id,
      createdAt: "2026-10-09T10:00:00+00:00",
      reportingStatus: "sent",
    },
  ]);
  assert.equal(page.nextBefore, "2026-10-09T10:00:00+00:00");
});

test("history parser rejects entries that cannot be refreshed safely", () => {
  assert.throws(() => parseReviewHistory({ reviews: "invalid" }));
  assert.throws(() =>
    parseReviewHistory({ reviews: [{ review_id: "short", created_at: "now" }] }),
  );
});
