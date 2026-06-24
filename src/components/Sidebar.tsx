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

type Item = { href: string; label: string; icon: React.ElementType; roles?: Role[] };

const OPERASIONAL: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kasir", label: "Kasir", icon: ShoppingCart, roles: ["ADMIN_KASIR"] },
  { href: "/retur", label: "Retur / Tukar", icon: RotateCcw, roles: ["ADMIN_KASIR", "ADMIN_GUDANG"] },
];

const KEUANGAN: Item[] = [
  { href: "/invoice", label: "Invoice", icon: FileText },
];

const PERSEDIAAN: Item[] = [
  { href: "/barang", label: "Master Barang", icon: Boxes },
  { href: "/stok", label: "Stok", icon: PackagePlus },
];

const ANALITIK: Item[] = [
  { href: "/laporan", label: "Laporan", icon: BarChart3 },
];

const ADMINISTRASI: Item[] = [
  { href: "/log-aktivitas", label: "Log Aktivitas", icon: History, roles: ["ADMIN_GUDANG"] },
  { href: "/pengguna", label: "Pengguna", icon: Users },
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
          "px-4 pt-4 pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500/90 transition-[opacity,max-height,padding] duration-200 truncate origin-left select-none",
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
                active
                  ? "bg-[var(--primary)]/10 text-white font-semibold"
                  : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
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
                      ? "text-[var(--primary)]"
                      : "text-slate-400 group-hover:text-slate-200"
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
      <header className="no-print sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-[#0d131f] px-4 text-white lg:hidden">
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <span className="text-[15px] font-black uppercase tracking-tight text-white whitespace-nowrap">
          PUTRA CORPORATION
        </span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1c2434] text-xs font-bold text-white uppercase border border-slate-700/60">
          {initials}
        </div>
      </header>

      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-45 bg-slate-900/60 backdrop-blur-xs transition-opacity lg:hidden"
        />
      )}

      {/* Sidebar Navigation Panel Drawer */}
      <aside
        className={cn(
          "no-print bg-[#0a0e17] text-slate-300",
          "lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:flex-col lg:border-r lg:border-slate-800/60 lg:transition-[width] lg:duration-200 lg:ease-in-out lg:z-30",
          isCollapsed ? "lg:w-[80px]" : "lg:w-[280px]",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[280px] flex flex-col max-lg:transition-transform max-lg:duration-200 max-lg:ease-in-out",
          isOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        )}
        style={{ willChange: "width" }}
      >
        {/* Brand logo & Close button */}
        <div className={cn(
          "flex items-center h-16 w-full border-b border-slate-800/50 overflow-hidden transition-[padding] duration-200",
          isCollapsed ? "lg:px-4 lg:justify-center" : "px-5"
        )}>
          <div className="flex items-center w-full">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[var(--primary)] to-amber-500 text-white shadow-[0_0_12px_rgba(211,90,31,0.25)]">
              <Boxes size={20} strokeWidth={2.2} />
            </div>
            <div className={cn(
              "leading-tight transition-[opacity,max-width,margin] duration-200 ease-in-out truncate origin-left",
              isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:ml-0 lg:overflow-hidden lg:invisible" : "opacity-100 max-w-[180px] ml-3"
            )}>
              <p className="font-display text-sm font-black tracking-tight text-white uppercase">PUTRA CORP</p>
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded-[4px] w-max mt-0.5 select-none">
                HARDWARE ERP
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition lg:hidden cursor-pointer"
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
        </nav>

        {/* Desktop Collapse Toggle Row */}
        <div className="hidden lg:block border-t border-slate-800/40 px-4 py-2 overflow-visible">
          <button
            onClick={() => {
              const next = !isCollapsed;
              setIsCollapsed(next);
              document.cookie = `si_sidebar_collapsed=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
            }}
            className="group relative flex items-center rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-400 transition-[background-color,color] duration-200 hover:bg-white/[0.03] hover:text-slate-200 cursor-pointer w-full overflow-visible"
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
          "border-t border-slate-800/45 transition-all duration-200",
          isCollapsed ? "lg:overflow-visible p-2" : "overflow-hidden p-3"
        )}>
          <div className={cn(
            "flex items-center transition-all duration-200 w-full",
            isCollapsed ? "justify-center bg-transparent border-transparent p-0" : "bg-[#131a26]/40 border border-slate-800/50 rounded-xl p-2.5 gap-3"
          )}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1c2434] text-xs font-bold text-white uppercase border border-slate-700/60">
              {initials}
            </div>
            <div className={cn(
              "min-w-0 leading-tight transition-[opacity,max-width,margin] duration-200 ease-in-out truncate origin-left",
              isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:ml-0 lg:overflow-hidden lg:invisible" : "opacity-100 max-w-[180px] ml-3"
            )}>
              <p className="truncate text-xs font-bold text-white">{nama}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--primary)] mt-0.5 select-none">
                {role === "ADMIN_KASIR" ? "KASIR POS" : "GUDANG LOGISTIK"}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              setIsOpen(false);
              await logoutAction();
            }}
            className={cn(
              "group relative flex items-center rounded-xl text-slate-400 transition-all duration-200 hover:text-rose-400 cursor-pointer w-full overflow-visible",
              isCollapsed
                ? "lg:justify-center lg:py-2.5"
                : "px-3 py-2 bg-[#131a26]/20 border border-slate-800/40 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-450 mt-2 text-xs font-semibold"
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
