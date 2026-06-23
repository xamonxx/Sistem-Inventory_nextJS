"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

const NAV: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kasir", label: "Kasir", icon: ShoppingCart, roles: ["ADMIN_KASIR"] },
  { href: "/retur", label: "Retur / Tukar", icon: RotateCcw, roles: ["ADMIN_KASIR", "ADMIN_GUDANG"] },
  { href: "/invoice", label: "Invoice / Piutang", icon: FileText },
  { href: "/barang", label: "Master Barang", icon: Boxes },
  { href: "/stok", label: "Stok / Kartu Stok", icon: PackagePlus },
  { href: "/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/log-aktivitas", label: "Log Aktivitas", icon: History, roles: ["ADMIN_GUDANG"] },
  { href: "/pengguna", label: "Pengguna", icon: Users },
];

export function Sidebar({
  role,
  nama,
  defaultCollapsed = false,
}: {
  role: Role;
  nama: string;
  defaultCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Sync state if defaultCollapsed prop changes (e.g. on client navigations)
  useEffect(() => {
    setIsCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  const visible = NAV.filter((i) => !i.roles || i.roles.includes(role));
  const initials = nama.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      {/* Mobile Top Navbar Header */}
      <header className="no-print sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-white/8 bg-[#1b1d1f] px-4 text-white lg:hidden">
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--primary)] text-white shadow-[0_2px_6px_-1px_rgba(194,65,12,0.4)]">
            <Boxes size={18} />
          </div>
          <span className="font-display text-[14px] font-extrabold tracking-tight">PUTRA CORP</span>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-[0.68rem] font-bold text-white uppercase">
          {initials}
        </div>
      </header>

      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
        />
      )}

      {/* Sidebar Navigation Panel Drawer */}
      <aside
        className={cn(
          "no-print bg-[#1b1d1f] text-[#cfd2d6]",
          // Desktop sidebar behavior (collapsible width with transition)
          "lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:flex-col lg:border-r lg:border-white/5 lg:transition-[width] lg:duration-300",
          isCollapsed ? "lg:w-[72px]" : "lg:w-64",
          // Mobile/Tablet drawer behavior (isolated using max-lg:)
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-64 flex flex-col max-lg:transition-transform max-lg:duration-300 max-lg:ease-in-out",
          isOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        )}
      >
        {/* Brand & Close button */}
        <div className={cn(
          "flex items-center justify-between border-b border-white/8 px-5 py-[18px] transition-all",
          isCollapsed ? "lg:justify-center lg:px-0" : ""
        )}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-[var(--primary)] text-white shadow-[0_2px_8px_-2px_rgba(194,65,12,0.6)]">
              <Boxes size={22} strokeWidth={2.2} />
            </div>
            <div className={cn("leading-tight transition-opacity duration-300", isCollapsed ? "lg:hidden" : "")}>
              <p className="font-display text-[15px] font-extrabold tracking-tight text-white">PUTRA CORP</p>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/40">
                Hardware ERP
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white transition-colors lg:hidden cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          <p className={cn(
            "px-3 pb-2 text-[0.58rem] font-bold uppercase tracking-[0.2em] text-white/30 transition-all",
            isCollapsed ? "lg:opacity-0 lg:h-0 lg:pb-0" : ""
          )}>
            Menu
          </p>
          {visible.map((i) => {
            const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
            const Icon = i.icon;
            return (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-[0.82rem] font-medium transition-all",
                  active
                    ? "bg-white/[0.06] text-white"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white",
                  isCollapsed ? "lg:justify-center lg:px-0" : ""
                )}
                title={isCollapsed ? i.label : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[var(--primary)]" />
                )}
                <Icon size={17} strokeWidth={active ? 2.4 : 2} className={active ? "text-[var(--primary)]" : ""} />
                {!isCollapsed && <span className="truncate">{i.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Collapse Toggle Row */}
        <div className="hidden lg:block border-t border-white/5 px-3 py-1.5">
          <button
            onClick={() => {
              const next = !isCollapsed;
              setIsCollapsed(next);
              document.cookie = `si_sidebar_collapsed=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-[0.8rem] font-medium text-white/50 transition-all hover:bg-white/5 hover:text-white cursor-pointer",
              isCollapsed ? "justify-center px-0" : ""
            )}
            title={isCollapsed ? "Buka Menu" : "Sembunyikan Menu"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!isCollapsed && <span className="truncate">Sembunyikan Menu</span>}
          </button>
        </div>

        {/* User profile section */}
        <div className="border-t border-white/8 p-3">
          <div className={cn(
            "mb-2 flex items-center gap-3 px-1",
            isCollapsed ? "lg:justify-center lg:px-0" : ""
          )}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-white/8 text-[0.72rem] font-bold text-white uppercase">
              {initials}
            </div>
            <div className={cn("min-w-0 leading-tight", isCollapsed ? "lg:hidden" : "")}>
              <p className="truncate text-[0.82rem] font-semibold text-white">{nama}</p>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]/90">
                {role === "ADMIN_KASIR" ? "Admin Kasir" : "Admin Gudang"}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              setIsOpen(false);
              await logoutAction();
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-[0.8rem] font-medium text-white/55 transition-all hover:bg-red-500/10 hover:text-red-400 cursor-pointer text-left",
              isCollapsed ? "lg:justify-center lg:px-0" : ""
            )}
            title={isCollapsed ? "Keluar" : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            {!isCollapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
