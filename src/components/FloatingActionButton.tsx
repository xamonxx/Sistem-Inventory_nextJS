"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, ShoppingCart, Boxes, FileText, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingActionButton({ role }: { role?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allActions = [
    { label: "POS Transaksi Baru", icon: ShoppingCart, color: "text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40", link: "/kasir", roles: ["ADMIN_KASIR"] },
    { label: "CO Non-Gudang Baru", icon: FileText, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40", link: "/non-gudang/buat-invoice", roles: ["ADMIN_NONGUDANG"] },
    { label: "Tambah Barang Baru", icon: Boxes, color: "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40", link: "/barang?new=true", roles: ["ADMIN_GUDANG"] },
    { label: "Buat Invoice Baru", icon: FileText, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40", link: "/kasir?type=PROJECT", roles: ["ADMIN_KASIR"] },
    { label: "Proses Retur / Tukar", icon: RotateCcw, color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40", link: "/retur", roles: ["ADMIN_KASIR", "ADMIN_GUDANG"] },
  ];

  const actions = allActions.filter(act => !role || act.roles.includes(role));

  function handleAction(link: string) {
    setIsOpen(false);
    router.push(link);
  }

  // If there are no actions for the user's role, don't render the FAB at all
  if (pathname === "/non-gudang/buat-invoice" || actions.length === 0) return null;

  return (
    <div ref={menuRef} className="no-print pointer-events-none fixed bottom-6 right-6 z-30 hidden flex-col items-end md:flex">
      {/* Floating Menu list */}
      <div
        className={cn(
          "mb-3 flex flex-col items-end gap-2 transition-all duration-200 origin-bottom-right",
          isOpen ? "scale-100 opacity-100 translate-y-0 pointer-events-auto" : "scale-90 opacity-0 translate-y-2 pointer-events-none"
        )}
      >
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              onClick={() => handleAction(act.link)}
              className="flex items-center gap-3 rounded-full bg-card dark:bg-slate-900 px-4 py-2.5 shadow-lg border border-border hover:bg-[#f6faf8] dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{act.label}</span>
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border border-current/10", act.color)}>
                <Icon size={14} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg shadow-primary-950/20 transition-all duration-300 hover:bg-[var(--primary-strong)] active:scale-95 cursor-pointer",
          isOpen ? "rotate-45" : ""
        )}
        title="Aksi Cepat Baru"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>
    </div>
  );
}
