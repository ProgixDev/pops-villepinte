import { useEffect, useState } from "react";

type IdleHandle = number;
type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type RICFn = (cb: IdleCallback, opts?: { timeout?: number }) => IdleHandle;
type CICFn = (handle: IdleHandle) => void;

/**
 * Returns `true` after the first idle window post-mount. Use to defer
 * heavy / decorative children so the initial paint is fast.
 *
 * Prefers `requestIdleCallback` (replaces the deprecated `InteractionManager`),
 * falls back to `setTimeout(0)` on older runtimes.
 */
export function useDeferredMount(timeoutMs = 500): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const g = globalThis as unknown as {
      requestIdleCallback?: RICFn;
      cancelIdleCallback?: CICFn;
    };
    if (typeof g.requestIdleCallback === "function") {
      const handle = g.requestIdleCallback(() => setReady(true), {
        timeout: timeoutMs,
      });
      return () => g.cancelIdleCallback?.(handle);
    }
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, [timeoutMs]);
  return ready;
}
