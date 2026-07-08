"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Keyboard, ChevronDown, LogOut } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";

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
     <nav className="app-chrome-surface chrome-hairline no-print relative z-30 hidden h-[76px] w-full shrink-0 items-center justify-between border-b px-6 shadow-[0_16px_38px_-32px_rgba(14,165,233,0.55),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-2xl backdrop-saturate-150 transition-[background-color,border-color,box-shadow] duration-200 lg:flex xl:px-8">
       <button
         onClick={triggerSearch}
         className="chrome-soft-panel flex w-full max-w-[420px] cursor-pointer items-center justify-between rounded-2xl px-4 py-2.5 text-[var(--chrome-muted)] backdrop-blur-xl backdrop-saturate-150 transition-[border-color,color,box-shadow] hover:border-[var(--chrome-active-border)] hover:text-[var(--chrome-ink)]"
       >
         <span className="flex items-center gap-2.5 text-[13px] font-semibold">
           <Search size={16} strokeWidth={2.5} /> Cari barang, invoice, klien...
         </span>
         <span className="flex items-center gap-0.5 rounded-md border border-[var(--chrome-active-border)] bg-sky-500/10 px-2 py-1 font-mono text-[10px] font-bold text-[var(--primary)] shadow-[0_8px_18px_rgba(14,165,233,0.12)]">
           <Keyboard size={11} /> Ctrl+K
         </span>
       </button>

      <div className="flex items-center gap-3 xl:gap-4">
        <ThemeToggle />
        <NotificationCenter role={role} />
        <span className="h-6 w-px bg-[var(--chrome-border)]" />

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen((open) => !open)}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition-[background-color,border-color,box-shadow] ${
              isProfileOpen
                ? "border-[var(--chrome-active-border)] bg-white/[0.055] shadow-[0_14px_32px_rgba(14,165,233,0.12)]"
                : "border-transparent hover:border-[var(--chrome-border)] hover:bg-white/[0.035]"
            }`}
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
          >
            <div className="chrome-avatar flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold uppercase select-none">
              {initials}
            </div>
            <div className="leading-tight text-left select-none">
              <p className="text-xs font-bold text-[var(--chrome-ink)]">{nama}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                {role === "ADMIN_KASIR" ? "Kasir POS" : role === "ADMIN_NONGUDANG" ? "Non-Gudang" : "Gudang & Logistik"}
              </p>
            </div>
            <ChevronDown size={16} className={`text-[var(--chrome-muted)] transition-transform ${isProfileOpen ? "rotate-180" : ""}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-[calc(100%+12px)] z-40 w-72 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-modal)] dark:border-[var(--chrome-border)] dark:bg-[#102133]">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-[var(--surface-2)] px-4 py-3.5 dark:border-[var(--chrome-border)] dark:bg-[var(--surface-2)]">
                <div className="chrome-avatar flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold uppercase">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{nama}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                    {role === "ADMIN_KASIR" ? "Kasir POS" : role === "ADMIN_NONGUDANG" ? "Non-Gudang" : "Gudang & Logistik"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <a
                  href="/logout"
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-rose-600 transition-[background-color,border-color,color] hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
                >
                  <span className="flex items-center gap-2">
                    <LogOut size={16} />
                    Logout
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-rose-400">Keluar</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
