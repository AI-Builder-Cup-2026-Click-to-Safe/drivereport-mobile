/** Source: handover 3ae6b66, Capture arrives, +1000ms hold and 1.5x entrance. */
export const HOME_END = 3670;
export const APERTURE_START = 1255;
export const APERTURE_END = 2140;
export const IRIS_END = 2875;
export const entranceAt = (delay: number) => 1000 + delay * 1.5;
export const entranceDuration = (duration: number) => duration * 1.5;
export const progress = (time: number, start: number, duration: number) =>
  Math.max(0, Math.min(1, (time - start) / duration));
export function apertureGeometry(width: number, height: number) {
  return {
    x: width / 2,
    y: height / 2,
    radius: Math.hypot(width, height) / 2 + 1,
  };
}
