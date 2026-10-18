export type ReviewHistoryItem = {
  reviewId: string;
  createdAt: string;
  reportingStatus?: "needs_info" | "ready" | "opened" | "sent" | "clean";
  reportableCount?: number;
  plate?: string | null;
  caseId?: string;
  dismissed?: boolean;
  thumbnailUrl?: string | null;
};

export function parseReviewHistory(input: unknown): {
  reviews: ReviewHistoryItem[];
  nextBefore?: string;
} {
  if (!input || typeof input !== "object")
    throw new Error("The server returned invalid review history.");
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.reviews))
    throw new Error("The server returned invalid review history.");
  const reviews = raw.reviews.map((value) => {
    if (!value || typeof value !== "object")
      throw new Error("The server returned an invalid history item.");
    const item = value as Record<string, unknown>;
    const reviewId =
      typeof item.review_id === "string" ? item.review_id : "";
    const createdAt =
      typeof item.created_at === "string" ? item.created_at : "";
    if (!/^[a-f0-9]{32}$/i.test(reviewId) || !createdAt)
      throw new Error("The server returned an invalid history item.");
    const reportingStatus: ReviewHistoryItem["reportingStatus"] =
      item.reporting_status === "needs_info" || item.reporting_status === "ready" ||
      item.reporting_status === "opened" || item.reporting_status === "sent" ||
      item.reporting_status === "clean"
        ? item.reporting_status
        : undefined;
    return { reviewId, createdAt, reportingStatus,
      ...(typeof item.reportable_count === "number" && Number.isInteger(item.reportable_count) && item.reportable_count >= 0
        ? { reportableCount: item.reportable_count } : {}),
      ...(item.plate === null || typeof item.plate === "string" ? { plate: item.plate } : {}),
      ...(typeof item.case_id === "string" && item.case_id ? { caseId: item.case_id } : {}),
      ...(typeof item.dismissed === "boolean" ? { dismissed: item.dismissed } : {}),
      ...(item.thumbnail_url === null || (typeof item.thumbnail_url === "string" && item.thumbnail_url.startsWith("https://"))
        ? { thumbnailUrl: item.thumbnail_url } : {}),
    };
  });
  return {
    reviews,
    ...(typeof raw.next_before === "string" && raw.next_before
      ? { nextBefore: raw.next_before }
      : {}),
  };
}
