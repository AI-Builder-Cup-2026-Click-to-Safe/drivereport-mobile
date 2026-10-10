import * as FileSystem from "expo-file-system/legacy";
import {
  Incident,
  parseReview,
  type Review,
  Settings,
  validateApiUrl,
  type ImpactSummary,
} from "./domain";
import {
  parseReviewHistory,
  type ReviewHistoryItem,
} from "./history";
export type { ReviewHistoryItem } from "./history";

async function request(
  settings: Settings,
  path: string,
  signal: AbortSignal,
  body?: object,
  method?: "POST" | "PATCH",
) {
  const response = await fetch(`${validateApiUrl(settings.apiUrl)}${path}`, {
    method: method || (body ? "POST" : "GET"),
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(settings.token
        ? { Authorization: `Bearer ${settings.token.trim()}` }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new Error("Access denied. Check the API token in Settings.");
    if (response.status === 413)
      throw new Error("This video is too large. Select a shorter clip.");
    if (response.status === 504)
      throw new Error("The analysis timed out. Retry with a shorter clip.");
    throw new Error(
      `Server request failed (${response.status}). Please try again.`,
    );
  }
  return response.json();
}
export async function checkConnection(settings: Settings) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const result = await request(settings, "/health", controller.signal);
    if (result.status !== "ok") throw new Error("Unexpected server response.");
    return "Server reachable. Token will be verified when you upload.";
  } finally {
    clearTimeout(timer);
  }
}
export async function refreshReview(
  reviewId: string,
  settings: Settings,
  signal: AbortSignal,
) {
  if (!/^[a-f0-9]{32}$/i.test(reviewId))
    throw new Error("This review has no valid server reference.");
  return parseReview(
    await request(settings, `/v1/reviews/${reviewId}`, signal),
  );
}

export async function listReviewHistory(
  settings: Settings,
  signal: AbortSignal,
): Promise<ReviewHistoryItem[]> {
  const found = new Map<string, ReviewHistoryItem>();
  const seenCursors = new Set<string>();
  let before: string | undefined;
  do {
    const path = `/v1/reviews?limit=100${before ? `&before=${encodeURIComponent(before)}` : ""}`;
    const page = parseReviewHistory(await request(settings, path, signal));
    for (const item of page.reviews)
      if (!found.has(item.reviewId)) found.set(item.reviewId, item);
    before = page.nextBefore;
    if (before) {
      if (seenCursors.has(before))
        throw new Error("The server returned a repeated history page.");
      seenCursors.add(before);
    }
  } while (before);
  return [...found.values()];
}

export async function readReview(
  reviewId: string,
  settings: Settings,
  signal: AbortSignal,
): Promise<Review> {
  return refreshReview(reviewId, settings, signal);
}
export async function updateReporting(
  reviewId: string,
  status: "opened" | "sent",
  settings: Settings,
  signal: AbortSignal,
) {
  if (!/^[a-f0-9]{32}$/i.test(reviewId))
    throw new Error("This review has no valid server reference.");
  return request(
    settings,
    `/v1/reviews/${reviewId}/reporting`,
    signal,
    { reporting_status: status },
    "PATCH",
  );
}
export async function fetchImpact(
  period: "all" | "week" | "today",
  settings: Settings,
  signal: AbortSignal,
): Promise<ImpactSummary> {
  const raw = (await request(
    settings,
    `/v1/impact?period=${period}`,
    signal,
  )) as Record<string, unknown>;
  const count = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : 0;
  const most =
    raw.mostSpotted && typeof raw.mostSpotted === "object"
      ? (raw.mostSpotted as Record<string, unknown>)
      : null;
  const occurrences =
    raw.offenceOccurrences && typeof raw.offenceOccurrences === "object"
      ? Object.fromEntries(
          Object.entries(raw.offenceOccurrences as Record<string, unknown>)
            .filter(([key]) => key.length > 0)
            .map(([key, value]) => [key, count(value)]),
        )
      : {};
  return {
    snitchedCount: count(raw.snitchedCount),
    billedCount: count(raw.billedCount),
    mostSpotted:
      most && typeof most.plate === "string" && most.plate.trim()
        ? { plate: most.plate, count: count(most.count) }
        : null,
    offenceOccurrences: occurrences,
    isDemo: raw.isDemo === true,
    demoToday: typeof raw.demoToday === "string" ? raw.demoToday : "",
  };
}
export async function analyseVideo(
  i: Incident,
  settings: Settings,
  signal: AbortSignal,
  update: (patch: Partial<Incident>, progress?: number) => Promise<void>,
  region: "MY" | "SG" | "JP" = "MY",
) {
  if (!settings.token.trim())
    throw new Error("This build isn’t connected to the analysis server yet. Add its access token in Developer settings.");
  let uri =
    i.remoteApiUrl === validateApiUrl(settings.apiUrl)
      ? i.remoteUri
      : undefined;
  if (!uri) {
    await update({ stage: "uploading", error: undefined }, 0);
    const session = await request(settings, "/v1/uploads", signal, {
      mime_type: i.mime,
      size_bytes: i.size,
    });
    if (
      typeof session.upload_url !== "string" ||
      !session.upload_url.startsWith("https://storage.googleapis.com/") ||
      typeof session.video_uri !== "string" ||
      !session.video_uri.startsWith("gs://")
    )
      throw new Error("The server returned an invalid upload destination.");
    const task = FileSystem.createUploadTask(
      session.upload_url,
      i.file,
      {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
        headers: { "Content-Type": i.mime },
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        void update(
          {},
          totalBytesExpectedToSend
            ? totalBytesSent / totalBytesExpectedToSend
            : 0,
        );
      },
    );
    const abort = () => {
      void task.cancelAsync();
    };
    signal.addEventListener("abort", abort);
    try {
      if (signal.aborted) throw new Error("Analysis cancelled.");
      const response = await task.uploadAsync();
      if (!response || response.status < 200 || response.status >= 300)
        throw new Error(
          signal.aborted
            ? "Analysis cancelled."
            : `Video upload failed (${response?.status ?? "network error"}). Retry when connected.`,
        );
    } finally {
      signal.removeEventListener("abort", abort);
    }
    uri = session.video_uri;
    await update({
      remoteUri: uri,
      remoteApiUrl: validateApiUrl(settings.apiUrl),
    });
  }
  if (signal.aborted) throw new Error("Analysis cancelled.");
  await update({ stage: "reviewing" }, 1);
  const raw = await request(settings, "/v1/review", signal, {
    video_uri: uri,
    mime_type: i.mime,
    region,
  });
  return parseReview(raw);
}
