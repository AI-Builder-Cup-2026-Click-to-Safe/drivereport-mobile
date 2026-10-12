import { useRef, useState } from "react";

/**
 * Stable wrappers that always call the latest render's functions. A provider can then memoise its
 * context value on state alone, so consumers and effects stop reacting to fresh function identities.
 */
export function useLatestCallbacks<
  T extends Record<string, (...args: never[]) => unknown>,
>(fns: T): T {
  const latest = useRef(fns);
  latest.current = fns;
  const [stable] = useState(
    () =>
      Object.fromEntries(
        Object.keys(fns).map((key) => [
          key,
          (...args: never[]) => latest.current[key](...args),
        ]),
      ) as T,
  );
  return stable;
}
