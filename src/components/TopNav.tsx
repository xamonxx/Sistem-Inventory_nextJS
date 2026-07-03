"use client";

import { Search, Keyboard } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";

interface TopNavProps {
  nama: string;
  role: string;
}

export function TopNav({ nama, role }: TopNavProps) {
  const initials = nama
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Focus Command Palette helper
  function triggerSearch() {
    // Dispatch ctrl+k keydown event to open CommandPalette
    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }

  return (
    <nav className="no-print hidden lg:flex h-[76px] w-full items-center justify-between border-b border-border bg-[var(--topnav-bg)] px-8 shrink-0 backdrop-blur-xl transition-[background-color] duration-200">
      {/* Search trigger button */}
      <button
        onClick={triggerSearch}
        className="flex w-80 items-center justify-between rounded-lg border border-border bg-white/80 dark:bg-slate-900/80 px-3 py-2 text-slate-500 dark:text-slate-400 shadow-sm transition hover:border-[var(--primary)]/35 hover:bg-card dark:hover:bg-slate-950 cursor-pointer"
      >
        <span className="flex items-center gap-2.5 text-xs font-semibold">
          <Search size={15} /> Cari barang, invoice, klien...
        </span>
        <span className="flex items-center gap-0.5 rounded border border-primary-100 dark:border-primary-900/40 bg-[var(--primary-soft)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[var(--primary)]">
          <Keyboard size={10} /> ⌘K
        </span>
      </button>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Theme Toggler */}
        <ThemeToggle />

        {/* Notification Bell */}
        <NotificationCenter role={role} />

        {/* Vertical divider line */}
        <span className="h-6 w-px bg-border" />

        {/* User profile capsule */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary-strong)] uppercase border border-primary-200/70 dark:border-primary-800/40 select-none">
            {initials}
          </div>
          <div className="leading-tight select-none">
            <p className="text-xs font-bold text-foreground dark:text-slate-200">{nama}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] mt-0.5">
              {role === "ADMIN_KASIR" ? "Kasir POS" : "Gudang & Logistik"}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}
