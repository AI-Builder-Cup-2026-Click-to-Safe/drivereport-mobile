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
