import type { Incident } from "./domain.ts";

export const SEGMENT_SECONDS = 60;
export const BUFFER_CLIPS = 15;
export const BUFFER_BYTES = 500 * 1024 * 1024;
export const MIN_FREE_BYTES = 400 * 1024 * 1024;

// Only clips made by loop recording may rotate out. Evidence, drafts, imports,
// and files currently being uploaded/reviewed must never be removed here.
export function rotationCandidates(
  records: Incident[],
  heldIds: string[] = [],
) {
  const clips = records
    .filter(
      (i) =>
        i.dashcamSession &&
        !i.protected &&
        !i.draft &&
        !i.openedAt &&
        !i.reportedAt &&
        !i.result?.reportable.length &&
        !["uploading", "reviewing"].includes(i.stage) &&
        !heldIds.includes(i.id),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let bytes = clips.reduce((n, i) => n + i.size, 0);
  let count = clips.length;
  const remove: string[] = [];
  for (const clip of clips) {
    if (count <= BUFFER_CLIPS && bytes <= BUFFER_BYTES) break;
    remove.push(clip.id);
    count--;
    bytes -= clip.size;
  }
  return remove;
}

export function nextReview(records: Incident[], session: string) {
  return records
    .filter((i) => i.dashcamSession === session && i.stage === "queued")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}

// A session outlives individual files. Persistence must not block starting the
// next recording. Bound unfinished writes so a slow disk cannot build a queue.
export async function recordSegments(options: {
  shouldContinue: () => boolean;
  record: () => Promise<{ uri: string } | undefined>;
  save: (uri: string, startedAt: string) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const writes = new Set<Promise<void>>();
  try {
    while (options.shouldContinue()) {
      if (writes.size >= 2)
        throw new Error(
          "Storage cannot keep up. Recording stopped to preserve saved clips.",
        );
      const startedAt = new Date().toISOString();
      const result = await options.record();
      if (!result)
        throw new Error(
          "The camera stopped without saving a clip. Check History and start again.",
        );
      const write = options.save(result.uri, startedAt).catch(options.onError);
      writes.add(write);
      void write.then(() => writes.delete(write));
    }
  } catch (error) {
    options.onError(error);
  } finally {
    await Promise.all(writes);
  }
}
