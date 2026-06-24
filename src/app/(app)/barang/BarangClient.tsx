"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { getItemHistory, toggleAktif } from "./actions";
import { Button, Card, Input, Label, Select, Table, Th, Td, Badge } from "@/components/ui";
import { Drawer } from "@/components/Drawer";
import { formatRupiah, formatTanggal, cn } from "@/lib/utils";
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
} from "lucide-react";
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
    const asset = items.reduce((acc, i) => acc + i.hargaBeli * i.stok, 0);
    return { total, active, low, negative, asset };
  }, [items]);

  // Filter items dataset
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch =
        it.nama.toLowerCase().includes(q.toLowerCase()) ||
        it.kode.toLowerCase().includes(q.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && it.aktif) ||
        (statusFilter === "INACTIVE" && !it.aktif);

      const matchesStock =
        stockCondition === "ALL" ||
        (stockCondition === "LOW" && it.stok >= 0 && it.stok < it.minStok) ||
        (stockCondition === "NEGATIVE" && it.stok < 0);

      return matchesSearch && matchesStatus && matchesStock;
    });
  }, [items, q, statusFilter, stockCondition]);

  // Total nilai aset persediaan = Σ (harga beli × stok akhir) untuk hasil saringan
  const totalAset = useMemo(
    () => filteredItems.reduce((acc, i) => acc + i.hargaBeli * i.stok, 0),
    [filteredItems]
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const handleEditProduct = (item: ItemData) => {
    setSelectedItem(null); // Close drawer
    window.dispatchEvent(
      new CustomEvent("edit-barang", {
        detail: {
          id: item.id,
          kode: item.kode,
          nama: item.nama,
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
        toast.error("Gagal mengubah status barang");
      }
    });
  }

  function handleDuplicateProduct(item: ItemData) {
    toast.info(`Menduplikasi produk "${item.nama}"...`);
    // Duplication trigger logic or redirect to prefilled creation
  }

  return (
    <div className="space-y-8">
      {/* 1. Statistics Cards Row */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Katalog Barang", value: `${stats.total} item`, desc: "Semua material terdaftar", icon: Boxes, tone: "blue" },
          { label: "Total Nilai Aset", value: formatRupiah(stats.asset), desc: "Total modal persediaan", icon: Coins, tone: "indigo" },
          { label: "Produk Aktif POS", value: `${stats.active} item`, desc: "Dapat dijual oleh Kasir", icon: ArrowUpRight, tone: "green" },
          { label: "Stok Menipis (Kritis)", value: `${stats.low} item`, desc: "Di bawah batas safety", icon: ArrowDownRight, tone: "amber" },
          { label: "Stok Minus Fisik", value: `${stats.negative} item`, desc: "Perlu rekonsiliasi stok", icon: ShieldAlert, tone: "red" },
        ].map((card) => {
          const Icon = card.icon;
          const toneColors: Record<string, string> = {
            blue: "bg-blue-50 text-blue-700 border-blue-100",
            indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
            green: "bg-emerald-50 text-emerald-700 border-emerald-100",
            amber: "bg-amber-50 text-amber-700 border-amber-100",
            red: "bg-rose-50 text-rose-700 border-rose-100",
          };
          return (
            <Card key={card.label} className="flex items-center gap-4.5">
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border", toneColors[card.tone])}>
                <Icon size={20} strokeWidth={2.3} />
              </div>
              <div className="leading-tight select-none min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-450">{card.label}</p>
                <p className="mt-1 font-extrabold text-slate-800 font-display text-xs sm:text-sm">{card.value}</p>
                <p className="text-[10px] text-slate-450 mt-0.5">{card.desc}</p>
              </div>
            </Card>
          );
        })}
      </section>

      {/* 2. Filters Toolbar */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center p-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari berdasarkan Kode SKU, Barcode, Nama Plywood..."
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 w-40 rounded-xl text-xs font-bold"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif (POS)</option>
            <option value="INACTIVE">Diarsipkan</option>
          </Select>

          <Select
            value={stockCondition}
            onChange={(e) => setStockCondition(e.target.value as any)}
            className="h-10 w-44 rounded-xl text-xs font-bold"
          >
            <option value="ALL">Semua Kondisi Stok</option>
            <option value="LOW">Stok Menipis</option>
            <option value="NEGATIVE">Stok Minus</option>
          </Select>
        </div>
      </Card>

      {/* 3. Inventory Modern Grid Table */}
      <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-[var(--shadow-card)]">
        <Table>
          <thead>
            <tr>
              <Th>Kode SKU</Th>
              <Th>Nama Barang</Th>
              <Th className="text-right">Harga Beli</Th>
              <Th className="text-right">Harga Jual</Th>
              <Th className="text-right w-32">Stok Fisik</Th>
              <Th className="text-right w-40">Total Aset</Th>
              <Th className="text-center w-28">Status</Th>
              <Th className="text-center w-28">Aksi</Th>
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
                  className="hover:bg-slate-50/50 cursor-pointer transition-colors duration-150 group"
                >
                  <Td className="font-mono text-xs font-bold text-slate-800 group-hover:text-[var(--primary)]">
                    {it.kode}
                  </Td>
                  <Td className="font-semibold text-slate-900">{it.nama}</Td>
                  <Td className="text-right font-mono text-xs">
                    {canEdit ? formatRupiah(it.hargaBeli) : "🔒 Dibatasi"}
                  </Td>
                  <Td className="text-right font-mono text-xs font-bold text-[var(--primary)]">
                    {formatRupiah(it.hargaJual)}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1.5 font-mono text-xs font-bold">
                      <span>{it.stok} unit</span>
                      {isNeg ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      ) : isLow ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                    </div>
                  </Td>
                  <Td className={cn(
                    "text-right font-mono text-xs font-bold",
                    it.stok < 0 ? "text-rose-600" : "text-slate-700"
                  )}>
                    {canEdit ? formatRupiah(it.hargaBeli * it.stok) : "🔒"}
                  </Td>
                  <Td className="text-center select-none" onClick={(e) => e.stopPropagation()}>
                    <Badge tone={it.aktif ? "green" : "slate"}>
                      {it.aktif ? "Aktif" : "Arsip"}
                    </Badge>
                  </Td>
                  <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openItemDetails(it)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-border text-slate-500 hover:bg-[var(--primary)] hover:text-white transition mx-auto cursor-pointer"
                    >
                      <Eye size={14} />
                    </button>
                  </Td>
                </tr>
              );
            })}

            {paginatedItems.length === 0 && (
              <tr>
                <Td colSpan={8} className="py-16 text-center text-slate-400 select-none">
                  <Boxes className="mx-auto text-slate-200 mb-2" size={32} />
                  <p className="font-semibold text-sm">Barang Tidak Ditemukan</p>
                  <p className="text-xs">Katalog kosong atau pencarian tidak cocok.</p>
                </Td>
              </tr>
            )}
          </tbody>
          {filteredItems.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50/80 font-bold">
                <Td colSpan={5} className="text-right text-xs uppercase tracking-wider text-slate-500">
                  Total Nilai Aset Persediaan ({filteredItems.length} item)
                </Td>
                <Td className={cn(
                  "text-right font-mono text-sm font-extrabold",
                  totalAset < 0 ? "text-rose-600" : "text-slate-900"
                )}>
                  {canEdit ? formatRupiah(totalAset) : "🔒 Dibatasi"}
                </Td>
                <Td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-white p-4.5 rounded-[18px] border border-border select-none">
          <p className="text-xs text-slate-500 font-semibold">
            Menampilkan halaman {currentPage} dari {totalPages} ({filteredItems.length} total item)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              size="sm"
              variant="outline"
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
            <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
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
                  <Button size="sm" variant="outline" onClick={() => toast.info("Mencetak barcode label...")}>
                    <Printer size={13} /> Cetak Label Barcode
                  </Button>
                </>
              )}
            </div>

            {/* General pricing & SKU info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-4 bg-slate-50/40">
                <p className="text-[10px] font-bold text-slate-450 uppercase mb-1">Kode SKU Barang</p>
                <p className="font-mono font-bold text-slate-800 text-sm">{selectedItem.kode}</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-slate-50/40">
                <p className="text-[10px] font-bold text-slate-450 uppercase mb-1">Status Penjualan POS</p>
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
                  <span className="text-[10px] font-bold text-slate-450 uppercase">Harga Modal (COGS)</span>
                  <p className="font-bold font-mono text-slate-800 text-sm mt-1">
                    {canEdit ? formatRupiah(selectedItem.hargaBeli) : "🔒 Dibatasi"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-450 uppercase">Harga Jual POS</span>
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
                  <span className="text-slate-450 block mb-1">Stok Awal</span>
                  <span className="text-slate-800 text-sm font-bold font-mono">{selectedItem.stokAwal} unit</span>
                </div>
                <div>
                  <span className="text-slate-450 block mb-1">Stok Fisik Saat Ini</span>
                  <span className={cn(
                    "text-sm font-bold font-mono",
                    selectedItem.stok < 0 ? "text-red-650" : selectedItem.stok < selectedItem.minStok ? "text-amber-600" : "text-slate-800"
                  )}>
                    {selectedItem.stok} unit
                  </span>
                </div>
                <div>
                  <span className="text-slate-450 block mb-1">Safety Stock (Min)</span>
                  <span className="text-slate-800 text-sm font-bold font-mono">{selectedItem.minStok} unit</span>
                </div>
              </div>
            </div>

            {/* History Card Movements */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Kartu Stok (10 Pergerakan Terkini)</Label>
                {loadingHistory && <RefreshCw size={12} className="animate-spin text-slate-400" />}
              </div>
              
              <div className="overflow-hidden rounded-xl border border-border bg-white">
                <Table className="text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-muted">
                      <Th className="py-2.5">Tanggal</Th>
                      <Th className="py-2.5">Tipe</Th>
                      <Th className="py-2.5 text-right">Kuantitas</Th>
                      <Th className="py-2.5">Keterangan</Th>
                      <Th className="py-2.5">Operator</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr>
                        <Td colSpan={5} className="py-8 text-center text-slate-400">Memuat data mutasi...</Td>
                      </tr>
                    ) : itemHistory.length === 0 ? (
                      <tr>
                        <Td colSpan={5} className="py-8 text-center text-slate-400">Belum ada mutasi stok.</Td>
                      </tr>
                    ) : (
                      itemHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50/50">
                          <Td className="py-2">{formatTanggal(h.tanggal)}</Td>
                          <Td className="py-2 select-none">
                            {h.tipe === "MASUK" && <Badge tone="green" className="text-[8px]">IN</Badge>}
                            {h.tipe === "KELUAR" && <Badge tone="slate" className="text-[8px]">OUT</Badge>}
                            {h.tipe === "RETUR" && <Badge tone="blue" className="text-[8px]">RET</Badge>}
                            {h.tipe === "KOREKSI" && <Badge tone="amber" className="text-[8px]">ADJ</Badge>}
                          </Td>
                          <Td className={cn(
                            "py-2 text-right font-bold font-mono",
                            h.qty > 0 ? "text-emerald-600" : "text-red-500"
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
    </div>
  );
}
