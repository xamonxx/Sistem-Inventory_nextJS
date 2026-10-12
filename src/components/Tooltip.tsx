"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface TooltipProps {
  /** Judul singkat (baris utama, tebal). */
  label: string;
  /** Baris kedua opsional — penjelasan agar lebih informatif. */
  description?: string;
  /** Sisi default kemunculan; otomatis membalik jika ruang tidak cukup. */
  side?: "top" | "bottom";
  /** Elemen pemicu (biasanya sebuah tombol). */
  children: React.ReactNode;
  /** Kelas tambahan untuk span pembungkus anchor. */
  className?: string;
  /** Jeda sebelum tooltip muncul (ms). */
  delay?: number;
}

const GAP = 10; // jarak tooltip ke anchor
const EDGE = 8; // padding minimum dari tepi viewport

/**
 * Tooltip melayang berbasis portal — lolos dari container ber-`overflow`
 * (mis. tabel), diposisikan via getBoundingClientRect, dan otomatis membalik
 * sisi bila ruang tidak cukup. Bergaya liquid glass mengikuti token app.
 */
export function Tooltip({
  label,
  description,
  side = "top",
  children,
  className,
  delay = 120,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipId = useId();

  const [pos, setPos] = useState<{
    top: number;
    left: number;
    arrowLeft: number;
    placement: "top" | "bottom";
    ready: boolean;
  }>({ top: 0, left: 0, arrowLeft: 0, placement: side, ready: false });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;

    const r = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;

    // Tentukan sisi: hormati preferensi, balik bila mepet tepi.
    let placement = side;
    const topSpace = r.top - th - GAP;
    const bottomSpace = window.innerHeight - r.bottom - th - GAP;
    if (placement === "top" && topSpace < EDGE && bottomSpace > topSpace) placement = "bottom";
    if (placement === "bottom" && bottomSpace < EDGE && topSpace > bottomSpace) placement = "top";

    const top = placement === "top" ? r.top - th - GAP : r.bottom + GAP;

    let left = r.left + r.width / 2 - tw / 2;
    left = Math.min(Math.max(left, EDGE), window.innerWidth - tw - EDGE);

    const anchorCenterX = r.left + r.width / 2;
    const arrowLeft = Math.min(Math.max(anchorCenterX - left, 12), tw - 12);

    setPos({ top, left, arrowLeft, placement, ready: true });
  }, [side]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPos((p) => ({ ...p, ready: false }));
    setOpen(false);
  }, []);

  return (
    <span
      ref={anchorRef}
      className={cn("inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? tipId : undefined}
    >
      {children}
      {open && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className="app-tooltip max-w-[240px]"
            data-ready={pos.ready ? "true" : "false"}
            data-placement={pos.placement}
            style={{ top: pos.top, left: pos.left, visibility: pos.ready ? "visible" : "hidden" }}
          >
            <p className="leading-tight">{label}</p>
            {description && <p className="app-tooltip-desc leading-snug">{description}</p>}
            <span className="app-tooltip-arrow" style={{ left: pos.arrowLeft }} />
          </div>,
          document.body
        )}
    </span>
  );
}
