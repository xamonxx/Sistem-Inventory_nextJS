"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getItemHistory, toggleAktif, logBarcodePrint, deleteItems } from "./actions";
import QRCode from "qrcode";
import { Button, Card, Input, Label, Select, Table, Th, Td, Badge } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/itemCategories";
import { Drawer } from "@/components/Drawer";
import { formatRupiah, formatTanggal, cn } from "@/lib/utils";
import { printArea } from "@/lib/print";
import {
  Search,
  Eye,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Boxes,
  ShieldAlert,
  Copy,
  Archive,
  Printer,
  SlidersHorizontal,
  Pencil,
  Coins,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export type ItemData = {
  id: number;
  kode: string;
  nama: string;
  kategori: string | null;
  hargaBeli: number;
  hargaJual: number;
  stokAwal: number;
  minStok: number;
  aktif: boolean;
  stok: number;
};

type HistoryEntry = {
  id: number;
  tanggal: string;
  tipe: string;
  qty: number;
  keterangan: string | null;
  user: string;
};

export function BarangClient({
  initialItems,
  canEdit,
}: {
  initialItems: ItemData[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState<ItemData[]>(initialItems);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ItemCategory>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [stockCondition, setStockCondition] = useState<"ALL" | "LOW" | "NEGATIVE">("ALL");
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [itemHistory, setItemHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [openSOPreview, setOpenSOPreview] = useState(false);
  const [showSystemStock, setShowSystemStock] = useState(true);
  const [showSOOptions, setShowSOOptions] = useState(false);
  const [pending, startTransition] = useTransition();
  const [openBarcodePreview, setOpenBarcodePreview] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // ===== Hapus barang (checkbox + konfirmasi) =====
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, startDeleteTransition] = useTransition();

  const soOptionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (soOptionsRef.current && !soOptionsRef.current.contains(event.target as Node)) {
        setShowSOOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Generate QR code URL on item selection
  useEffect(() => {
    if (selectedItem) {
      QRCode.toDataURL(selectedItem.kode, { margin: 1, width: 120 })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("Error generating QR code:", err));
    } else {
      setQrCodeUrl("");
    }
  }, [selectedItem]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.aktif).length;
    const low = items.filter((i) => i.stok >= 0 && i.stok < i.minStok).length;
    const negative = items.filter((i) => i.stok < 0).length;
    const asset = items.reduce((acc, i) => acc + i.hargaBeli * i.stok, 0);
    return { total, active, low, negative, asset };
  }, [items]);

  // Filter items dataset
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch =
        it.nama.toLowerCase().includes(q.toLowerCase()) ||
        it.kode.toLowerCase().includes(q.toLowerCase()) ||
        (it.kategori ?? "").toLowerCase().includes(q.toLowerCase());

      const matchesCategory = categoryFilter === "ALL" || it.kategori === categoryFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && it.aktif) ||
        (statusFilter === "INACTIVE" && !it.aktif);

      const matchesStock =
        stockCondition === "ALL" ||
        (stockCondition === "LOW" && it.stok >= 0 && it.stok < it.minStok) ||
        (stockCondition === "NEGATIVE" && it.stok < 0);

      return matchesSearch && matchesCategory && matchesStatus && matchesStock;
    });
  }, [items, q, categoryFilter, statusFilter, stockCondition]);

  // Total nilai aset persediaan = Σ (harga beli × stok akhir) untuk hasil saringan
  const totalAset = useMemo(
    () => filteredItems.reduce((acc, i) => acc + i.hargaBeli * i.stok, 0),
    [filteredItems]
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [q, categoryFilter, statusFilter, stockCondition]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  async function openItemDetails(item: ItemData) {
    setSelectedItem(item);
    setLoadingHistory(true);
    try {
      const history = await getItemHistory(item.id);
      setItemHistory(history);
    } catch {
      toast.error("Gagal memuat riwayat kartu stok. Periksa koneksi lalu buka ulang detail barang ini.");
    } finally {
      setLoadingHistory(false);
    }
  }

  const handleEditProduct = (item: ItemData) => {
    setSelectedItem(null); // Close drawer
    window.dispatchEvent(
      new CustomEvent("edit-barang", {
        detail: {
          id: item.id,
          kode: item.kode,
          nama: item.nama,
          kategori: item.kategori ?? "MATERIAL",
          hargaBeli: item.hargaBeli,
          hargaJual: item.hargaJual,
          stokAwal: item.stokAwal,
          minStok: item.minStok,
          aktif: item.aktif,
        },
      })
    );
  };

  function handleToggleAktif(itemId: number, currentStatus: boolean) {
    startTransition(async () => {
      try {
        await toggleAktif(itemId, !currentStatus);
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, aktif: !currentStatus } : i))
        );
        toast.success("Status barang berhasil diperbarui");
        
        // Sync selected drawer state
        if (selectedItem && selectedItem.id === itemId) {
          setSelectedItem({ ...selectedItem, aktif: !currentStatus });
        }
      } catch {
        toast.error("Gagal mengubah status barang. Muat ulang halaman lalu coba lagi.");
      }
    });
  }

  function handleDuplicateProduct(item: ItemData) {
    setSelectedItem(null); // Close drawer
    window.dispatchEvent(
      new CustomEvent("edit-barang", {
        detail: {
          id: undefined,
          kode: "",
          nama: `${item.nama} (Duplikat)`,
          kategori: item.kategori ?? "MATERIAL",
          hargaBeli: Number(item.hargaBeli),
          hargaJual: Number(item.hargaJual),
          stokAwal: 0, // Reset physical stock to 0 for duplicated product
          minStok: item.minStok,
          aktif: item.aktif,
        },
      })
    );
  }

  // ===== Seleksi & hapus =====
  const allPageSelected =
    paginatedItems.length > 0 && paginatedItems.every((it) => selectedIds.has(it.id));
  const somePageSelected = !allPageSelected && paginatedItems.some((it) => selectedIds.has(it.id));
  // Status "sebagian terpilih" hanya bisa diset lewat DOM (bukan atribut HTML).
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = somePageSelected;
  }, [somePageSelected]);

  function toggleSelectAllPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) paginatedItems.forEach((it) => next.delete(it.id));
      else paginatedItems.forEach((it) => next.add(it.id));
      return next;
    });
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleConfirmDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    startDeleteTransition(async () => {
      try {
        const res = await deleteItems(ids);
        if (res.ok) {
          const deletedSet = new Set(res.deletedIds ?? []);
          if (deletedSet.size > 0) {
            setItems((prev) => prev.filter((i) => !deletedSet.has(i.id)));
            toast.success(`${deletedSet.size} barang berhasil dihapus`);
          }
          if (res.blocked && res.blocked.length > 0) {
            const preview = res.blocked.slice(0, 3).join(", ");
            const more = res.blocked.length > 3 ? `, +${res.blocked.length - 3} lainnya` : "";
            toast.error(
              `${res.blocked.length} barang tidak bisa dihapus karena punya riwayat transaksi: ${preview}${more}. Gunakan Arsipkan.`,
              { duration: 7000 }
            );
          }
          if (deletedSet.size === 0 && (!res.blocked || res.blocked.length === 0)) {
            toast.info("Tidak ada barang yang dihapus.");
          }
          clearSelection();
          setShowDeleteConfirm(false);
        } else {
          toast.error(res.error ?? "Gagal menghapus barang");
        }
      } catch {
        toast.error("Gagal menghapus barang. Muat ulang halaman lalu coba lagi.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* 1. Statistics Cards Row
          Mobile 2 kolom (Nilai Aset melebar di atas); tablet & lg grid 6 kolom
          (2 kartu lebar + 3 kartu) agar tidak ada kartu yatim; 2xl 5 kolom. */}
      <section className={cn("grid grid-cols-2 gap-3 sm:gap-4", canEdit ? "sm:grid-cols-6 2xl:grid-cols-5" : "sm:grid-cols-4")}>
        {[
          { label: "Total Katalog Barang", value: `${stats.total} item`, desc: "Semua material terdaftar", icon: Boxes, tone: "blue", wide: true, lead: false },
          ...(canEdit ? [{ label: "Total Nilai Aset", value: formatRupiah(stats.asset), desc: "Total modal persediaan", icon: Coins, tone: "indigo", wide: true, lead: true }] : []),
          { label: "Barang Aktif di Kasir", value: `${stats.active} item`, desc: "Dapat dijual oleh Kasir", icon: ArrowUpRight, tone: "green", wide: false, lead: false },
          { label: "Stok Menipis", value: `${stats.low} item`, desc: "Di bawah stok minimum", icon: ArrowDownRight, tone: "amber", wide: false, lead: false },
          { label: "Stok Minus", value: `${stats.negative} item`, desc: "Perlu dicocokkan dengan stok fisik", icon: ShieldAlert, tone: "red", wide: false, lead: false },
        ].map((card) => {
          const Icon = card.icon;
          const toneColors: Record<string, string> = {
            blue: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/12 dark:text-blue-300 dark:border-blue-400/20",
            indigo: "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-500/12 dark:text-indigo-300 dark:border-indigo-400/20",
            green: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/12 dark:text-emerald-300 dark:border-emerald-400/20",
            amber: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-400/20",
            red: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/12 dark:text-rose-300 dark:border-rose-400/20",
          };
          const span = canEdit
            ? cn(
                card.wide ? "sm:col-span-3" : "sm:col-span-2",
                "2xl:col-span-1",
                card.lead && "order-first col-span-2 sm:order-none"
              )
            : "";
          return (
            <Card key={card.label} className={cn("flex min-w-0 items-center gap-3 p-3.5 sm:gap-3.5 sm:p-4", span)}>
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", toneColors[card.tone])}>
                <Icon className="h-5 w-5" strokeWidth={2.3} />
              </div>
              <div className="min-w-0 flex-1 leading-tight select-none">
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">{card.label}</p>
                <p
                  className="tnum mt-1 truncate font-display text-base font-extrabold text-foreground sm:text-lg 2xl:text-base"
                  title={card.value}
                >
                  {card.value}
                </p>
                <p className="mt-0.5 hidden truncate text-[11px] text-[var(--text-muted-2)] sm:block" title={card.desc}>
                  {card.desc}
                </p>
              </div>
            </Card>
          );
        })}
      </section>

      {/* 2. Filters Toolbar — baris 1: cari + stock opname; baris 2: filter (3 kolom). Satu baris mulai 2xl. */}
      <Card className="relative z-20 flex flex-col gap-3 p-3.5 sm:p-4 2xl:flex-row 2xl:items-center 2xl:gap-3">
        <div className="flex min-w-0 items-center gap-2 2xl:flex-1">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-3 z-10 text-[var(--text-soft)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={FIELD_LIMITS.search}
              placeholder="Cari kode, barcode, atau nama..."
              className="pl-9 h-10 rounded-xl"
            />
          </div>
          {canEdit && (
            <div className="flex shrink-0 items-stretch gap-2">
              <Button
                onClick={() => setOpenSOPreview(true)}
                variant="ghost"
                className="field-surface h-10 shrink-0 rounded-xl px-3.5 text-[13px] font-medium gap-2 text-foreground"
              >
                <Printer size={14} /> <span className="sm:hidden">Opname</span><span className="hidden sm:inline">Lembar Stock Opname</span>
              </Button>

              <div ref={soOptionsRef} className="relative shrink-0">
                <Button
                  onClick={() => setShowSOOptions(!showSOOptions)}
                  variant="ghost"
                  className="field-surface h-10 rounded-xl px-3 text-xs font-bold gap-1.5 text-foreground"
                  title="Opsi Cetak Stock Opname"
                >
                  <SlidersHorizontal size={14} />
                </Button>
                {showSOOptions && (
                  <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-card p-3.5 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)] mb-2">Opsi Stock Opname</p>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-soft)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showSystemStock}
                        onChange={(e) => setShowSystemStock(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-[var(--primary)] focus:ring-transparent cursor-pointer"
                      />
                      Tampilkan Stok Sistem
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 2xl:flex 2xl:shrink-0 2xl:items-center">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "ALL" | ItemCategory)}
            className="h-10 w-full rounded-xl text-xs font-bold 2xl:w-44"
          >
            <option value="ALL">Semua Kategori</option>
            {ITEM_CATEGORIES.map((kategori) => (
              <option key={kategori} value={kategori}>{kategori}</option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 w-full rounded-xl text-xs font-bold 2xl:w-40"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif (tampil di kasir)</option>
            <option value="INACTIVE">Diarsipkan</option>
          </Select>

          <Select
            value={stockCondition}
            onChange={(e) => setStockCondition(e.target.value as any)}
            className="h-10 w-full rounded-xl text-xs font-bold 2xl:w-44"
          >
            <option value="ALL">Semua Kondisi Stok</option>
            <option value="LOW">Stok Menipis</option>
            <option value="NEGATIVE">Stok Minus</option>
          </Select>
        </div>
      </Card>

      {/* Bulk action bar — hapus terpilih */}
      {canEdit && selectedIds.size > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between animate-in fade-in slide-in-from-top-1 duration-150 dark:border-rose-400/25 dark:bg-rose-500/10">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
            {selectedIds.size} barang dipilih untuk dihapus
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={clearSelection}>
              Batal
            </Button>
            <Button size="sm" variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} /> Hapus ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* ===== Card list (di bawah xl): 1 kolom di HP, 2 kolom di tablet/laptop kecil.
          Tabel butuh ±1060px sehingga baru dipakai mulai xl. ===== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:hidden">
        {paginatedItems.map((it) => {
          const isLow = it.stok >= 0 && it.stok < it.minStok;
          const isNeg = it.stok < 0;
          const aset = it.hargaBeli * it.stok;
          return (
            <div
              key={it.id}
              onClick={() => openItemDetails(it)}
              className={cn(
                "relative flex cursor-pointer flex-col gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition-colors active:scale-[0.995]",
                selectedIds.has(it.id)
                  ? "border-rose-300 bg-rose-50/60 dark:border-rose-400/40 dark:bg-rose-500/10"
                  : "border-border hover:border-[var(--primary)]/40"
              )}
            >
              <div className="flex items-start gap-2.5">
                {canEdit && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(it.id)}
                    onChange={() => toggleSelect(it.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Pilih ${it.nama}`}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-[11px] font-medium text-[var(--text-muted-2)]">
                      {it.kode}
                      {it.kategori && <span className="ml-1.5 font-sans text-[10px] font-semibold uppercase tracking-wide">· {it.kategori}</span>}
                    </p>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium",
                        it.aktif ? "text-emerald-700 dark:text-emerald-300/90" : "text-[var(--text-muted-2)]"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", it.aktif ? "bg-emerald-500" : "bg-slate-400")} />
                      {it.aktif ? "Aktif" : "Arsip"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-semibold leading-snug text-foreground dark:text-slate-100">{it.nama}</p>
                </div>
              </div>

              <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border pt-3 text-xs">
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">Harga Jual</dt>
                  <dd className="tnum mt-0.5 truncate text-sm font-semibold text-foreground dark:text-slate-200">{formatRupiah(it.hargaJual)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">Sisa Stok</dt>
                  <dd
                    className={cn(
                      "tnum mt-0.5 flex items-center gap-1.5 text-sm font-semibold",
                      isNeg ? "text-rose-600 dark:text-rose-300" : isLow ? "text-amber-700 dark:text-amber-300/90" : "text-foreground dark:text-slate-200"
                    )}
                    title={isNeg ? "Stok minus" : isLow ? `Di bawah stok minimum (${it.minStok})` : undefined}
                  >
                    {(isNeg || isLow) && <span className={cn("h-1.5 w-1.5 rounded-full", isNeg ? "bg-rose-500" : "bg-amber-500/80")} />}
                    {it.stok} unit
                  </dd>
                </div>
                {canEdit && (
                  <>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">Harga Beli</dt>
                      <dd className="tnum mt-0.5 truncate text-[var(--text-soft)]">{formatRupiah(it.hargaBeli)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">Total Aset</dt>
                      <dd
                        className={cn(
                          "tnum mt-0.5 truncate",
                          aset < 0
                            ? "font-semibold text-rose-600 dark:text-rose-300"
                            : aset === 0
                              ? "text-slate-400 dark:text-slate-500"
                              : "font-semibold text-foreground dark:text-slate-200"
                        )}
                      >
                        {formatRupiah(aset)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </div>
          );
        })}

        {paginatedItems.length === 0 && (
          <div className="rounded-2xl border border-border bg-card py-16 text-center text-slate-400 select-none sm:col-span-2">
            <Boxes className="mx-auto mb-2 text-slate-200" size={32} />
            <p className="text-sm font-semibold">Barang Tidak Ditemukan</p>
            <p className="text-xs">Katalog kosong atau pencarian tidak cocok.</p>
          </div>
        )}

        {filteredItems.length > 0 && canEdit && (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-[var(--surface-2)] px-4 py-3 sm:col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-soft)]">
              Total Aset ({filteredItems.length})
            </p>
            <p className={cn("tnum text-sm font-extrabold", totalAset < 0 ? "text-rose-600" : "text-foreground")}>
              {formatRupiah(totalAset)}
            </p>
          </div>
        )}
      </div>

      {/* ===== Desktop table (xl and up) ===== */}
      <div className="hidden xl:block">
      <Table tableClassName="[&_tbody_td]:whitespace-nowrap [&_th]:px-3 [&_td]:px-3 2xl:[&_th]:px-3.5 2xl:[&_td]:px-3.5">
          <thead>
            <tr>
              {canEdit && (
                <Th className="w-10 text-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAllPage}
                    aria-label="Pilih semua di halaman ini"
                    className="h-4 w-4 rounded border-border text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer align-middle"
                  />
                </Th>
              )}
              <Th>Kode Barang</Th>
              <Th>Nama Barang</Th>
              <Th>Kategori</Th>
              <Th className="text-right">Harga Beli</Th>
              <Th className="text-right">Harga Jual</Th>
              <Th className="text-right w-28 max-2xl:hidden">Stok Awal</Th>
              <Th className="text-right w-32">Sisa Stok</Th>
              <Th className="text-right w-36">Total Aset</Th>
              <Th className="text-center w-24">Status</Th>
              <Th className="text-center w-16">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((it) => {
              const isLow = it.stok >= 0 && it.stok < it.minStok;
              const isNeg = it.stok < 0;
              return (
                <tr
                  key={it.id}
                  onClick={() => openItemDetails(it)}
                  className={cn(
                    "cursor-pointer transition-colors duration-150 group",
                    selectedIds.has(it.id)
                      ? "bg-rose-50/70 hover:bg-rose-50 dark:bg-rose-500/[0.07] dark:hover:bg-rose-500/[0.11]"
                      : "hover:bg-[var(--surface-hover)]"
                  )}
                >
                  {canEdit && (
                    <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(it.id)}
                        onChange={() => toggleSelect(it.id)}
                        aria-label={`Pilih ${it.nama}`}
                        className="h-4 w-4 rounded border-border text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer align-middle"
                      />
                    </Td>
                  )}
                  <Td className="whitespace-nowrap font-mono text-xs font-medium text-[var(--text-muted-2)] group-hover:text-[var(--primary)]">
                    {it.kode}
                  </Td>
                  <Td className="min-w-[200px] !whitespace-normal font-semibold text-foreground dark:text-slate-100">{it.nama}</Td>
                  <Td>
                    <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted-2)]">
                      {it.kategori ?? "-"}
                    </span>
                  </Td>
                  <Td className="tnum whitespace-nowrap text-right text-xs text-[var(--text-soft)]">
                    {canEdit ? formatRupiah(it.hargaBeli) : "🔒 Dibatasi"}
                  </Td>
                  <Td className="tnum whitespace-nowrap text-right text-xs font-semibold text-foreground dark:text-slate-200">
                    {formatRupiah(it.hargaJual)}
                  </Td>
                  <Td className={cn("tnum text-right text-xs max-2xl:hidden", it.stokAwal === 0 ? "text-slate-400 dark:text-slate-500" : "text-[var(--text-soft)]")}>
                    {it.stokAwal} unit
                  </Td>
                  <Td className="text-right">
                    <span
                      className={cn(
                        "tnum inline-flex items-center justify-end gap-1.5 text-xs font-semibold",
                        isNeg
                          ? "text-rose-600 dark:text-rose-300"
                          : isLow
                            ? "text-amber-700 dark:text-amber-300/90"
                            : "text-foreground dark:text-slate-200"
                      )}
                      title={isNeg ? "Stok minus" : isLow ? `Di bawah stok minimum (${it.minStok})` : undefined}
                    >
                      {(isNeg || isLow) && (
                        <span className={cn("h-1.5 w-1.5 rounded-full", isNeg ? "bg-rose-500" : "bg-amber-500/80")} />
                      )}
                      {it.stok} unit
                    </span>
                  </Td>
                  <Td className={cn(
                    "tnum text-right text-xs",
                    it.stok < 0
                      ? "font-semibold text-rose-600 dark:text-rose-300"
                      : it.stok === 0
                        ? "text-slate-400 dark:text-slate-500"
                        : "font-semibold text-foreground dark:text-slate-200"
                  )}>
                    {canEdit ? formatRupiah(it.hargaBeli * it.stok) : "🔒"}
                  </Td>
                  <Td className="text-center select-none" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium",
                        it.aktif ? "text-emerald-700 dark:text-emerald-300/90" : "text-[var(--text-muted-2)]"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", it.aktif ? "bg-emerald-500" : "bg-slate-400")} />
                      {it.aktif ? "Aktif" : "Arsip"}
                    </span>
                  </Td>
                  <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openItemDetails(it)}
                      aria-label={`Lihat detail ${it.nama}`}
                      className="mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
                    >
                      <Eye size={14} />
                    </button>
                  </Td>
                </tr>
              );
            })}

            {paginatedItems.length === 0 && (
              <tr>
                <Td colSpan={canEdit ? 11 : 10} className="py-16 text-center text-slate-400 select-none">
                  <Boxes className="mx-auto text-slate-200 mb-2" size={32} />
                  <p className="font-semibold text-sm">Barang Tidak Ditemukan</p>
                  <p className="text-xs">Katalog kosong atau pencarian tidak cocok.</p>
                </Td>
              </tr>
            )}
          </tbody>
          {filteredItems.length > 0 && canEdit && (
          <tfoot>
              <tr className="bg-[var(--surface-2)] font-bold">
                <Td colSpan={7} className="text-right text-xs uppercase tracking-wider text-[var(--text-soft)]">
                  Total Nilai Aset Persediaan ({filteredItems.length} item)
                </Td>
                {/* Pengisi kolom Stok Awal (hanya tampil di 2xl). */}
                <Td className="max-2xl:hidden" />
                <Td className={cn(
                  "text-right font-mono text-sm font-extrabold",
                  totalAset < 0 ? "text-rose-600" : "text-foreground"
                )}>
                  {formatRupiah(totalAset)}
                </Td>
                <Td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-4 select-none sm:flex-row sm:items-center sm:justify-between sm:p-4.5">
          <p className="text-xs font-semibold text-slate-500">
            Halaman {currentPage} dari {totalPages}
            <span className="hidden sm:inline"> ({filteredItems.length} total item)</span>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      {/* 4. Product Detail & History slide Drawer (700px width) */}
      <Drawer
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        title={selectedItem ? `Detail Barang: ${selectedItem.nama}` : ""}
        size="medium"
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* Quick Actions Panel */}
            <div className="flex flex-wrap gap-2 border-b border-border pb-4">
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => handleEditProduct(selectedItem)}>
                  <Pencil size={13} className="text-slate-500" /> Ubah Detail
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => handleDuplicateProduct(selectedItem)}>
                <Copy size={13} /> Duplikasi
              </Button>
              {canEdit && (
                <>
                  <Button
                    size="sm"
                    variant={selectedItem.aktif ? "danger" : "success"}
                    onClick={() => handleToggleAktif(selectedItem.id, selectedItem.aktif)}
                    disabled={pending}
                  >
                    <Archive size={13} /> {selectedItem.aktif ? "Arsipkan Produk" : "Aktifkan Produk"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOpenBarcodePreview(true)}>
                    <Printer size={13} /> Cetak Label Barcode
                  </Button>
                </>
              )}
            </div>

            {/* General pricing & SKU info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-4 bg-[var(--surface-2)]">
                <p className="text-[10px] font-bold text-[var(--text-muted-2)] uppercase mb-1">Kode Barang</p>
                <p className="font-mono font-bold text-foreground text-sm">{selectedItem.kode}</p>
                <p className="mt-1 text-[10px] font-bold text-[var(--primary)]">{selectedItem.kategori ?? "Tanpa kategori"}</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-[var(--surface-2)]">
                <p className="text-[10px] font-bold text-[var(--text-muted-2)] uppercase mb-1">Status Penjualan</p>
                <div className="mt-0.5">
                  <Badge tone={selectedItem.aktif ? "green" : "slate"}>
                    {selectedItem.aktif ? "Aktif" : "Diarsipkan"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Price levels */}
            <div className="space-y-2">
              <Label>Struktur Harga</Label>
              <div className="grid grid-cols-2 gap-4 border border-border p-4 rounded-xl">
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-muted-2)] uppercase">Harga Modal</span>
                  <p className="font-bold font-mono text-foreground text-sm mt-1">
                    {canEdit ? formatRupiah(selectedItem.hargaBeli) : "🔒 Dibatasi"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-muted-2)] uppercase">Harga Jual</span>
                  <p className="font-bold font-mono text-[var(--primary)] text-sm mt-1">
                    {formatRupiah(selectedItem.hargaJual)}
                  </p>
                </div>
              </div>
            </div>

            {/* Stock Levels */}
            <div className="space-y-2">
              <Label>Informasi Ketersediaan Stok</Label>
              <div className="grid grid-cols-3 gap-3 border border-border p-4 rounded-xl text-xs font-semibold">
                <div>
                  <span className="text-[var(--text-muted-2)] block mb-1">Stok Awal</span>
                  <span className="text-foreground text-sm font-bold font-mono">{selectedItem.stokAwal} unit</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted-2)] block mb-1">Sisa Stok</span>
                  <span className={cn(
                    "text-sm font-bold font-mono",
                    selectedItem.stok < 0 ? "text-red-650" : selectedItem.stok < selectedItem.minStok ? "text-amber-600" : "text-foreground"
                  )}>
                    {selectedItem.stok} unit
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted-2)] block mb-1">Stok Minimum</span>
                  <span className="text-foreground text-sm font-bold font-mono">{selectedItem.minStok} unit</span>
                </div>
              </div>
            </div>

            {/* History Card Movements */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Kartu Stok (10 Pergerakan Terkini)</Label>
                {loadingHistory && <RefreshCw size={12} className="animate-spin text-slate-400" />}
              </div>
              
              <div className="w-full">
                <Table className="text-xs shadow-none">
                  <thead>
                    <tr className="bg-[var(--surface-2)] text-[10px] text-muted">
                      <Th className="py-2.5">Tanggal</Th>
                      <Th className="py-2.5">Tipe</Th>
                      <Th className="py-2.5 text-right">Kuantitas</Th>
                      <Th className="py-2.5">Keterangan</Th>
                      <Th className="py-2.5">Petugas</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr>
                        <Td colSpan={5} className="py-8 text-center text-slate-400">Memuat riwayat stok...</Td>
                      </tr>
                    ) : itemHistory.length === 0 ? (
                      <tr>
                        <Td colSpan={5} className="py-8 text-center text-slate-400">Belum ada pergerakan stok.</Td>
                      </tr>
                    ) : (
                      itemHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-[var(--surface-hover)]">
                          <Td className="py-2">{formatTanggal(h.tanggal)}</Td>
                          <Td className="py-2 select-none">
                            {h.tipe === "MASUK" && <Badge tone="green" className="text-[8px]">IN</Badge>}
                            {h.tipe === "KELUAR" && <Badge tone="slate" className="text-[8px]">OUT</Badge>}
                            {h.tipe === "RETUR" && <Badge tone="blue" className="text-[8px]">RET</Badge>}
                            {h.tipe === "KOREKSI" && <Badge tone="amber" className="text-[8px]">ADJ</Badge>}
                          </Td>
                          <Td className={cn(
                            "py-2 text-right font-bold font-mono",
                            h.qty > 0 ? "text-primary-600" : "text-red-500"
                          )}>
                            {h.qty > 0 ? `+${h.qty}` : h.qty}
                          </Td>
                          <Td className="py-2 text-slate-500 max-w-[120px] truncate" title={h.keterangan ?? ""}>
                            {h.keterangan ?? "—"}
                          </Td>
                          <Td className="py-2 text-slate-500">{h.user}</Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* 5. Stock Opname (SO) Print Preview Modal */}
      {canEdit && openSOPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/55 p-4 backdrop-blur-xs no-print" onClick={() => setOpenSOPreview(false)}>
          <div onClick={(e) => e.stopPropagation()} className="my-4 w-full overflow-hidden rounded-2xl bg-card shadow-2xl border border-border max-w-4xl">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Pratinjau Lembar Stock Opname
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => printArea({ className: "print-format-a4" })}>
                  <Printer size={13} /> Cetak Sekarang (PDF)
                </Button>
                <button onClick={() => setOpenSOPreview(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted-2)] hover:bg-[var(--surface-hover)] hover:text-foreground transition cursor-pointer">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto bg-[var(--paper-2)] p-6" style={{ maxHeight: "calc(100dvh - 120px)" }}>
              {/* Document print area */}
              <div className="so-sheet print-area print-a4-preview mx-auto origin-top overflow-visible rounded-xl border border-border bg-white p-8 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.18)]">
                <div className="space-y-6 text-[#10201e] font-sans">
                  {/* Header */}
                  <div className="so-header border-b-2 pb-4">
                    <h1 className="text-center text-xl font-bold uppercase tracking-wide">Lembar Stock Opname Gudang</h1>
                    <p className="text-center text-xs mt-1">PUTRA CORPORATION SOFTWARE</p>
                    <div className="mt-4 grid grid-cols-2 text-xs">
                      <div>
                        <p>Tanggal Cetak: <span className="font-semibold">{formatTanggal(new Date().toISOString())}</span></p>
                        <p>Total Item: <span className="font-semibold">{filteredItems.length} barang</span></p>
                      </div>
                      <div className="text-right">
                        <p>Kondisi Stok: <span className="font-semibold">{stockCondition === "LOW" ? "Stok Menipis" : stockCondition === "NEGATIVE" ? "Stok Minus" : "Semua"}</span></p>
                        <p>Status Barang: <span className="font-semibold">{statusFilter === "ACTIVE" ? "Aktif" : statusFilter === "INACTIVE" ? "Diarsipkan" : "Semua"}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="so-table w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="so-table-head">
                        <th className="text-center w-8">No</th>
                        <th className="text-left w-24">Kode Barang</th>
                        <th className="text-left">Nama Barang</th>
                        {showSystemStock && <th className="text-right w-20">Stok Sistem</th>}
                        <th className="text-center w-24">Stok Fisik</th>
                        <th className="text-center w-12">Sesuai</th>
                        <th className="text-center w-12">Selisih</th>
                        <th className="text-left w-32">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="text-center font-mono">{idx + 1}</td>
                          <td className="font-mono font-semibold">{it.kode}</td>
                          <td className="font-medium">{it.nama}</td>
                          {showSystemStock && <td className="text-right font-mono font-bold">{it.stok} unit</td>}
                          <td className="text-center">
                            <span className="so-write-line">&nbsp;</span>
                          </td>
                          <td className="text-center">
                            <span className="so-check"></span>
                          </td>
                          <td className="text-center">
                            <span className="so-check"></span>
                          </td>
                          <td>
                            <span className="so-note-line">&nbsp;</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Signatures */}
                  <div className="pt-8 grid grid-cols-2 text-center text-xs text-[#60736f]">
                    <div>
                      <p className="mb-14">Petugas Gudang (Checker)</p>
                      <div className="w-36 mx-auto border-b border-[#94a3b8]"></div>
                    </div>
                    <div>
                      <p className="mb-14">Supervisor / Owner</p>
                      <div className="w-36 mx-auto border-b border-[#94a3b8]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 6. Barcode Label Print Preview Modal */}
      {canEdit && openBarcodePreview && selectedItem && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs no-print"
          style={{ zIndex: 2147483001 }}
          onClick={() => setOpenBarcodePreview(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl border border-border anim-rise">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <h3 className="font-bold text-foreground text-sm">
                Pratinjau Label Barcode / QR
              </h3>
              <button onClick={() => setOpenBarcodePreview(false)} className="text-slate-400 hover:text-slate-700 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 bg-[var(--surface-2)] flex flex-col items-center justify-center min-h-[220px]">
              <p className="text-xs text-[var(--text-muted-2)] font-bold mb-3 uppercase">Tampilan Label (Stiker 50x30mm)</p>

              <div
                className="print-area"
                style={{
                  backgroundColor: "#ffffff",
                  display: "inline-block",
                  padding: "0",
                  margin: "0"
                }}
              >
                <table
                  className="font-sans"
                  style={{
                    width: "250px",
                    height: "130px",
                    border: "2px dashed #000000",
                    backgroundColor: "#ffffff",
                    color: "#000000",
                    borderCollapse: "collapse",
                    boxSizing: "border-box",
                    fontFamily: "sans-serif"
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          width: "95px",
                          textAlign: "center",
                          verticalAlign: "middle",
                          padding: "8px",
                          boxSizing: "border-box"
                        }}
                      >
                        {qrCodeUrl ? (
                          <img
                            src={qrCodeUrl}
                            style={{
                              width: "75px",
                              height: "75px",
                              display: "inline-block",
                              objectFit: "contain"
                            }}
                            alt="QR Code"
                          />
                        ) : (
                          <div style={{ fontSize: "8px", fontWeight: "bold", color: "#666" }}>Memuat...</div>
                        )}
                        <div
                          style={{
                            fontSize: "8px",
                            fontFamily: "monospace",
                            fontWeight: "bold",
                            marginTop: "4px",
                            color: "#333",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {selectedItem.kode}
                        </div>
                      </td>

                      <td
                        style={{
                          verticalAlign: "middle",
                          padding: "8px 12px 8px 0px",
                          boxSizing: "border-box"
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "900",
                            textTransform: "uppercase",
                            lineHeight: "1.2",
                            color: "#000000",
                            wordBreak: "break-all",
                            marginBottom: "6px"
                          }}
                        >
                          {selectedItem.nama}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "#000000"
                          }}
                        >
                          {formatRupiah(Number(selectedItem.hargaJual))}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 px-4 py-3 border-t border-border bg-slate-50/50">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenBarcodePreview(false)}>
                Batal
              </Button>
              <Button size="sm" onClick={() => {
                printArea({ thermal: true });
                startTransition(async () => {
                  await logBarcodePrint(selectedItem.id, selectedItem.nama);
                });
                toast.success("Mencetak barcode label...");
                setOpenBarcodePreview(false);
              }}>
                <Printer size={13} /> Cetak Label
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 7. Modal Konfirmasi Hapus Barang */}
      {canEdit && showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl anim-rise"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-foreground">Hapus barang ini?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Anda akan menghapus <b className="text-rose-700">{selectedIds.size} barang</b> secara permanen.
                  Tindakan ini <b>tidak bisa dibatalkan</b>.
                </p>
                <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  Barang yang sudah punya riwayat transaksi/stok tidak akan dihapus (gunakan <b>Arsipkan</b> untuk itu).
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2.5 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Batal
              </Button>
              <Button type="button" variant="danger" onClick={handleConfirmDelete} disabled={deleting}>
                <Trash2 size={14} /> {deleting ? "Menghapus…" : `Ya, Hapus (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
