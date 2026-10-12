"use client";

import { useSyncExternalStore } from "react";

/**
 * Status media query di client. Mengembalikan `null` saat SSR/hidrasi sehingga
 * pemanggil bisa menunda render komponen yang hanya boleh ada satu instance
 * (mis. NotificationCenter yang melakukan polling).
 */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => null
  );
}

/** Breakpoint `lg` Tailwind (1024px): batas navbar desktop vs header mobile/tablet. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
