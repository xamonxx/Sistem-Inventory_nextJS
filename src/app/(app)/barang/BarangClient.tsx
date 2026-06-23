"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { getItemHistory, toggleAktif } from "./actions";
import { Button, Card, Input, Label, Select, Table, Th, Td, Badge } from "@/components/ui";
import { formatRupiah, formatTanggal, cn } from "@/lib/utils";
import { Search, Eye, Filter, Download, ArrowUpRight, ArrowDownRight, RefreshCw, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export type ItemData = {
  id: number;
  kode: string;
  nama: string;
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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [stockCondition, setStockCondition] = useState<"ALL" | "LOW" | "NEGATIVE">("ALL");
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [itemHistory, setItemHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pending, startTransition] = useTransition();

  // Statistics calculation
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.aktif).length;
    const low = items.filter((i) => i.stok >= 0 && i.stok < i.minStok).length;
    const negative = items.filter((i) => i.stok < 0).length;
    return { total, active, low, negative };
  }, [items]);

  // Filter logic
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // 1. Text filter
      const matchesSearch =
        it.nama.toLowerCase().includes(q.toLowerCase()) ||
        it.kode.toLowerCase().includes(q.toLowerCase());

      // 2. Status filter
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && it.aktif) ||
        (statusFilter === "INACTIVE" && !it.aktif);

      // 3. Stock Condition filter
      const matchesStock =
        stockCondition === "ALL" ||
        (stockCondition === "LOW" && it.stok >= 0 && it.stok < it.minStok) ||
        (stockCondition === "NEGATIVE" && it.stok < 0);

      return matchesSearch && matchesStatus && matchesStock;
    });
  }, [items, q, statusFilter, stockCondition]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [q, statusFilter, stockCondition]);

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
      toast.error("Gagal memuat riwayat kartu stok");
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleToggleAktif(itemId: number, currentStatus: boolean) {
    startTransition(async () => {
      try {
        await toggleAktif(itemId, !currentStatus);
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, aktif: !currentStatus } : i))
        );
        toast.success("Status barang berhasil diperbarui");
      } catch {
        toast.error("Gagal mengubah status barang");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Filter size={24} />
          </div>
          <div>
            <p className="text-xs text-muted">Total Barang</p>
            <p className="text-xl font-bold">{stats.total} item</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <p className="text-xs text-muted">Barang Aktif</p>
            <p className="text-xl font-bold">{stats.active} item</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <ArrowDownRight size={24} />
          </div>
          <div>
            <p className="text-xs text-muted">Stok Menipis</p>
            <p className="text-xl font-bold text-amber-700">{stats.low} item</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <ShieldAlert size={24} />
          </div>
          <div>
            <p className="text-xs text-muted">Stok Minus</p>
            <p className="text-xl font-bold text-red-600">{stats.negative} item</p>
          </div>
        </Card>
      </section>

      {/* Filters & Export Toolbar */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative max-w-sm w-full">
            <Search size={18} className="absolute left-3 top-3 text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kode / nama barang..."
              className="pl-10 h-10"
            />
          </div>
          <div className="w-40">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </Select>
          </div>
          <div className="w-48">
            <Select value={stockCondition} onChange={(e) => setStockCondition(e.target.value as any)}>
              <option value="ALL">Semua Kondisi Stok</option>
              <option value="LOW">Stok Menipis</option>
              <option value="NEGATIVE">Stok Minus</option>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/export?type=stok"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-4 text-xs font-semibold text-foreground hover:bg-slate-50 transition"
          >
            <Download size={14} /> Ekspor Excel
          </a>
        </div>
      </section>

      {/* Master Data Grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <thead>
            <tr>
              <Th>Kode</Th>
              <Th>Nama Barang</Th>
              <Th className="text-right">Harga Beli</Th>
              <Th className="text-right">Harga Jual</Th>
              <Th className="text-right">Stok Fisik</Th>
              <Th className="text-right">Min Stok</Th>
              <Th className="text-center">Status</Th>
              <Th className="text-center">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50/50">
                <Td className="font-mono text-xs font-semibold text-slate-600">{it.kode}</Td>
                <Td className="font-medium text-slate-900">{it.nama}</Td>
                <Td className="text-right font-mono text-xs">
                  {canEdit ? formatRupiah(it.hargaBeli) : <span className="text-muted">🔒 Dibatasi</span>}
                </Td>
                <Td className="text-right font-mono text-xs font-semibold text-primary">{formatRupiah(it.hargaJual)}</Td>
                <Td className="text-right">
                  <Badge tone={it.stok < 0 ? "red" : it.stok < it.minStok ? "amber" : "green"}>
                    {it.stok} unit
                  </Badge>
                </Td>
                <Td className="text-right font-mono text-xs text-muted">{it.minStok}</Td>
                <Td className="text-center">
                  <button
                    disabled={!canEdit || pending}
                    onClick={() => handleToggleAktif(it.id, it.aktif)}
                    className="cursor-pointer"
                  >
                    <Badge tone={it.aktif ? "green" : "slate"}>
                      {it.aktif ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </button>
                </Td>
                <Td className="text-center">
                  <div className="flex justify-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => openItemDetails(it)}>
                      <Eye size={13} /> Detail
                    </Button>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.dispatchEvent(new CustomEvent("edit-barang", { detail: it }))}
                      >
                        Ubah
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <Td colSpan={8} className="py-12 text-center text-muted">
                  Tidak ada barang yang cocok dengan penyaringan saat ini.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1 py-3">
          <p className="text-xs text-muted font-medium text-center sm:text-left">
            Menampilkan <span className="font-semibold text-slate-700">{Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)}</span> sampai{" "}
            <span className="font-semibold text-slate-700">{Math.min(filteredItems.length, currentPage * itemsPerPage)}</span> dari{" "}
            <span className="font-semibold text-slate-700">{filteredItems.length}</span> barang
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer"
            >
              Sebelumnya
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                return (
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - currentPage) <= 1
                );
              })
              .map((page, index, array) => {
                const showEllipsis = index > 0 && page - array[index - 1] > 1;
                return (
                  <div key={page} className="flex items-center">
                    {showEllipsis && <span className="px-2 text-xs text-muted">...</span>}
                    <Button
                      size="sm"
                      variant={currentPage === page ? "primary" : "outline"}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "h-8 w-8 p-0 cursor-pointer text-xs font-semibold",
                        currentPage === page ? "" : "text-slate-600"
                      )}
                    >
                      {page}
                    </Button>
                  </div>
                );
              })}
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="cursor-pointer"
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      {/* Item Detail & History Slide Drawer */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setSelectedItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto border-l border-border"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedItem.nama}</h3>
                <span className="font-mono text-xs text-muted">{selectedItem.kode}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-muted hover:text-foreground p-1 rounded-md border border-border"
              >
                <X size={18} />
              </button>
            </div>

            {/* General Info */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Informasi Produk</h4>
                <div className="grid grid-cols-2 gap-3 text-xs border border-border p-3 rounded-lg bg-slate-50">
                  <div>
                    <span className="text-muted">Kode Barang</span>
                    <p className="font-mono font-bold text-slate-800">{selectedItem.kode}</p>
                  </div>
                  <div>
                    <span className="text-muted">Nama Barang</span>
                    <p className="font-semibold text-slate-850">{selectedItem.nama}</p>
                  </div>
                </div>
              </div>

              {/* Pricing details */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Struktur Harga</h4>
                <div className="grid grid-cols-2 gap-3 text-xs border border-border p-3 rounded-lg bg-slate-50">
                  <div>
                    <span className="text-muted">Harga Beli (COGS)</span>
                    <p className="font-bold font-mono text-slate-800">
                      {canEdit ? formatRupiah(selectedItem.hargaBeli) : "🔒 Dibatasi"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted">Harga Jual Eceran/Jasa</span>
                    <p className="font-bold font-mono text-primary">{formatRupiah(selectedItem.hargaJual)}</p>
                  </div>
                </div>
              </div>

              {/* Inventory details */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Kondisi Stok Gudang</h4>
                <div className="grid grid-cols-3 gap-3 text-xs border border-border p-3 rounded-lg bg-slate-50">
                  <div>
                    <span className="text-muted">Stok Awal</span>
                    <p className="font-bold text-slate-800">{selectedItem.stokAwal} unit</p>
                  </div>
                  <div>
                    <span className="text-muted">Stok Saat Ini</span>
                    <p className="font-bold text-slate-800">{selectedItem.stok} unit</p>
                  </div>
                  <div>
                    <span className="text-muted">Minimal Stok (Batas Aman)</span>
                    <p className="font-bold text-slate-800">{selectedItem.minStok} unit</p>
                  </div>
                </div>
              </div>

              {/* Card History Ledger */}
              <div className="pt-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Kartu Stok (10 Pergerakan Terkini)</span>
                  {loadingHistory && <RefreshCw size={11} className="animate-spin text-muted" />}
                </h4>

                <div className="border border-border rounded-lg overflow-hidden bg-white">
                  <Table className="text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-muted">
                        <Th className="py-1">Tanggal</Th>
                        <Th className="py-1">Tipe</Th>
                        <Th className="py-1 text-right">Qty</Th>
                        <Th className="py-1">Oleh</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingHistory ? (
                        <tr>
                          <Td colSpan={4} className="py-6 text-center text-muted">Memuat data...</Td>
                        </tr>
                      ) : itemHistory.length === 0 ? (
                        <tr>
                          <Td colSpan={4} className="py-6 text-center text-muted">Belum ada mutasi stok.</Td>
                        </tr>
                      ) : (
                        itemHistory.map((h) => (
                          <tr key={h.id} className="border-b border-border last:border-0">
                            <Td className="py-1">{formatTanggal(h.tanggal)}</Td>
                            <Td className="py-1">
                              <span className="font-semibold">{h.tipe}</span>
                            </Td>
                            <Td className={`py-1 text-right font-semibold ${h.qty > 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {h.qty > 0 ? `+${h.qty}` : h.qty}
                            </Td>
                            <Td className="py-1 text-muted text-[10px] truncate max-w-[80px]">{h.user}</Td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
