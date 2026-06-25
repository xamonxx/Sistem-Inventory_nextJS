"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Boxes, RotateCcw, FileText, BarChart3, PackagePlus, ArrowRight, CornerDownLeft } from "lucide-react";
import type { Role } from "@prisma/client";
import { universalSearch, type SearchResult } from "./CommandPaletteActions";
import { cn } from "@/lib/utils";

export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Shortcut key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Reset indices and query when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Query database on search text changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await universalSearch(query);
          setResults(res);
          setSelectedIndex(0);
        } catch (err) {
          console.error("Search error:", err);
        }
      });
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Navigate keyboard controls
  function handleKeyDown(e: React.KeyboardEvent) {
    const totalItems = results.length > 0 ? results.length : quickActions.length;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) {
        handleSelect(results[selectedIndex]);
      } else {
        handleQuickAction(quickActions[selectedIndex]);
      }
    }
  }

  function handleSelect(item: SearchResult) {
    setIsOpen(false);
    
    // Check if we are already on that page. If so, we might want to trigger drawer instead or just push query
    router.push(item.link);
  }

  function handleQuickAction(action: typeof quickActions[0]) {
    setIsOpen(false);
    router.push(action.link);
  }

  const allQuickActions = [
    { title: "Transaksi POS Baru (Kasir)", subtitle: "Mulai transaksi eceran atau proyek", icon: ShoppingCart, link: "/kasir", roles: ["ADMIN_KASIR"] },
    { title: "Master Barang & Plywood", subtitle: "Lihat katalog barang dan harga jual", icon: Boxes, link: "/barang", roles: ["ADMIN_GUDANG"] },
    { title: "Input Stok / Restok Barang", subtitle: "Tambah mutasi masuk material baru", icon: PackagePlus, link: "/stok", roles: ["ADMIN_GUDANG"] },
    { title: "Retur / Tukar Barang", subtitle: "Proses pengembalian atau penggantian barang", icon: RotateCcw, link: "/retur", roles: ["ADMIN_KASIR", "ADMIN_GUDANG"] },
    { title: "Invoice & Piutang Berjalan", subtitle: "Pantau cicilan invoice dan jatuh tempo", icon: FileText, link: "/invoice" },
    { title: "Laporan Pendapatan & Omset", subtitle: "Buka analisis data penjualan bulanan", icon: BarChart3, link: "/laporan", roles: ["ADMIN_GUDANG"] },
  ];

  const quickActions = allQuickActions.filter(act => !act.roles || act.roles.includes(role));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity opacity-100"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette Body */}
      <div className="relative w-full max-w-2xl transform rounded-[20px] bg-white shadow-[var(--shadow-modal)] border border-border overflow-hidden anim-rise">
        {/* Search Input bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <Search size={20} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cari barang, invoice, klien, proyek, atau aksi..."
            className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-450 text-base"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results panel */}
        <div className="max-h-[360px] overflow-y-auto p-2 scrollbar-thin">
          {query.trim() === "" ? (
            <div>
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                Pintasan Aksi Cepat
              </p>
              <div className="space-y-0.5 mt-1">
                {quickActions.map((action, i) => {
                  const Icon = action.icon;
                  const isSelected = selectedIndex === i;
                  return (
                    <button
                      key={action.link}
                      onClick={() => handleQuickAction(action)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer",
                        isSelected ? "bg-slate-50 text-slate-900" : "text-slate-650 hover:bg-slate-50/50"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg border",
                          isSelected ? "bg-white border-slate-250 text-[var(--primary)]" : "bg-slate-50 border-border text-slate-500"
                        )}>
                          <Icon size={16} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{action.title}</span>
                          <span className="block text-xs text-slate-450 mt-0.5">{action.subtitle}</span>
                        </span>
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                          Buka <CornerDownLeft size={10} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                Hasil Pencarian ({isPending ? "Mencari..." : `${results.length} ditemukan`})
              </p>
              
              {results.length > 0 ? (
                <div className="space-y-0.5 mt-1">
                  {results.map((result, i) => {
                    const isSelected = selectedIndex === i;
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer",
                          isSelected ? "bg-slate-50 text-slate-900" : "text-slate-650 hover:bg-slate-50/50"
                        )}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">{result.title}</span>
                          <span className="block text-xs text-slate-450 mt-0.5">{result.subtitle}</span>
                        </span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                            Lihat Detail <CornerDownLeft size={10} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                !isPending && (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    Tidak ada hasil pencarian untuk "{query}"
                  </p>
                )
              )}
            </div>
          )}
        </div>
        
        {/* Footer info bar */}
        <div className="bg-slate-50/70 border-t border-border px-4 py-2.5 flex justify-between items-center text-[10px] text-slate-400 font-medium select-none">
          <span className="flex items-center gap-1.5">
            <kbd className="bg-white border border-slate-200 px-1 rounded">↑↓</kbd> Navigasi
            <kbd className="bg-white border border-slate-200 px-1 rounded ml-1.5">Enter</kbd> Pilih
          </span>
          <span>Tekan <kbd className="bg-white border border-slate-200 px-1 rounded font-mono">Ctrl + K</kbd> untuk menutup</span>
        </div>
      </div>
    </div>
  );
}
