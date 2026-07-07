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
  LogOut,
  History,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";
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

// Modul Non-Gudang (trading) — hanya ADMIN_NONGUDANG. Item ditambah per fase.
const NON_GUDANG: Item[] = [
  { href: "/non-gudang", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN_NONGUDANG"] },
  { href: "/non-gudang/barang", label: "Master Barang", icon: Boxes, roles: ["ADMIN_NONGUDANG"] },
  { href: "/non-gudang/buat-invoice", label: "Keranjang CO", icon: ShoppingCart, roles: ["ADMIN_NONGUDANG"] },
  { href: "/non-gudang/invoice", label: "Riwayat Invoice", icon: FileText, roles: ["ADMIN_NONGUDANG"] },
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

  const confirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logoutAction();
    } finally {
      setIsLoggingOut(false);
      setIsLogoutOpen(false);
    }
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
          "px-4 pt-4 pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-primary-50/35 transition-[opacity,max-height,padding] duration-200 truncate origin-left select-none",
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
              className={cn(
                "group relative flex items-center rounded-xl px-3 py-2.5 text-xs font-medium transition-[background-color,color] duration-200 select-none w-full overflow-visible",
                isCollapsed ? "lg:justify-center lg:px-0" : "",
                active
                  ? "bg-white/[0.08] text-white font-semibold"
                  : "text-primary-50/55 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3.5px] -translate-y-1/2 rounded-r-[3px] bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]" />
              )}
              <div className="flex items-center justify-center shrink-0 w-5 h-5">
                <Icon
                  size={16}
                  strokeWidth={active ? 2.5 : 2}
                  className={cn(
                    "transition-colors duration-200",
                    active
                      ? "text-[#7dd3fc]"
                      : "text-primary-50/55 group-hover:text-white"
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
                "absolute left-full ml-3 px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-bold text-white shadow-md opacity-0 pointer-events-none transition-all duration-150 whitespace-nowrap z-50 translate-x-[-4px] group-hover:translate-x-0 group-hover:opacity-100",
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
      {/* Mobile Top Navbar Header */}
      <header className="no-print sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-primary-900/50 bg-[#071b2e] px-3 text-white sm:px-4 lg:hidden">
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <span className="min-w-0 truncate px-2 text-center text-[14px] font-black uppercase tracking-tight text-white sm:text-[15px]">
          PUTRA CORPORATION
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={openLogoutModal}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white uppercase border border-white/10 transition hover:bg-white/20 cursor-pointer"
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
          className="fixed inset-0 z-[45] bg-slate-900/60 backdrop-blur-xs transition-opacity lg:hidden"
        />
      )}

      {/* Sidebar Navigation Panel Drawer */}
      <aside
        className={cn(
          "no-print bg-[#071b2e] text-primary-50/80",
          "lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:flex lg:h-screen lg:shrink-0 lg:flex-col lg:border-r lg:border-primary-950/70 lg:transition-[width] lg:duration-200 lg:ease-in-out lg:z-30",
          isCollapsed ? "lg:w-[72px]" : "lg:w-[240px]",
          "max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:z-50 max-lg:h-[100dvh] max-lg:w-[min(300px,85vw)] flex flex-col max-lg:transition-transform max-lg:duration-200 max-lg:ease-in-out",
          isOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        )}
        style={{ willChange: "width" }}
      >
        {/* Brand logo & Close button */}
        <div className={cn(
          "flex items-center h-16 lg:h-[76px] w-full border-b border-white/10 overflow-hidden transition-[padding] duration-200",
          isCollapsed ? "lg:px-4 lg:justify-center" : "px-5"
        )}>
          <div className="flex items-center w-full">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[var(--primary)] to-[#38bdf8] text-white shadow-[0_0_18px_rgba(2,132,199,0.35)]">
              <AppLogo className="h-7 w-7" />
            </div>
            <div className={cn(
              "leading-tight transition-[opacity,max-width,margin] duration-200 ease-in-out truncate origin-left",
              isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:ml-0 lg:overflow-hidden lg:invisible" : "opacity-100 max-w-[180px] ml-3"
            )}>
              <p className="font-display text-sm font-black tracking-tight text-white uppercase">PUTRA CORP</p>
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-primary-100 bg-white/10 px-1.5 py-0.5 rounded-[4px] w-max mt-0.5 select-none">
                SOFTWARE ERP
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition lg:hidden cursor-pointer"
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
        <div className="hidden lg:block border-t border-white/10 px-4 py-2 overflow-visible">
          <button
            onClick={() => {
              const next = !isCollapsed;
              setIsCollapsed(next);
              document.cookie = `si_sidebar_collapsed=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
            }}
            className={cn(
              "group relative flex items-center rounded-xl px-3 py-2.5 text-xs font-semibold text-primary-50/55 transition-[background-color,color] duration-200 hover:bg-white/[0.06] hover:text-white cursor-pointer w-full overflow-visible",
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
              "absolute left-full ml-3 px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-bold text-white shadow-md opacity-0 pointer-events-none transition-all duration-150 whitespace-nowrap z-50 translate-x-[-4px] group-hover:translate-x-0 group-hover:opacity-100",
              isCollapsed ? "" : "hidden"
            )}>
              Buka Menu
            </span>
          </button>
        </div>

        {/* User profile & Logout Card Container */}
        <div className={cn(
          "border-t border-white/10 transition-all duration-200 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          isCollapsed ? "lg:overflow-visible p-2 lg:pb-2" : "overflow-hidden p-3 lg:pb-3"
        )}>
          <button
            type="button"
            onClick={openLogoutModal}
            aria-label="Buka konfirmasi keluar"
            className={cn(
              "group flex items-center transition-all duration-200 w-full border rounded-xl text-left cursor-pointer",
              isCollapsed ? "justify-center bg-transparent border-transparent p-0" : "bg-white/[0.06] border-white/10 p-2.5 gap-3 hover:bg-white/[0.1]"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white uppercase border border-white/10 transition group-hover:bg-white/20">
              {initials}
            </div>
            <div className={cn(
              "min-w-0 leading-tight transition-[opacity,max-width,margin] duration-200 ease-in-out truncate origin-left",
              isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:ml-0 lg:overflow-hidden lg:invisible" : "opacity-100 max-w-[180px] ml-3"
            )}>
              <p className="truncate text-xs font-bold text-white">{nama}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-primary-100/80 mt-0.5 select-none">
                {role === "ADMIN_KASIR" ? "KASIR POS" : role === "ADMIN_NONGUDANG" ? "NON-GUDANG" : "GUDANG LOGISTIK"}
              </p>
            </div>
          </button>
          <button
            onClick={openLogoutModal}
            className={cn(
              "group relative flex items-center rounded-xl text-slate-400 transition-all duration-200 hover:text-rose-400 cursor-pointer w-full overflow-visible border",
              isCollapsed
                ? "lg:justify-center lg:py-2.5 border-transparent bg-transparent"
                : "px-3 py-2 bg-white/[0.03] border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400 mt-2 text-xs font-semibold"
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
              "absolute left-full ml-3 px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-bold text-white shadow-md opacity-0 pointer-events-none transition-all duration-150 whitespace-nowrap z-50 translate-x-[-4px] group-hover:translate-x-0 group-hover:opacity-100",
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => !isLoggingOut && setIsLogoutOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="anim-rise w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
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
                disabled={isLoggingOut}
                className="h-10 w-full rounded-xl bg-rose-600 px-4 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} />
                {isLoggingOut ? "Mengeluarkan…" : "Ya, Keluar"}
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
