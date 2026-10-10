import { requireOptionalNativeModule } from "expo-modules-core";
import * as FS from "expo-file-system/legacy";
import { Platform } from "react-native";
import { validateVideo, validateSilentVideo, type VideoInfo } from "./video-policy";

type NativePreparation = {
  inspectAsync(uri: string): Promise<VideoInfo>;
  stripAudioAsync(uri: string, output: string): Promise<void>;
  cancel(output: string): void;
};
function native() {
  const module = requireOptionalNativeModule<NativePreparation>("VideoPreparation");
  if (!module) throw new Error("Install the latest Click-to-Safe build to prepare videos without audio.");
  return module;
}

export async function inspectVideo(uri: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      native().inspectAsync(uri),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Reading this video took too long. Choose another video.")), 20_000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

// The original is retained locally. Upload only this verified, audio-free file.
export async function prepareSilentVideo(file: string, mime: string, signal: AbortSignal) {
  const checkCancelled = () => { if (signal.aborted) throw new Error("Video preparation cancelled."); };
  checkCancelled();
  const original = await inspectVideo(file);
  validateVideo(original);
  const stat = await FS.getInfoAsync(file);
  if (!stat.exists || stat.isDirectory) throw new Error("Saved video not found. Choose it again.");
  validateVideo(original, stat.size);
  checkCancelled();
  if (original.audioTracks === 0)
    return { file, mime, size: stat.size, duration: original.duration, cleanup: async () => {} };
  const free = await FS.getFreeDiskStorageAsync();
  if (free < stat.size + 50 * 1024 * 1024)
    throw new Error("Free some space to remove audio. Your original video is still saved. Nothing was uploaded.");
  const ext = Platform.OS === "ios" ? "mov" : "mp4";
  const output = `${FS.cacheDirectory}silent-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const module = native();
  const cleanup = () => FS.deleteAsync(output, { idempotent: true }).catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let exporting = false;
  const abort = () => { if (exporting) module.cancel(output); };
  signal.addEventListener("abort", abort);
  try {
    checkCancelled();
    exporting = true;
    const operation = module.stripAudioAsync(file, output);
    // Native cancellation releases the exporter and removes any partial output.
    await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          module.cancel(output);
          void operation.finally(cleanup).catch(() => {});
          reject(new Error("Removing audio took too long. Nothing was uploaded. Retry or choose another video."));
        }, 10 * 60_000);
      }),
    ]);
    exporting = false;
    clearTimeout(timer);
    checkCancelled();
    const result = await inspectVideo(output);
    const prepared = await FS.getInfoAsync(output);
    if (!prepared.exists || prepared.isDirectory) throw new Error("The silent video was not saved. Nothing was uploaded.");
    validateSilentVideo(original, result, prepared.size);
    checkCancelled();
    return { file: output, mime: ext === "mov" ? "video/quicktime" : "video/mp4", size: prepared.size, duration: result.duration, cleanup };
  } catch (error) {
    if (!timedOut) await cleanup();
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
