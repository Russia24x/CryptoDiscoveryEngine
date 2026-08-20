import * as React from "react"

/**
 * useIsMobile — subscribes to the viewport's mobile breakpoint using
 * `React.useSyncExternalStore` (the React 18+ idiomatic pattern for
 * subscribing to external browser APIs).
 *
 * Why not useState + useEffect? Calling `setState` synchronously inside
 * `useEffect` is flagged by the `react-hooks/set-state-in-effect` rule
 * (eslint-plugin-react-hooks v7+) because it:
 *   - Triggers an extra render (effect runs after paint, then setState
 *     schedules another paint).
 *   - Can cause hydration mismatches on first paint.
 *
 * `useSyncExternalStore` reads the value during render via `getSnapshot`,
 * so there is no extra render and no hydration mismatch (the server
 * snapshot is returned during SSR / first client paint, then the client
 * snapshot is used after hydration completes).
 */
const MOBILE_BREAKPOINT = 768

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot(): boolean {
  // SSR cannot know the viewport — default to desktop (false) so the
  // server-rendered markup matches the first client paint.
  return false
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
