"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: "small" | "medium" | "large";
  children: React.ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  size = "medium",
  children,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Disable background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  const widths = {
    small: "max-w-[500px]",
    medium: "max-w-[700px]",
    large: "max-w-[900px]",
  };

  const drawer = (
    <div
      className={cn(
        "fixed inset-0 flex items-end justify-center overflow-hidden transition-opacity duration-300 sm:items-stretch sm:justify-end",
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
      // Sedikit di bawah nilai maksimum agar overlay yang dibuka DARI dalam
      // drawer (mis. pratinjau cetak, dialog konfirmasi) bisa tampil di atasnya.
      style={{ zIndex: 2147483000 }}
    >
      {/* Backdrop overlay */}
      <div
        className={cn(
          "absolute inset-0 z-0 bg-slate-950/35 backdrop-blur-xs transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 flex h-[92dvh] w-full flex-col rounded-t-2xl border-t border-border bg-card shadow-[var(--shadow-drawer)] transition-transform duration-300 ease-out sm:h-full sm:rounded-none sm:border-l sm:border-t-0 dark:bg-card",
          widths[size],
          isOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full"
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6 sm:py-5">
          <h3 className="text-lg font-bold text-foreground tracking-tight leading-none">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted-2)] hover:bg-[var(--surface-hover)] hover:text-foreground transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6 sm:py-6">
          {children}
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(drawer, document.body);
}
