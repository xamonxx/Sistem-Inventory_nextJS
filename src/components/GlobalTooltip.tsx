"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 8; // jarak tooltip ke anchor
const EDGE = 8; // padding minimum dari tepi viewport
const DELAY = 280; // ms sebelum tooltip muncul

type Tip = { text: string; anchor: HTMLElement };
type Pos = { top: number; left: number; arrowLeft: number; placement: "top" | "bottom" };

/**
 * Satu mesin tooltip untuk seluruh aplikasi (di-mount sekali di root layout).
 *
 * - `data-tooltip="..."`: tooltip eksplisit.
 * - `title="..."`: dipindahkan ke `data-tip` saat pertama di-hover agar tooltip
 *   bawaan OS tidak muncul ganda; bila elemen tidak punya nama aksesibel,
 *   teksnya disalin ke `aria-label`.
 *
 * Dirender lewat portal (lolos dari container ber-overflow), membalik ke bawah
 * bila ruang atas tidak cukup, dan dibatasi di dalam viewport. Hanya aktif di
 * perangkat dengan hover (bukan layar sentuh).
 */
export function GlobalTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let current: HTMLElement | null = null;

    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      current = null;
      setTip(null);
      setPos(null);
    };

    const textOf = (el: HTMLElement) => {
      const native = el.getAttribute("title");
      if (native) {
        el.setAttribute("data-tip", native);
        el.removeAttribute("title");
        const hasName = el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby") || (el.textContent ?? "").trim().length > 0;
        if (!hasName) el.setAttribute("aria-label", native);
      }
      return (el.getAttribute("data-tooltip") || el.getAttribute("data-tip") || "").trim();
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest?.("[data-tooltip],[data-tip],[title]") as HTMLElement | null;
      if (!el || el === current) return;
      // SVG <title> bawaan ikon bukan atribut; elemen tanpa teks diabaikan.
      const text = textOf(el);
      if (!text) return;
      if (timer) clearTimeout(timer);
      current = el;
      setTip(null);
      setPos(null);
      timer = setTimeout(() => {
        if (current === el && el.isConnected) setTip({ text, anchor: el });
      }, DELAY);
    };

    const onOut = (e: MouseEvent) => {
      if (!current) return;
      const to = e.relatedTarget as Node | null;
      if (to && current.contains(to)) return;
      clear();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    document.addEventListener("mousedown", clear, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("blur", clear);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
      document.removeEventListener("mousedown", clear, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("blur", clear);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return;
    const r = tip.anchor.getBoundingClientRect();
    const tw = tipRef.current.offsetWidth;
    const th = tipRef.current.offsetHeight;

    const placement: Pos["placement"] = r.top - th - GAP < EDGE ? "bottom" : "top";
    const top = placement === "top" ? r.top - th - GAP : r.bottom + GAP;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.min(Math.max(left, EDGE), window.innerWidth - tw - EDGE);
    const arrowLeft = Math.min(Math.max(r.left + r.width / 2 - left, 10), tw - 10);
    setPos({ top, left, arrowLeft, placement });
  }, [tip]);

  if (!tip) return null;

  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      className="app-tooltip"
      data-ready={pos ? "true" : "false"}
      data-placement={pos?.placement ?? "top"}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      {tip.text}
      <span className="app-tooltip-arrow" style={{ left: pos?.arrowLeft ?? 0 }} />
    </div>,
    document.body
  );
}
