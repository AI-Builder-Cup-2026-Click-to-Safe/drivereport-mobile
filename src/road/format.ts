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
