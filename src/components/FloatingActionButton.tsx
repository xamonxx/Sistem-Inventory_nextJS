"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShoppingCart, Boxes, FileText, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingActionButton({ role }: { role?: string }) {
  const router = useRouter();
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
    { label: "POS Transaksi Baru", icon: ShoppingCart, color: "text-teal-700 bg-teal-50", link: "/kasir", roles: ["ADMIN_KASIR"] },
    { label: "Tambah Barang Baru", icon: Boxes, color: "text-emerald-600 bg-emerald-50", link: "/barang?new=true", roles: ["ADMIN_GUDANG"] },
    { label: "Buat Invoice Baru", icon: FileText, color: "text-blue-600 bg-blue-50", link: "/kasir?type=PROJECT", roles: ["ADMIN_KASIR"] },
    { label: "Proses Retur / Tukar", icon: RotateCcw, color: "text-indigo-600 bg-indigo-50", link: "/retur", roles: ["ADMIN_KASIR", "ADMIN_GUDANG"] },
  ];

  const actions = allActions.filter(act => !role || act.roles.includes(role));

  function handleAction(link: string) {
    setIsOpen(false);
    router.push(link);
  }

  // If there are no actions for the user's role, don't render the FAB at all
  if (actions.length === 0) return null;

  return (
    <div ref={menuRef} className="no-print pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col items-end">
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
              className="flex items-center gap-3 rounded-full bg-white px-4 py-2.5 shadow-lg border border-border hover:bg-[#f6faf8] transition cursor-pointer"
            >
              <span className="text-xs font-bold text-slate-700">{act.label}</span>
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
          "pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg shadow-emerald-950/20 transition-all duration-300 hover:bg-[var(--primary-strong)] active:scale-95 cursor-pointer",
          isOpen ? "rotate-45" : ""
        )}
        title="Aksi Cepat Baru"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>
    </div>
  );
}
