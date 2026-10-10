// Enough room for the camera file plus its durable copy and container overhead.
export const MIN_FREE_BYTES = 1100 * 1024 * 1024;

// One native capture per drive. Reaching the duration/size limit must finish the
// drive, never start another file. Wait for persistence before handing it off.
export async function recordDrive(options: {
  record: () => Promise<{ uri: string } | undefined>;
  save: (uri: string, startedAt: string) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  try {
    const startedAt = new Date().toISOString();
    const result = await options.record();
    if (!result) throw new Error("The camera stopped without saving a video. Start a new recording.");
    await options.save(result.uri, startedAt);
  } catch (error) {
    options.onError(error);
  }
}
