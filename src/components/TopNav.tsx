"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Keyboard, ChevronDown, LogOut } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { logoutAction } from "@/app/login/actions";

interface TopNavProps {
  nama: string;
  role: string;
}

export function TopNav({ nama, role }: TopNavProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const initials = nama
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function triggerSearch() {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }

  return (
    <nav className="no-print relative z-30 hidden h-[76px] w-full shrink-0 items-center justify-between border-b border-border bg-[var(--topnav-bg)] px-6 backdrop-blur-xl transition-[background-color] duration-200 lg:flex xl:px-8">
      <button
        onClick={triggerSearch}
        className="flex w-full max-w-[360px] items-center justify-between rounded-xl border border-border bg-white/80 px-3 py-2 text-slate-500 shadow-sm transition hover:border-[var(--primary)]/35 hover:bg-card dark:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-950 cursor-pointer"
      >
        <span className="flex items-center gap-2.5 text-xs font-semibold">
          <Search size={15} /> Cari barang, invoice, klien...
        </span>
        <span className="flex items-center gap-0.5 rounded border border-primary-100 dark:border-primary-900/40 bg-[var(--primary-soft)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[var(--primary)]">
          <Keyboard size={10} /> Ctrl+K
        </span>
      </button>

      <div className="flex items-center gap-3 xl:gap-4">
        <ThemeToggle />
        <NotificationCenter role={role} />
        <span className="h-6 w-px bg-border" />

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen((open) => !open)}
            className="flex items-center gap-3 rounded-2xl px-2.5 py-2 transition hover:bg-[var(--surface-hover)] cursor-pointer"
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary-strong)] uppercase border border-primary-200/70 dark:border-primary-800/40 select-none">
              {initials}
            </div>
            <div className="leading-tight text-left select-none">
              <p className="text-xs font-bold text-foreground dark:text-slate-200">{nama}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                {role === "ADMIN_KASIR" ? "Kasir POS" : role === "ADMIN_NONGUDANG" ? "Non-Gudang" : "Gudang & Logistik"}
              </p>
            </div>
            <ChevronDown size={16} className={`text-[var(--text-muted-2)] transition-transform ${isProfileOpen ? "rotate-180" : ""}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-[calc(100%+12px)] z-40 w-72 rounded-2xl border border-border bg-[var(--card)] p-3 shadow-[var(--shadow-drawer)]">
              <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-sm font-extrabold uppercase text-[var(--primary-strong)]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{nama}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                    {role === "ADMIN_KASIR" ? "Kasir POS" : role === "ADMIN_NONGUDANG" ? "Non-Gudang" : "Gudang & Logistik"}
                  </p>
                </div>
              </div>

              <form action={logoutAction} className="mt-3">
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-left text-sm font-semibold text-rose-500 transition hover:border-rose-400/40 hover:bg-rose-500/10 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <LogOut size={16} />
                    Logout
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-rose-400">Keluar</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
