"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, Th, Td, Badge, Input, Select, Card, Label, Button } from "@/components/ui";
import { Pagination, usePagination } from "@/components/Pagination";
import { formatTanggal } from "@/lib/utils";
import { Search, ArrowDownCircle, ArrowUpCircle, RefreshCcw, RotateCcw, List, Activity, Calendar, User, X } from "lucide-react";
import { barangMasuk, koreksiStok } from "./actions";
import { toast } from "sonner";

type ItemOption = { id: number; kode: string; nama: string };
type LedgerRow = {
  id: number;
  itemId: number;
  itemName: string;
  itemKode: string;
  itemMinStok: number;
  itemStokAwal: number;
  tanggal: string;
  tipe: "MASUK" | "KELUAR" | "RETUR" | "KOREKSI";
  qty: number;
  keterangan: string | null;
  userId: number | null;
  userName: string;
};

const TIPE_TONE = {
  MASUK: "green" as const,
  KELUAR: "red" as const,
  RETUR: "blue" as const,
  KOREKSI: "amber" as const,
};

const TIPE_LABEL = {
  MASUK: "IN",
  KELUAR: "OUT",
  RETUR: "RETURN",
  KOREKSI: "ADJUSTMENT",
};

export function StokClient({
  initialLedgers,
  items,
}: {
  initialLedgers: LedgerRow[];
  items: ItemOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedItemId, setSelectedItemId] = useState<number | "">("");
  const [tipeFilter, setTipeFilter] = useState<"ALL" | "MASUK" | "KELUAR" | "RETUR" | "KOREKSI">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  // Quick update modal state
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updateItemId, setUpdateItemId] = useState<number | null>(null);
  const [updateItemName, setUpdateItemName] = useState("");
  const [updateTab, setUpdateTab] = useState<"MASUK" | "KOREKSI">("MASUK");
  const [qtyMasuk, setQtyMasuk] = useState("1");
  const [stokSeharusnya, setStokSeharusnya] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleOpenQuickUpdate = (itemId: number, itemName: string) => {
    setUpdateItemId(itemId);
    setUpdateItemName(itemName);
    setUpdateTab("MASUK");
    setQtyMasuk("1");
    setStokSeharusnya("");
    setKeterangan("");
    setUpdateError(null);
    setIsUpdateOpen(true);
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    if (!updateItemId) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("itemId", String(updateItemId));
      formData.append("keterangan", keterangan.trim());

      try {
        let res;
        if (updateTab === "MASUK") {
          if (Number(qtyMasuk) <= 0) {
            setUpdateError("Qty harus lebih besar dari 0");
            return;
          }
          formData.append("qty", qtyMasuk);
          res = await barangMasuk(null, formData);
        } else {
          if (!stokSeharusnya) {
            setUpdateError("Stok seharusnya wajib diisi");
            return;
          }
          formData.append("stokSeharusnya", stokSeharusnya);
          res = await koreksiStok(null, formData);
        }

        if (res && res.ok) {
          toast.success(
            updateTab === "MASUK"
              ? "Stok berhasil ditambah!"
              : "Stok berhasil dikoreksi!"
          );
          setIsUpdateOpen(false);
          router.refresh();
        } else if (res && res.error) {
          setUpdateError(res.error);
        }
      } catch (err) {
        setUpdateError("Terjadi kesalahan sistem saat memperbarui stok.");
      }
    });
  };

  // Process data & compute running balances dynamically if filtered by a single item
  const processedRows = useMemo(() => {
    // 1. Sort chronologically (asc) to calculate running balance correctly
    const sorted = [...initialLedgers].reverse();
    
    // Track running balance map per item
    const balanceTracker = new Map<number, number>();
    
    const mapped = sorted.map((row) => {
      const current = balanceTracker.get(row.itemId) ?? row.itemStokAwal;
      const nextBalance = current + row.qty;
      balanceTracker.set(row.itemId, nextBalance);
      return {
        ...row,
        runningBalance: nextBalance,
      };
    });

    // Reverse back to desc for list display
    const finalRows = mapped.reverse();

    // Apply UI Filters
    return finalRows.filter((r) => {
      const matchesItem = selectedItemId === "" || r.itemId === Number(selectedItemId);
      const matchesTipe = tipeFilter === "ALL" || r.tipe === tipeFilter;
      const matchesSearch =
        searchQuery === "" ||
        r.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.keterangan && r.keterangan.toLowerCase().includes(searchQuery.toLowerCase()));

      const rowDate = new Date(r.tanggal);
      const matchesStart = startDate === "" || rowDate >= new Date(startDate);
      const matchesEnd = endDate === "" || rowDate <= new Date(endDate + "T23:59:59");

      return matchesItem && matchesTipe && matchesSearch && matchesStart && matchesEnd;
    });
  }, [initialLedgers, selectedItemId, tipeFilter, searchQuery, startDate, endDate]);

  const ledgerPg = usePagination(processedRows, 10);

  return (
    <div className="space-y-6">
      {/* View Toggle and Filter Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-lg font-bold text-slate-800">Riwayat & Filter Mutasi</h2>
        
        {/* Toggle Control */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-xs self-end">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              viewMode === "table"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <List size={14} />
            Tampilan Tabel
          </button>
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              viewMode === "timeline"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Activity size={14} />
            Tampilan Timeline
          </button>
        </div>
      </div>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-5 p-5">
        <div>
          <Label>Pilih Barang (Kartu Stok)</Label>
          <Select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— Semua Barang —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.kode} &middot; {it.nama}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Tipe Mutasi</Label>
          <Select value={tipeFilter} onChange={(e) => setTipeFilter(e.target.value as any)}>
            <option value="ALL">Semua Mutasi</option>
            <option value="MASUK">MASUK (IN)</option>
            <option value="KELUAR">KELUAR (OUT)</option>
            <option value="RETUR">RETUR (RETURN)</option>
            <option value="KOREKSI">KOREKSI (ADJUSTMENT)</option>
          </Select>
        </div>
        <div>
          <Label>Mulai Tanggal</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label>Hingga Tanggal</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <Label>Cari Detail / Keterangan</Label>
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-3 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nomor PC / referensi..."
              className="pl-8"
            />
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {viewMode === "table" ? (
        <Table>
          <thead>
              <tr>
                <Th className="w-40">Tanggal</Th>
                <Th>Barang</Th>
                <Th className="w-32">Mutasi</Th>
                <Th className="text-right w-28">Stok Masuk</Th>
                <Th className="text-right w-28">Stok Keluar</Th>
                <Th className="text-right w-32">
                  {selectedItemId !== "" ? "Saldo Berjalan" : "Posisi Mutasi"}
                </Th>
                <Th>Keterangan / Ref</Th>
                <Th className="w-36">Operator</Th>
                <Th className="text-center w-36">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {ledgerPg.pageData.map((l) => {
                const isPositive = l.qty > 0;
                const isZero = l.qty === 0;

                return (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <Td className="text-slate-500 font-medium text-xs">
                      {formatTanggal(l.tanggal)}
                    </Td>
                    <Td>
                      <div className="font-semibold text-slate-800">{l.itemName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{l.itemKode}</div>
                    </Td>
                    <Td>
                      <Badge tone={TIPE_TONE[l.tipe]}>
                        <span className="flex items-center gap-1">
                          {l.tipe === "MASUK" && <ArrowUpCircle size={12} />}
                          {l.tipe === "KELUAR" && <ArrowDownCircle size={12} />}
                          {l.tipe === "RETUR" && <RotateCcw size={12} />}
                          {l.tipe === "KOREKSI" && <RefreshCcw size={12} />}
                          {TIPE_LABEL[l.tipe]}
                        </span>
                      </Badge>
                    </Td>
                    <Td className="text-right font-semibold font-mono text-emerald-600">
                      {isPositive ? `+${l.qty}` : "-"}
                    </Td>
                    <Td className="text-right font-semibold font-mono text-rose-600">
                      {!isPositive && !isZero ? l.qty : "-"}
                    </Td>
                    <Td className="text-right font-bold font-mono">
                      {selectedItemId !== "" ? (
                        <span className={l.runningBalance < l.itemMinStok ? "text-rose-600" : "text-slate-800"}>
                          {l.runningBalance}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </Td>
                    <Td className="text-slate-600 text-xs max-w-[200px] truncate" title={l.keterangan ?? ""}>
                      {l.keterangan ?? "Penyesuaian Manual"}
                    </Td>
                    <Td className="text-slate-600 text-xs font-medium">
                      {l.userName}
                    </Td>
                    <Td className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenQuickUpdate(l.itemId, l.itemName)}
                        className="h-8 px-2.5 rounded-[10px] text-xs font-semibold hover:border-[var(--primary)] hover:text-[var(--primary)] transition duration-150 inline-flex items-center gap-1.5 cursor-pointer mx-auto"
                      >
                        <RefreshCcw size={11} /> Update Stok
                      </Button>
                    </Td>
                  </tr>
                );
              })}
              {processedRows.length === 0 && (
                <tr>
                  <Td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                    Belum ada pergerakan stok untuk saringan ini.
                  </Td>
                </tr>
              )}
            </tbody>
        </Table>
      ) : null}
      {viewMode === "table" && (
        <Pagination page={ledgerPg.page} perPage={ledgerPg.perPage} total={ledgerPg.total} onPage={ledgerPg.setPage} onPerPage={ledgerPg.setPerPage} />
      )}
      {viewMode === "timeline" && (
        /* Timeline View */
        <div className="relative border-l border-slate-200 pl-8 ml-4 space-y-6 py-2">
          {processedRows.map((l) => {
            const isPositive = l.qty > 0;
            const isZero = l.qty === 0;
            
            const iconBg = {
              MASUK: "bg-emerald-50 text-emerald-600 border-emerald-200",
              KELUAR: "bg-rose-50 text-rose-600 border-rose-200",
              RETUR: "bg-blue-50 text-blue-600 border-blue-200",
              KOREKSI: "bg-amber-50 text-amber-600 border-amber-200",
            }[l.tipe];

            return (
              <div key={l.id} className="relative group">
                {/* Timeline Dot Indicator */}
                <div className={`absolute -left-[45px] top-1 flex items-center justify-center w-8 h-8 rounded-full border shadow-xs transition-transform group-hover:scale-105 ${iconBg}`}>
                  {l.tipe === "MASUK" && <ArrowUpCircle size={16} />}
                  {l.tipe === "KELUAR" && <ArrowDownCircle size={16} />}
                  {l.tipe === "RETUR" && <RotateCcw size={16} />}
                  {l.tipe === "KOREKSI" && <RefreshCcw size={16} />}
                </div>

                {/* Timeline Card */}
                <Card className="hover:border-slate-300 hover:shadow-xs transition-all duration-200 p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge tone={TIPE_TONE[l.tipe]}>
                          {TIPE_LABEL[l.tipe]}
                        </Badge>
                        <span className="text-[11px] text-slate-450 flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-400" />
                          {formatTanggal(l.tanggal)}
                        </span>
                        <span className="text-[11px] text-slate-450 flex items-center gap-1.5">
                          <User size={12} className="text-slate-400" />
                          {l.userName}
                        </span>
                      </div>
                      
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-tight">
                          {l.itemName}
                        </h3>
                        <span className="font-mono text-[10px] text-slate-400">
                          SKU: {l.itemKode}
                        </span>
                      </div>
                      
                      <p className="text-slate-600 text-xs leading-relaxed">
                        {l.keterangan ?? "Penyesuaian Manual"}
                      </p>
                    </div>

                    {/* Quantity & Balance */}
                    <div className="flex md:flex-col items-baseline md:items-end justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="text-right">
                        <span className={`text-base font-extrabold font-mono ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isPositive ? `+${l.qty}` : l.qty}
                        </span>
                        <span className="text-xs text-slate-400 ml-1 font-semibold">pcs</span>
                      </div>
                      
                      {selectedItemId !== "" ? (
                        <div className="text-right md:mt-1">
                          <span className="text-[11px] text-slate-400">Saldo: </span>
                          <span className={`text-sm font-bold font-mono ${l.runningBalance < l.itemMinStok ? "text-rose-600" : "text-slate-800"}`}>
                            {l.runningBalance}
                          </span>
                        </div>
                      ) : (
                        <div className="text-right md:mt-1">
                          <span className="text-[10px] text-slate-400 italic">Filter barang untuk melihat saldo berjalan</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
          {processedRows.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              Belum ada pergerakan stok untuk saringan ini.
            </div>
          )}
        </div>
      )}

      {/* Modal Quick Update Stok */}
      {isUpdateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in" onClick={() => setIsUpdateOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl overflow-y-auto max-h-[90vh] p-6 shadow-2xl border border-border anim-rise">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Update Stok</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">{updateItemName}</p>
              </div>
              <button type="button" onClick={() => setIsUpdateOpen(false)} className="text-slate-400 hover:text-slate-700 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Segment Tab Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mb-4">
              <button
                type="button"
                onClick={() => { setUpdateTab("MASUK"); setUpdateError(null); }}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  updateTab === "MASUK"
                    ? "bg-white text-emerald-700 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Restock (Tambah)
              </button>
              <button
                type="button"
                onClick={() => { setUpdateTab("KOREKSI"); setUpdateError(null); }}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  updateTab === "KOREKSI"
                    ? "bg-white text-amber-700 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Koreksi (Opname)
              </button>
            </div>

            <form onSubmit={handleQuickSubmit} className="space-y-4">
              {updateTab === "MASUK" ? (
                <div>
                  <Label>Qty Masuk</Label>
                  <Input type="number" min={1} value={qtyMasuk} onChange={(e) => setQtyMasuk(e.target.value)} required />
                </div>
              ) : (
                <div>
                  <Label>Stok Seharusnya (Hasil Opname)</Label>
                  <Input type="number" value={stokSeharusnya} onChange={(e) => setStokSeharusnya(e.target.value)} placeholder="Masukkan stok fisik ril" required />
                </div>
              )}

              <div>
                <Label>Keterangan / Referensi</Label>
                <Input
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder={updateTab === "MASUK" ? "mis. dari supplier X" : "mis. stok opname Juni"}
                  required={updateTab === "KOREKSI"}
                />
              </div>

              {updateError && (
                <div className="rounded-xl bg-red-50 p-3 border border-red-200 text-xs text-red-700">
                  {updateError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border mt-5">
                <Button type="button" variant="outline" onClick={() => setIsUpdateOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant={updateTab === "MASUK" ? "success" : "primary"} disabled={isPending}>
                  {isPending ? "Menyimpan…" : updateTab === "MASUK" ? "Tambah Stok" : "Koreksi Stok"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
