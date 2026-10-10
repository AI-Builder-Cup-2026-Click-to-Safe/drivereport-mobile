// The live API returns a verdict at once. An empty law list after completion is
// a result, not an unfinished law lookup.
export function lawPlaceholder(stage: number, done: boolean, hasIncludedOffences: boolean) {
  if (!done && stage === 2)
    return { value: "Searching JPJ law", wait: true };
  return {
    value: hasIncludedOffences ? "No law citation returned" : "No applicable offence found",
    wait: false,
  };
}

// Only present a total when every source has a server estimate. Old reviews
// and failed runs must not look like free analysis or a complete partial total.
export function reviewCost(values: (number | undefined)[], running: boolean) {
  if (running) return { value: null, note: "Calculated after analysis" };
  if (!values.length || values.some((n) => n === undefined || !Number.isFinite(n) || n < 0))
    return { value: null, note: "Not available for this review" };
  return {
    value: values.reduce<number>((sum, n) => sum + (n ?? 0), 0),
    note: "Gemini tokens only · USD",
  };
}
