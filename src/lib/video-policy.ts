export const MAX_VIDEO_SECONDS = 30 * 60;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
// Leave headroom for the camera container to finish below the upload ceiling.
export const MAX_CAPTURE_BYTES = 490 * 1024 * 1024;
export type VideoInfo = { duration: number; audioTracks: number; videoTracks: number };

export function validateVideo(info: VideoInfo, bytes?: number) {
  if (!Number.isFinite(info.duration) || info.duration <= 0 || info.videoTracks < 1)
    throw new Error("This file has no playable video. Choose another video.");
  if (info.duration > MAX_VIDEO_SECONDS)
    throw new Error("Videos must be 30 minutes or shorter. Trim this video and try again.");
  if (bytes !== undefined && (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_VIDEO_BYTES))
    throw new Error("Videos must be between 1 byte and 500 MiB. Choose a smaller video.");
}

export function validateSilentVideo(original: VideoInfo, result: VideoInfo, bytes: number) {
  validateVideo(result, bytes);
  if (result.audioTracks !== 0)
    throw new Error("Audio could not be removed. Nothing was uploaded. Try another video.");
  if (Math.abs(result.duration - original.duration) > 0.25)
    throw new Error("The prepared video's length changed. Nothing was uploaded. Try another video.");
}

// The server budgets each analysis window separately. Roughly five windows
// (plus overlap) keeps a 30-minute review within its 3,000-second deadline.
// This controls server reads; it never splits or re-uploads the source file.
export function reviewWindowMinutes(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    throw new Error("The saved video's duration is unavailable. Retry the analysis.");
  return Math.min(30, Math.max(1, Math.ceil(durationSeconds / 360)));
}
