/** Incident dates as the reference prints them: "3 Oct" (UK) or "Oct 3" (US), never ISO. */
export function shortDate(
  date: string | null,
  language: string,
  { timeZone, relative = false, now = new Date() }: {
    timeZone?: string;
    relative?: boolean;
    now?: Date;
  } = {},
) {
  if (!date) return "Date unknown";
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return date;
  if (relative) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    if (today === date) return "Today";
  }
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    ...(value.getUTCFullYear() === now.getFullYear()
      ? {}
      : { year: "numeric" as const }),
    timeZone: "UTC",
  }).format(value);
}

/** Uppercase with single spaces, the way a plate is printed. */
export const typedPlate = (value: string) =>
  value.toUpperCase().replace(/\s+/g, " ").trimStart();

/** "GMT+8" for an IANA zone, the way the reference labels incident times. */
export function zoneLabel(timeZone: string, at = new Date()) {
  if (/^(GMT|UTC)/.test(timeZone)) return timeZone;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).formatToParts(at);
    const part = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    const local = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
    );
    const minutes = Math.round(
      (local - Math.floor(at.getTime() / 60000) * 60000) / 60000,
    );
    if (!Number.isFinite(minutes)) return timeZone;
    const sign = minutes < 0 ? "-" : "+";
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return minutes
      ? `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`
      : "GMT";
  } catch {
    return timeZone;
  }
}
