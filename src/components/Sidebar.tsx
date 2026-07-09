"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  PackagePlus,
  RotateCcw,
  FileText,
  BarChart3,
  Users,
  UserRound,
  Store,
  LogOut,
  History,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { AppLogo } from "./AppLogo";

type Item = { href: string; label: string; icon: React.ElementType; roles?: Role[] };

const OPERASIONAL: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN_KASIR", "ADMIN_GUDANG"] },
  { href: "/kasir", label: "Kasir", icon: ShoppingCart, roles: ["ADMIN_KASIR"] },
  { href: "/retur", label: "Retur / Tukar", icon: RotateCcw, roles: ["ADMIN_KASIR", "ADMIN_GUDANG"] },
];

const KEUANGAN: Item[] = [
  { href: "/invoice", label: "Invoice", icon: FileText, roles: ["ADMIN_KASIR", "ADMIN_GUDANG"] },
];

// Modul Non-Gudang (trading) — hanya ADMIN_NONGUDANG. Item ditambah bertahap.
const NON_GUDANG: Item[] = [
  { href: "/non-gudang", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN_NONGUDANG"] },
  { href: "/non-gudang/barang", label: "Master Barang", icon: Boxes, roles: ["ADMIN_NONGUDANG"] },
  { href: "/non-gudang/buat-invoice", label: "Keranjang CO", icon: ShoppingCart, roles: ["ADMIN_NONGUDANG"] },
  { href: "/non-gudang/invoice", label: "Riwayat Invoice", icon: FileText, roles: ["ADMIN_NONGUDANG"] },
  { href: "/non-gudang/pembelian", label: "Riwayat Pembelian", icon: Store, roles: ["ADMIN_NONGUDANG"] },
  { href: "/non-gudang/konsumen", label: "Konsumen", icon: UserRound, roles: ["ADMIN_NONGUDANG"] },
  { href: "/non-gudang/laporan", label: "Laporan", icon: BarChart3, roles: ["ADMIN_NONGUDANG"] },
];

const PERSEDIAAN: Item[] = [
  { href: "/barang", label: "Master Barang", icon: Boxes, roles: ["ADMIN_GUDANG"] },
  { href: "/stok", label: "Stok", icon: PackagePlus, roles: ["ADMIN_GUDANG"] },
];

const ANALITIK: Item[] = [
  { href: "/laporan", label: "Laporan", icon: BarChart3, roles: ["ADMIN_GUDANG"] },
];

const ADMINISTRASI: Item[] = [
  { href: "/log-aktivitas", label: "Log Aktivitas", icon: History, roles: ["ADMIN_GUDANG"] },
  { href: "/pengguna", label: "Pengguna", icon: Users, roles: ["ADMIN_GUDANG"] },
];

type SidebarProps = {
  role: Role;
  nama: string;
  defaultCollapsed?: boolean;
};

function SidebarContent({
  role,
  nama,
  defaultCollapsed = false,
  searchParams,
}: SidebarProps & { searchParams: URLSearchParams | null }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isLogoutOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsLogoutOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isLogoutOpen]);

  const openLogoutModal = () => {
    setIsOpen(false);
    setIsLogoutOpen(true);
  };

  const confirmLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    window.location.assign("/logout");
  };

  useEffect(() => {
    setIsCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  const initials = nama.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const filterVisible = (items: Item[]) => items.filter((i) => !i.roles || i.roles.includes(role));

  const isActive = (href: string) => {
    const [hrefPath, hrefQuery] = href.split("?");
    const isPathMatch = hrefPath === "/" ? pathname === "/" : pathname === hrefPath;
    if (!isPathMatch) return false;

    if (hrefQuery) {
      if (!searchParams) return false;
      const search = new URLSearchParams(hrefQuery);
      for (const [key, val] of search.entries()) {
        if (searchParams.get(key) !== val) return false;
      }
      return true;
    }

    return true;
  };

  const renderSection = (title: string, items: Item[]) => {
    const visibleItems = filterVisible(items);
    if (visibleItems.length === 0) return null;

    return (
      <div className="space-y-1">
        <p className={cn(
          "px-4 pt-4 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--chrome-muted)] transition-[opacity,max-height,padding] duration-200 truncate origin-left select-none",
          isCollapsed ? "lg:opacity-0 lg:max-h-0 lg:pt-0 lg:pb-0 lg:overflow-hidden" : ""
        )}>
          {title}
        </p>
        {visibleItems.map((i) => {
          const active = isActive(i.href);
          const Icon = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setIsOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center rounded-xl border px-3 py-2.5 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 select-none w-full overflow-visible",
                isCollapsed ? "lg:justify-center lg:px-0" : "",
                active
                  ? "chrome-nav-link-active"
                  : "chrome-nav-link border-transparent"
              )}
            >
              {/* Active rail — only for full-width rows (expanded desktop + mobile
                  drawer). Hidden on the collapsed icon rail, where it would poke out
                  of the rounded tile's corner. */}
              {active && (
                <span
                  className={cn(
                    "absolute left-[-1px] top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.65)]",
                    isCollapsed ? "lg:hidden" : ""
                  )}
                />
              )}
              <div className="flex items-center justify-center shrink-0 w-5 h-5">
                <Icon
                  size={16}
                  strokeWidth={active ? 2.5 : 2}
                  className={cn(
                    "transition-colors duration-200",
                    active
                      ? "text-[var(--primary-strong)] dark:text-sky-300"
                      : "text-[var(--chrome-muted)] group-hover:text-[var(--chrome-ink)]"
                  )}
                />
              </div>
              <span className={cn(
                "transition-[opacity,max-width,margin] duration-200 ease-in-out truncate origin-left",
                isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:ml-0" : "opacity-100 max-w-[200px] ml-3"
              )}>
                {i.label}
              </span>
              <span className={cn(
                "absolute left-full z-50 ml-3 translate-x-[-4px] whitespace-nowrap rounded-md border border-white/10 bg-[#0f172a] px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-lg transition-[opacity,transform] duration-150 pointer-events-none group-hover:translate-x-0 group-hover:opacity-100",
                isCollapsed ? "" : "hidden"
              )}>
                {i.label}
              </span>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Top Navbar Header — GradientDeck Premium */}
      <header
        className="app-chrome-surface no-print sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b px-3 text-[var(--chrome-ink)] backdrop-blur-2xl backdrop-saturate-150 sm:px-4 lg:hidden"
      >
        <button
          onClick={() => setIsOpen(true)}
          className="chrome-icon-button flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl backdrop-blur-xl backdrop-saturate-150 transition"
        >
          <Menu size={20} />
        </button>
        <span className="min-w-0 truncate px-2 text-center text-[14px] font-extrabold uppercase tracking-tight sm:text-[15px]">
          PUTRA CORPORATION
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={openLogoutModal}
            data-testid="mobile-logout-button"
            className="chrome-avatar flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold uppercase backdrop-blur-xl backdrop-saturate-150"
            aria-label="Buka konfirmasi keluar"
            title="Keluar"
          >
            {initials}
          </button>
        </div>
      </header>

      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[45] bg-slate-900/70 backdrop-blur-sm transition-opacity lg:hidden"
        />
      )}

      {/* Sidebar Navigation — GradientDeck Premium Liquid Glass */}
       <aside
         className={cn(
           "app-sidebar-surface app-chrome-surface no-print border-r text-[var(--chrome-ink)] backdrop-blur-2xl backdrop-saturate-150",
           "lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:flex lg:h-screen lg:shrink-0 lg:flex-col lg:transition-[width] lg:duration-200 lg:ease-in-out lg:z-50",
           isCollapsed ? "lg:w-[72px]" : "lg:w-[240px]",
           "max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:z-50 max-lg:h-[100dvh] max-lg:w-[min(374px,92vw)] flex flex-col max-lg:transition-transform max-lg:duration-200 max-lg:ease-in-out",
           isOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
         )}
          style={{
            willChange: "transform, width",
          }}
       >
           {/* Brand logo & Close button — GradientDeck Premium */}
           <div className={cn(
             "chrome-hairline relative z-10 flex h-16 w-full items-center overflow-hidden border-b transition-[padding] duration-200 lg:h-[76px]",
             isCollapsed ? "lg:px-4 lg:justify-center" : "px-5"
           )}
           >
             <div className="relative z-10 flex min-w-0 flex-1 items-center">
               <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-[0_14px_32px_rgba(14,165,233,0.28)]">
               <AppLogo className="h-7 w-7" />
             </div>
            <div className={cn(
              "leading-tight transition-[opacity,max-width,margin] duration-200 ease-in-out truncate origin-left",
              isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:ml-0 lg:overflow-hidden lg:invisible" : "opacity-100 max-w-[180px] ml-3"
            )}>
              <p className="font-display text-sm font-black uppercase tracking-tight text-[var(--chrome-ink)]">PUTRA CORP</p>
              <div className="mt-0.5 w-max rounded-[4px] border border-[var(--chrome-border)] bg-white/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-[var(--chrome-soft)] select-none">
                SOFTWARE ERP
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="chrome-icon-button relative z-20 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg backdrop-blur-xl backdrop-saturate-150 transition lg:hidden"
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items (Scrollable without visible scrollbars) */}
        <nav className={cn(
          "flex-1 px-4 py-4 space-y-1.5 scrollbar-none",
          isCollapsed ? "lg:overflow-y-visible" : "overflow-y-auto"
        )}>
          {renderSection("OPERASIONAL", OPERASIONAL)}
          {renderSection("KEUANGAN", KEUANGAN)}
          {renderSection("PERSEDIAAN", PERSEDIAAN)}
          {renderSection("ANALITIK", ANALITIK)}
          {renderSection("ADMINISTRASI", ADMINISTRASI)}
          {renderSection("NON-GUDANG", NON_GUDANG)}
        </nav>

        {/* Desktop Collapse Toggle Row */}
        <div className="chrome-hairline hidden overflow-visible border-t px-4 py-2 lg:block">
          <button
            onClick={() => {
              const next = !isCollapsed;
              setIsCollapsed(next);
              document.cookie = `si_sidebar_collapsed=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
            }}
            className={cn(
              "chrome-nav-link group relative flex w-full cursor-pointer items-center overflow-visible rounded-xl border border-transparent px-3 py-2.5 text-xs font-semibold transition-[background-color,border-color,color] duration-200",
              isCollapsed ? "lg:justify-center lg:px-0" : ""
            )}
          >
          <div className="flex items-center justify-center shrink-0 w-5 h-5">
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </div>
          <span className={cn(
            "transition-[opacity,max-width,margin] duration-200 ease-in-out truncate origin-left",
            isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:ml-0" : "opacity-100 max-w-[180px] ml-3"
          )}>
            Sembunyikan Menu
          </span>
          <span className={cn(
            "absolute left-full z-50 ml-3 translate-x-[-4px] whitespace-nowrap rounded-md border border-white/10 bg-[#0f172a] px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-lg transition-[opacity,transform] duration-150 pointer-events-none group-hover:translate-x-0 group-hover:opacity-100",
            isCollapsed ? "" : "hidden"
          )}>
            Buka Menu
          </span>
          </button>
        </div>

          {/* User profile & Logout — GradientDeck Liquid Glass */}
          <div className={cn(
            "chrome-hairline relative z-10 border-t pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[background-color,border-color] duration-200",
            isCollapsed ? "lg:overflow-visible p-2 lg:pb-2" : "overflow-hidden p-3 lg:pb-3"
          )}
          >
          <button
            type="button"
            onClick={openLogoutModal}
            data-testid="sidebar-user-menu-button"
            aria-label="Buka konfirmasi keluar"
            className={cn(
                "group relative z-10 flex w-full cursor-pointer items-center rounded-xl border text-left",
                // Collapsed: show only the avatar tile (no wrapping panel, which
                // looked like a box-in-a-box). Expanded: full soft panel.
                isCollapsed
                  ? "justify-center border-transparent bg-transparent p-0 shadow-none"
                  : "chrome-soft-panel gap-3 p-2.5 backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color,box-shadow] duration-150 hover:border-[var(--chrome-active-border)]"
              )}
            >
              <div className="chrome-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold uppercase backdrop-blur-xl backdrop-saturate-150">
               {initials}
             </div>
            <div className={cn(
              "min-w-0 leading-tight transition-[opacity,max-width,margin] duration-200 ease-in-out truncate origin-left",
              isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:ml-0 lg:overflow-hidden lg:invisible" : "opacity-100 max-w-[180px] ml-3"
            )}>
              <p className="truncate text-xs font-bold text-[var(--chrome-ink)]">{nama}</p>
              <p className="mt-0.5 select-none text-[9px] font-bold uppercase tracking-wider text-[var(--chrome-soft)]">
                {role === "ADMIN_KASIR" ? "KASIR POS" : role === "ADMIN_NONGUDANG" ? "NON-GUDANG" : "GUDANG LOGISTIK"}
              </p>
            </div>
          </button>
          <button
            onClick={openLogoutModal}
            data-testid="sidebar-logout-button"
            className={cn(
              "group relative flex w-full cursor-pointer items-center overflow-visible rounded-xl border text-[var(--chrome-muted)] hover:text-rose-600 dark:hover:text-rose-300",
              isCollapsed
                ? "lg:justify-center lg:py-2.5 border-transparent bg-transparent"
                : "mt-2 border-[var(--chrome-border)] bg-white/55 px-3 py-2 text-xs font-semibold transition-[background-color,border-color,color] duration-150 hover:border-rose-400/35 hover:bg-rose-50 dark:bg-white/[0.035] dark:hover:border-rose-400/25 dark:hover:bg-rose-500/10"
            )}

          >
            <div className="flex items-center justify-center shrink-0 w-5 h-5">
              <LogOut size={16} className="shrink-0" />
            </div>
            <span className={cn(
              "transition-[opacity,max-width,margin] duration-200 ease-in-out truncate origin-left",
              isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:ml-0" : "opacity-100 max-w-[180px] ml-3"
            )}>
              Keluar
            </span>
            <span className={cn(
              "absolute left-full z-50 ml-3 translate-x-[-4px] whitespace-nowrap rounded-md border border-white/10 bg-[#0f172a] px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-lg transition-[opacity,transform] duration-150 pointer-events-none group-hover:translate-x-0 group-hover:opacity-100",
              isCollapsed ? "" : "hidden"
            )}>
              Keluar
            </span>
          </button>
        </div>
      </aside>

      {/* Modal konfirmasi keluar */}
      {isLogoutOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => !isLoggingOut && setIsLogoutOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="anim-rise w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-[var(--shadow-modal)] dark:bg-[#102133]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 dark:bg-rose-500/15">
                <LogOut size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="logout-title" className="text-base font-bold text-foreground">
                  Keluar dari Sistem?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Anda akan diarahkan ke halaman login. Pastikan pekerjaan sudah disimpan sebelum keluar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isLoggingOut && setIsLogoutOpen(false)}
                className="text-slate-400 transition hover:text-foreground cursor-pointer"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsLogoutOpen(false)}
                disabled={isLoggingOut}
                className="h-10 w-full rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                data-testid="logout-confirm-button"
                disabled={isLoggingOut}
                className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white transition-[background-color,box-shadow,transform] hover:bg-rose-700 hover:shadow-lg hover:shadow-rose-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <LogOut size={14} />
                {isLoggingOut ? "Mengeluarkan..." : "Ya, Keluar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SidebarWithSearchParams(props: SidebarProps) {
  const searchParams = useSearchParams();
  return <SidebarContent {...props} searchParams={searchParams} />;
}

export function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<SidebarContent {...props} searchParams={null} />}>
      <SidebarWithSearchParams {...props} />
    </Suspense>
  );
}
