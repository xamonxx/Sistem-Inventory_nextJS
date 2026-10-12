"use client";

import { useEffect } from "react";

/**
 * Mengunci scroll halaman selama ada overlay layar-penuh (modal, dialog, drawer,
 * command palette) yang tampil. Satu penjaga global menggantikan kunci per-modal,
 * sehingga modal baru otomatis ikut terkunci tanpa kode tambahan.
 *
 * Overlay dikenali lewat `.fixed.inset-0` yang benar-benar terlihat dan menerima
 * pointer (Drawer yang tertutup memakai pointer-events-none sehingga diabaikan).
 */
function hasVisibleOverlay() {
  const nodes = document.querySelectorAll<HTMLElement>(".fixed.inset-0");
  for (const el of nodes) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.pointerEvents === "none") continue;
    return true;
  }
  return false;
}

export function ScrollLockGuard() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    let locked = false;
    let frame = 0;

    const lock = () => {
      // Kompensasi lebar scrollbar agar layout di belakang modal tidak bergeser.
      const gap = window.innerWidth - html.clientWidth;
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      if (gap > 0) body.style.paddingRight = `${gap}px`;
    };

    const unlock = () => {
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.paddingRight = "";
    };

    const sync = () => {
      frame = 0;
      const shouldLock = hasVisibleOverlay();
      if (shouldLock === locked) {
        // Kunci lokal komponen lain (mis. Drawer) bisa mengosongkan overflow saat ditutup.
        if (locked && body.style.overflow !== "hidden") lock();
        return;
      }
      locked = shouldLock;
      if (locked) lock();
      else unlock();
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    sync();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      unlock();
    };
  }, []);

  return null;
}
