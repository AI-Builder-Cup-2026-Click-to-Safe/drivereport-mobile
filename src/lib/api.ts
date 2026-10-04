import * as FileSystem from "expo-file-system/legacy";
import { Incident, parseReview, Settings, validateApiUrl } from "./domain";

async function request(
  settings: Settings,
  path: string,
  signal: AbortSignal,
  body?: object,
) {
  const response = await fetch(`${validateApiUrl(settings.apiUrl)}${path}`, {
    method: body ? "POST" : "GET",
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
export async function analyseVideo(
  i: Incident,
  settings: Settings,
  signal: AbortSignal,
  update: (patch: Partial<Incident>, progress?: number) => Promise<void>,
) {
  if (!settings.token.trim())
    throw new Error("Add your API access token in Settings to analyse videos.");
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
  });
  return parseReview(raw);
}
