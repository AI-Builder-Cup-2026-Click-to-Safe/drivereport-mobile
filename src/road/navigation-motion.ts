export const TAB_MOTION_MS = 620;
export type IconPose = { mix: number; scaleX: number; scaleY: number; y: number };
export type TabPose = {
  pill: { x: number; scaleX: number; scaleY: number };
  icons: IconPose[];
};
export const settledTabs = (index: number, spacing: number): TabPose => ({
  pill: { x: index * spacing, scaleX: 1, scaleY: 1 },
  icons: [0, 1, 2].map((i) => ({ mix: i === index ? 1 : 0, scaleX: 1, scaleY: 1, y: 0 })),
});
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const bounce = [
  [0, 0.86, 0.86, 0], [0.16, 0.91, 0.89, 0.5],
  [0.46, 1.055, 1.09, -2.25], [0.7, 1.055, 0.945, 0.5],
  [0.86, 0.99, 1.015, -0.5], [1, 1, 1, 0],
];
/** Solve x(t) before sampling y(t), matching CSS cubic-bezier timing. */
function bezier(progress: number, x1: number, y1: number, x2: number, y2: number) {
  if (progress <= 0 || progress >= 1) return progress;
  const cubic = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 16; i++) {
    const middle = (lo + hi) / 2;
    if (cubic(middle, x1, x2) < progress) lo = middle;
    else hi = middle;
  }
  return cubic((lo + hi) / 2, y1, y2);
}

/** One snapshot drives pill travel, all icon morphs and the bounded bounce. */
export function tabMotion(from: TabPose, index: number, spacing: number, progress: number, interrupted = false): TabPose {
  const t = Math.min(1, Math.max(0, progress));
  if (t === 1) return settledTabs(index, spacing);
  const target = index * spacing;
  const travel = target - from.pill.x;
  const overshoot = Math.sign(travel) * Math.min(Math.abs(travel) * 0.08, 10);
  const stops = [
    [0, from.pill.x, from.pill.scaleX, from.pill.scaleY],
    [0.38, from.pill.x + travel * 0.55, 1.4, 0.86],
    [0.7, target + overshoot, 0.94, 1.08],
    [0.86, target - overshoot * 0.25, 1.02, 0.98],
    [1, target, 1, 1],
  ];
  const segment = stops.findIndex((stop, i) => i < stops.length - 1 && t <= stops[i + 1][0]);
  const a = stops[segment], b = stops[segment + 1];
  const k = (t - a[0]) / (b[0] - a[0]);
  const eased = segment === 0 ? bezier(k, 0.4, 0, 0.6, 1)
    : segment === 1 ? bezier(k, 0.2, 0.6, 0.35, 1) : bezier(k, 0.45, 0, 0.55, 1);
  return {
    pill: { x: lerp(a[1], b[1], eased), scaleX: lerp(a[2], b[2], eased), scaleY: lerp(a[3], b[3], eased) },
    icons: from.icons.map((icon, i) => {
      const mix = lerp(icon.mix, i === index ? 1 : 0, smooth(t));
      if (i !== index) {
        const dip = 0.1 * Math.sin(Math.PI * t) * icon.mix;
        return { mix, scaleX: lerp(icon.scaleX, 1, smooth(t)) - dip, scaleY: lerp(icon.scaleY, 1, smooth(t)) - dip, y: lerp(icon.y, 0, smooth(t)) };
      }
      const part = bounce.findIndex((stop, j) => j < bounce.length - 1 && t <= bounce[j + 1][0]);
      const start = part === 0 && interrupted ? [0, icon.scaleX, icon.scaleY, icon.y] : bounce[part];
      const end = bounce[part + 1];
      const p = smooth((t - start[0]) / (end[0] - start[0]));
      return { mix, scaleX: lerp(start[1], end[1], p), scaleY: lerp(start[2], end[2], p), y: lerp(start[3], end[3], p) };
    }),
  };
}
