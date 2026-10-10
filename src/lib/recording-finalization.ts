// Native recording callbacks can fail to settle (including stop/start races).
// Keep the camera mounted while waiting, retry stop, and bound the user's wait.
export async function finishRecording(options: {
  stop: () => void;
  pending: Promise<void> | null;
  timeoutMessage: () => string;
  timeoutMs?: number;
  retryMs?: number;
}) {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setInterval> | undefined;
  try {
    options.stop();
    if (!options.pending) return;
    const timeout = new Promise<never>((_, reject) => {
      deadline = setTimeout(
        () => reject(new Error(options.timeoutMessage())),
        options.timeoutMs ?? 30_000,
      );
      retry = setInterval(() => {
        try {
          options.stop();
        } catch (error) {
          reject(error);
        }
      }, options.retryMs ?? 500);
    });
    await Promise.race([options.pending, timeout]);
  } finally {
    clearTimeout(deadline);
    clearInterval(retry);
  }
}
