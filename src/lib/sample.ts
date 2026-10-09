import { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import * as FS from "expo-file-system/legacy";
import * as Thumbnails from "expo-video-thumbnails";

/**
 * The real dashcam clip offered by default on Your clip. It is uploaded and
 * reviewed by the backend like any video the user chooses; no fixture result.
 */
export const SAMPLE_VIDEO = {
  module: require("../../assets/sample-video.mp4"),
  name: "sample-video.mp4",
  durationSeconds: 43,
  // The oncoming car is in view here; the first frame is an empty lane.
  posterMs: 15000,
};

export async function sampleVideoUri() {
  const asset = Asset.fromModule(SAMPLE_VIDEO.module);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

type SamplePreview = { thumbnail?: string; size: number };
let preview: Promise<SamplePreview> | null = null;
/** Poster frame and byte size of the bundled sample, for display before import. */
export function useSamplePreview() {
  const [value, setValue] = useState<SamplePreview | null>(null);
  useEffect(() => {
    let alive = true;
    preview ??= (async () => {
      const uri = await sampleVideoUri();
      const info = await FS.getInfoAsync(uri);
      const thumbnail = await Thumbnails.getThumbnailAsync(uri, {
        time: SAMPLE_VIDEO.posterMs,
      })
        .then((t) => t.uri)
        .catch(() => undefined);
      return { thumbnail, size: info.exists ? info.size : 0 };
    })().catch((e) => {
      preview = null;
      throw e;
    });
    preview
      .then((v) => alive && setValue(v))
      .catch(() => alive && setValue({ size: 0 }));
    return () => {
      alive = false;
    };
  }, []);
  return value;
}
