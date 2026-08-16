"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe subscription to a localStorage key.
 *
 * Returns the parsed value (or `fallback` on the server / on parse error).
 * Re-renders the consumer whenever another tab mutates the same key
 * (via the `storage` event) or the same tab calls `setLocalStorage`.
 *
 * Uses `useSyncExternalStore` so it works with React 18+ concurrent
 * rendering without triggering the `react-hooks/set-state-in-effect` rule.
 */
export function useLocalStorage<T>(
  key: string,
  fallback: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const subscribe = (cb: () => void) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("storage", cb);
    // Cross-component same-tab notification via a custom event.
    window.addEventListener(`ls:${key}`, cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener(`ls:${key}`, cb);
    };
  };

  const getSnapshot = (): string => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(key) ?? "";
  };

  const getServerSnapshot = (): string => "";

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  let value: T = fallback;
  try {
    value = raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    value = fallback;
  }

  const setValue = (next: T | ((prev: T) => T)) => {
    if (typeof window === "undefined") return;
    try {
      const cur = window.localStorage.getItem(key);
      const curVal: T = cur ? (JSON.parse(cur) as T) : fallback;
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(curVal) : next;
      window.localStorage.setItem(key, JSON.stringify(resolved));
      // Notify same-tab subscribers (the `storage` event only fires cross-tab).
      window.dispatchEvent(new Event(`ls:${key}`));
    } catch {
      // ignore quota / parse errors
    }
  };

  return [value, setValue];
}
