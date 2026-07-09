"use client";

import { useEffect, useState, useRef, useTransition, type ElementType } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  Boxes,
  RotateCcw,
  FileText,
  BarChart3,
  PackagePlus,
  LayoutDashboard,
  Store,
  UserRound,
  Users,
  History,
  CornerDownLeft,
} from "lucide-react";
import type { Role } from "@prisma/client";
import type { SearchResult } from "./CommandPaletteActions";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  subtitle: string;
  icon: ElementType;
  link: string;
  roles?: Role[];
  /** Extra synonyms so typing e.g. "customer" or "report" still finds the page. */
  keywords: string;
};

// Full navigation registry — every page a role can open. Powers both the
// empty-state launcher and the "search all" behaviour (typing a menu/page
// name jumps there), alongside DB entity search from /api/search.
const ALL_NAV: NavItem[] = [
  // ===== Gudang / Kasir =====
  { title: "Dashboard", subtitle: "Ringkasan operasional harian", icon: LayoutDashboard, link: "/", roles: ["ADMIN_KASIR", "ADMIN_GUDANG"], keywords: "beranda home utama ringkasan" },
  { title: "Transaksi POS (Kasir)", subtitle: "Mulai transaksi eceran atau proyek", icon: ShoppingCart, link: "/kasir", roles: ["ADMIN_KASIR"], keywords: "pos jual penjualan kasir eceran checkout" },
  { title: "Master Barang & Plywood", subtitle: "Katalog barang dan harga jual", icon: Boxes, link: "/barang", roles: ["ADMIN_GUDANG"], keywords: "produk sku katalog plywood material harga" },
  { title: "Input Stok / Restok", subtitle: "Tambah mutasi masuk material", icon: PackagePlus, link: "/stok", roles: ["ADMIN_GUDANG"], keywords: "gudang inventory persediaan restok stok masuk" },
  { title: "Retur / Tukar Barang", subtitle: "Pengembalian atau penggantian barang", icon: RotateCcw, link: "/retur", roles: ["ADMIN_KASIR", "ADMIN_GUDANG"], keywords: "kembali tukar ganti refund retur" },
  { title: "Invoice & Piutang Berjalan", subtitle: "Pantau cicilan invoice dan jatuh tempo", icon: FileText, link: "/invoice", roles: ["ADMIN_KASIR", "ADMIN_GUDANG"], keywords: "tagihan piutang faktur cicilan tempo" },
  { title: "Laporan Pendapatan & Omset", subtitle: "Analisis data penjualan bulanan", icon: BarChart3, link: "/laporan", roles: ["ADMIN_GUDANG"], keywords: "report laporan analisa omset margin penjualan export" },
  { title: "Log Aktivitas", subtitle: "Audit trail operasional sistem", icon: History, link: "/log-aktivitas", roles: ["ADMIN_GUDANG"], keywords: "audit histori aktivitas log jejak" },
  { title: "Pengguna", subtitle: "Manajemen akun operator", icon: Users, link: "/pengguna", roles: ["ADMIN_GUDANG"], keywords: "user akun staff operator pengguna" },

  // ===== Non-Gudang (trading) =====
  { title: "Dashboard Non-Gudang", subtitle: "Analisa margin trading", icon: LayoutDashboard, link: "/non-gudang", roles: ["ADMIN_NONGUDANG"], keywords: "beranda ringkasan margin analisa dashboard" },
  { title: "Master Barang Non-Gudang", subtitle: "Barang dari toko sumber", icon: Boxes, link: "/non-gudang/barang", roles: ["ADMIN_NONGUDANG"], keywords: "produk katalog toko harga barang" },
  { title: "Keranjang CO Non-Gudang", subtitle: "Susun barang toko sumber & buat invoice NG", icon: ShoppingCart, link: "/non-gudang/buat-invoice", roles: ["ADMIN_NONGUDANG"], keywords: "co keranjang buat invoice checkout beli" },
  { title: "Riwayat Invoice Non-Gudang", subtitle: "Invoice & piutang konsumen", icon: FileText, link: "/non-gudang/invoice", roles: ["ADMIN_NONGUDANG"], keywords: "faktur tagihan piutang cicilan tempo invoice" },
  { title: "Riwayat Pembelian", subtitle: "Rekap pembelian per toko sumber", icon: Store, link: "/non-gudang/pembelian", roles: ["ADMIN_NONGUDANG"], keywords: "beli pembelian modal toko supplier sumber" },
  { title: "Konsumen", subtitle: "Master pelanggan non-gudang", icon: UserRound, link: "/non-gudang/konsumen", roles: ["ADMIN_NONGUDANG"], keywords: "pelanggan customer klien crm konsumen" },
  { title: "Laporan Non-Gudang", subtitle: "Export & rekap per konsumen", icon: BarChart3, link: "/non-gudang/laporan", roles: ["ADMIN_NONGUDANG"], keywords: "report laporan export excel pdf rekap konsumen" },
];

type FlatItem = { kind: "action"; action: NavItem } | { kind: "result"; result: SearchResult };

export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const navItems = ALL_NAV.filter((n) => !n.roles || n.roles.includes(role));

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
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!response.ok) {
            throw new Error(`Search request failed: ${response.status}`);
          }
          const data = (await response.json()) as { results?: SearchResult[] };
          setResults(data.results ?? []);
          setSelectedIndex(0);
        } catch (err) {
          console.error("Search error:", err);
        }
      });
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Client-side match over the navigation registry — every typed word must
  // appear somewhere in the page's title/subtitle/keywords.
  const trimmed = query.trim().toLowerCase();
  const matchedActions = trimmed
    ? navItems
        .filter((n) => {
          const haystack = `${n.title} ${n.subtitle} ${n.keywords}`.toLowerCase();
          return trimmed.split(/\s+/).every((w) => haystack.includes(w));
        })
        .slice(0, 6)
    : [];

  // Unified list (actions first, then DB entities) for keyboard navigation.
  const flatItems: FlatItem[] = query.trim()
    ? [
        ...matchedActions.map((action) => ({ kind: "action" as const, action })),
        ...results.map((result) => ({ kind: "result" as const, result })),
      ]
    : [];

  const emptyStateCount = navItems.length;
  const activeCount = query.trim() ? flatItems.length : emptyStateCount;
  const clampedIndex = activeCount > 0 ? Math.min(selectedIndex, activeCount - 1) : 0;

  // Navigate keyboard controls
  function handleKeyDown(e: React.KeyboardEvent) {
    if (activeCount === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % activeCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + activeCount) % activeCount);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (query.trim()) {
        const item = flatItems[clampedIndex];
        if (!item) return;
        if (item.kind === "action") navigate(item.action.link);
        else navigate(item.result.link);
      } else {
        const action = navItems[clampedIndex];
        if (action) navigate(action.link);
      }
    }
  }

  function navigate(link: string) {
    setIsOpen(false);
    router.push(link);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity opacity-100"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette Body */}
      <div className="relative w-full max-w-2xl transform rounded-[20px] bg-card dark:bg-card shadow-[var(--shadow-modal)] border border-border overflow-hidden anim-rise">
        {/* Search Input bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <Search size={20} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={80}
            placeholder="Cari barang, invoice, klien, menu, atau aksi..."
            className="w-full bg-transparent text-foreground dark:text-slate-100 outline-none placeholder:text-slate-450 dark:placeholder:text-slate-500 text-base"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-1.5 font-mono text-[10px] font-medium text-slate-400 dark:text-slate-500">
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
                {navItems.map((action, i) => (
                  <ActionRow key={action.link} action={action} selected={clampedIndex === i} onClick={() => navigate(action.link)} />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Navigation / actions matched from the registry */}
              {matchedActions.length > 0 && (
                <div>
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                    Menu &amp; Aksi
                  </p>
                  <div className="space-y-0.5 mt-1">
                    {matchedActions.map((action, i) => (
                      <ActionRow key={action.link} action={action} selected={clampedIndex === i} onClick={() => navigate(action.link)} />
                    ))}
                  </div>
                </div>
              )}

              {/* DB entity results */}
              <div>
                <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                  Hasil Pencarian ({isPending ? "Mencari..." : `${results.length} ditemukan`})
                </p>

                {results.length > 0 ? (
                  <div className="space-y-0.5 mt-1">
                    {results.map((result, i) => {
                      const flatIndex = matchedActions.length + i;
                      const isSelected = clampedIndex === flatIndex;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => navigate(result.link)}
                          className={cn(
                            "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left transition-[background-color,color,box-shadow,transform]",
                            isSelected ? "bg-slate-50 dark:bg-slate-900 text-foreground dark:text-slate-150" : "text-slate-650 dark:text-slate-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                          )}
                        >
                          <span>
                            <span className="block text-sm font-semibold text-foreground dark:text-slate-200">{result.title}</span>
                            <span className="block text-xs text-slate-450 dark:text-slate-500 mt-0.5">{result.subtitle}</span>
                          </span>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              Lihat Detail <CornerDownLeft size={10} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  !isPending &&
                  matchedActions.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-slate-400">
                      {`Tidak ada hasil untuk "${query}"`}
                    </p>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="bg-slate-50/70 dark:bg-slate-950/70 border-t border-border px-4 py-2.5 flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 font-medium select-none">
          <span className="flex items-center gap-1.5">
            <kbd className="bg-card dark:bg-slate-900 border border-border dark:border-slate-800 px-1 rounded">↑↓</kbd> Navigasi
            <kbd className="bg-card dark:bg-slate-900 border border-border dark:border-slate-800 px-1 rounded ml-1.5">Enter</kbd> Pilih
          </span>
          <span>Tekan <kbd className="bg-card dark:bg-slate-900 border border-border dark:border-slate-800 px-1 rounded font-mono">Ctrl + K</kbd> untuk menutup</span>
        </div>
      </div>
    </div>
  );
}

function ActionRow({ action, selected, onClick }: { action: NavItem; selected: boolean; onClick: () => void }) {
  const Icon = action.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left transition-[background-color,color,box-shadow,transform]",
        selected ? "bg-slate-50 dark:bg-slate-900 text-foreground dark:text-slate-150" : "text-slate-650 dark:text-slate-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
      )}
    >
      <span className="flex items-center gap-3">
        <span className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg border",
          selected ? "bg-card dark:bg-card border-slate-250 dark:border-slate-700 text-[var(--primary)]" : "bg-slate-50 dark:bg-slate-900 border-border text-slate-500 dark:text-slate-400"
        )}>
          <Icon size={16} />
        </span>
        <span>
          <span className="block text-sm font-semibold">{action.title}</span>
          <span className="block text-xs text-slate-450 dark:text-slate-500 mt-0.5">{action.subtitle}</span>
        </span>
      </span>
      {selected && (
        <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          Buka <CornerDownLeft size={10} />
        </span>
      )}
    </button>
  );
}
