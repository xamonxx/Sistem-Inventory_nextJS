"use client";

import { Search, Keyboard } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

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
    <nav className="no-print hidden lg:flex h-20 w-full items-center justify-between border-b border-border bg-white px-8 shrink-0">
      {/* Search trigger button */}
      <button
        onClick={triggerSearch}
        className="flex w-72 items-center justify-between rounded-xl border border-border bg-slate-50/50 px-3 py-2 text-slate-400 hover:bg-slate-50 transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5 text-xs font-semibold">
          <Search size={15} /> Cari barang, invoice, klien...
        </span>
        <span className="flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-400">
          <Keyboard size={10} /> ⌘K
        </span>
      </button>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <NotificationCenter role={role} />

        {/* Vertical divider line */}
        <span className="h-6 w-px bg-border" />

        {/* User profile capsule */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-xs font-bold text-[var(--primary)] uppercase border border-orange-200/50 select-none">
            {initials}
          </div>
          <div className="leading-tight select-none">
            <p className="text-xs font-bold text-slate-800">{nama}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] mt-0.5">
              {role === "ADMIN_KASIR" ? "Kasir POS" : "Gudang & Logistik"}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}
