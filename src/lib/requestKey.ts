"use client";

import { useMemo, useRef } from "react";

/** Shown when the server could not be reached; retrying with the same key is safe. */
export const NETWORK_RETRY_MESSAGE =
  "Gagal terhubung ke server. Periksa koneksi lalu klik simpan lagi tanpa memuat ulang halaman; data yang sudah tersimpan tidak akan tercatat ganda.";

/** Shown when the server returned a result that was already committed by an earlier attempt. */
export const REPLAYED_MESSAGE = "Permintaan ini sudah tersimpan sebelumnya. Menampilkan hasil yang tersimpan.";

/** Random UUID v4; falls back to getRandomValues on insecure origins (LAN http). */
export function newRequestKey(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Idempotency key for one mutation attempt. `get` returns the same key until
 * `reset` is called, so a retry after a network failure replays the stored
 * result instead of creating a duplicate. Call `reset` after any definitive
 * server response (success or validation error). A different `target`
 * (e.g. another invoice) starts a new key.
 */
export function useRequestKey() {
  const ref = useRef<{ target: string; key: string } | null>(null);
  return useMemo(
    () => ({
      get(target = "") {
        if (!ref.current || ref.current.target !== target) {
          ref.current = { target, key: newRequestKey() };
        }
        return ref.current.key;
      },
      reset() {
        ref.current = null;
      },
    }),
    []
  );
}
