"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, Th, Td, Input, Select, Card, Label, Button, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { Pagination, usePagination } from "@/components/Pagination";
import { cn, formatTanggal } from "@/lib/utils";
import { Search, ArrowDownToLine, ArrowUpFromLine, RotateCcw, SlidersHorizontal, List, Activity, Calendar, X, Inbox, Info, PencilLine } from "lucide-react";
import { barangMasuk, koreksiStok } from "./actions";
import { toast } from "sonner";
import { DatePicker } from "@/components/DatePicker";

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

type Tipe = "MASUK" | "KELUAR" | "RETUR" | "KOREKSI";

// Label & warna per jenis mutasi — selaras dengan palet status aplikasi.
const TIPE_META: Record<Tipe, { label: string; icon: typeof ArrowDownToLine; dot: string; text: string; chip: string }> = {
  MASUK: {
    label: "Masuk",
    icon: ArrowDownToLine,
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  },
  KELUAR: {
    label: "Keluar",
    icon: ArrowUpFromLine,
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    chip: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  },
  RETUR: {
    label: "Retur",
    icon: RotateCcw,
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    chip: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  },
  KOREKSI: {
    label: "Koreksi",
    icon: SlidersHorizontal,
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  },
};

const TIPE_FILTERS: { value: "ALL" | Tipe; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "MASUK", label: "Masuk" },
  { value: "KELUAR", label: "Keluar" },
  { value: "RETUR", label: "Retur" },
  { value: "KOREKSI", label: "Koreksi" },
];

export function StokClient({
  initialLedgers,
  items,
  canEdit = false,
  totalCount: _totalCount,
}: {
  initialLedgers: LedgerRow[];
  items: ItemOption[];
  canEdit?: boolean;
  totalCount?: number;
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
  const rowsBeforeTipe = useMemo(() => {
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

    // Apply UI Filters (kecuali jenis; jenis difilter terpisah untuk hitungan chip)
    return finalRows.filter((r) => {
      const matchesItem = selectedItemId === "" || r.itemId === Number(selectedItemId);
      const matchesSearch =
        searchQuery === "" ||
        r.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.keterangan && r.keterangan.toLowerCase().includes(searchQuery.toLowerCase()));

      const rowDate = new Date(r.tanggal);
      const matchesStart = startDate === "" || rowDate >= new Date(startDate);
      const matchesEnd = endDate === "" || rowDate <= new Date(endDate + "T23:59:59");

      return matchesItem && matchesSearch && matchesStart && matchesEnd;
    });
  }, [initialLedgers, selectedItemId, searchQuery, startDate, endDate]);

  const countsByTipe = useMemo(() => {
    const c = { ALL: rowsBeforeTipe.length, MASUK: 0, KELUAR: 0, RETUR: 0, KOREKSI: 0 };
    for (const r of rowsBeforeTipe) c[r.tipe] += 1;
    return c;
  }, [rowsBeforeTipe]);

  const processedRows = useMemo(
    () => (tipeFilter === "ALL" ? rowsBeforeTipe : rowsBeforeTipe.filter((r) => r.tipe === tipeFilter)),
    [rowsBeforeTipe, tipeFilter]
  );

  const ledgerPg = usePagination(processedRows, 10);

  const hasActiveFilter = selectedItemId !== "" || searchQuery !== "" || startDate !== "" || endDate !== "" || tipeFilter !== "ALL";
  const resetFilters = () => {
    setSelectedItemId("");
    setTipeFilter("ALL");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  };

  const showSaldo = selectedItemId !== "";

  // Garis waktu: data halaman aktif dikelompokkan per tanggal.
  const pageRows = ledgerPg.pageData;
  const timelineGroups = useMemo(() => {
    const groups: { key: string; label: string; net: number; rows: typeof pageRows }[] = [];
    for (const row of pageRows) {
      const d = new Date(row.tanggal);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: formatTanggal(row.tanggal), net: 0, rows: [] };
        groups.push(g);
      }
      g.rows.push(row);
      g.net += row.qty;
    }
    return groups;
  }, [pageRows]);

  const qtyText = (qty: number) => (qty > 0 ? `+${qty}` : qty === 0 ? "0" : String(qty));
  const qtyClass = (qty: number) =>
    qty > 0 ? "text-emerald-600 dark:text-emerald-400" : qty < 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--text-muted-2)]";

  /** Baris ringkas untuk garis waktu & tampilan HP. */
  const renderCompactRow = (l: (typeof processedRows)[number]) => {
    const meta = TIPE_META[l.tipe];
    const Icon = meta.icon;
    return (
      <li key={l.id} className="group flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.chip)} title={meta.label}>
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground dark:text-slate-100">{l.itemName}</p>
          <p className="truncate text-[11px] text-[var(--text-muted-2)]">
            <span className="font-mono">{l.itemKode}</span>
            <span className="mx-1.5 opacity-50">·</span>
            {l.keterangan ?? "Penyesuaian manual"}
            <span className="mx-1.5 opacity-50">·</span>
            {l.userName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("tnum text-sm font-bold", qtyClass(l.qty))}>{qtyText(l.qty)}</p>
          {showSaldo && (
            <p className={cn("tnum text-[11px]", l.runningBalance < l.itemMinStok ? "text-rose-600 dark:text-rose-300" : "text-[var(--text-muted-2)]")}>
              Saldo {l.runningBalance}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => handleOpenQuickUpdate(l.itemId, l.itemName)}
            title="Update stok barang ini"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
          >
            <PencilLine size={14} />
          </button>
        )}
      </li>
    );
  };

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
      <Inbox size={24} className="text-[var(--text-muted-2)] opacity-70" />
      <p className="text-sm font-semibold text-foreground">Belum ada pergerakan stok</p>
      <p className="text-xs text-[var(--text-muted-2)]">Ubah filter atau rentang tanggal untuk melihat data lain.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Baris 1: chip jenis pergerakan + toggle tampilan */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none lg:pb-0">
          {TIPE_FILTERS.map((f) => {
            const active = tipeFilter === f.value;
            const count = f.value === "ALL" ? countsByTipe.ALL : countsByTipe[f.value];
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setTipeFilter(f.value)}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)] dark:text-sky-300"
                    : "border-border bg-card text-[var(--text-soft)] hover:border-[var(--primary)]/30 hover:text-foreground"
                )}
              >
                {f.value !== "ALL" && <span className={cn("h-1.5 w-1.5 rounded-full", TIPE_META[f.value].dot)} />}
                {f.label}
                <span className={cn("tnum rounded-full px-1.5 text-[10px] font-bold", active ? "bg-[var(--primary)]/15" : "bg-[var(--surface-2)] text-[var(--text-muted-2)]")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="bento-segment flex shrink-0 self-start rounded-xl p-1 lg:self-auto" role="tablist" aria-label="Tampilan">
          {([
            { key: "table", label: "Tabel", icon: List },
            { key: "timeline", label: "Garis waktu", icon: Activity },
          ] as const).map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={viewMode === v.key}
              onClick={() => setViewMode(v.key)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                viewMode === v.key
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-[var(--text-muted-2)] hover:text-foreground"
              )}
            >
              <v.icon size={14} /> {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Baris 2: filter ringkas */}
      <Card className="relative z-20 grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 sm:p-3.5 lg:grid-cols-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]">
        <div className="relative lg:col-span-3 xl:col-span-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 z-10 text-[var(--text-muted-2)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            maxLength={FIELD_LIMITS.search}
            placeholder="Cari barang, no. transaksi, keterangan…"
            aria-label="Cari pergerakan stok"
            className="h-10 rounded-xl pl-9 text-[13px] font-medium"
          />
        </div>
        {/* Select hanya meneruskan kelas col-* tanpa prefix ke wrapper, jadi span responsif di div ini. */}
        <div className="min-w-0 lg:col-span-3 xl:col-span-1">
          <Select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value ? Number(e.target.value) : "")}
            className="h-10 w-full rounded-xl px-3.5 text-[13px] font-medium"
            aria-label="Pilih barang (kartu stok)"
          >
            <option value="">Semua barang</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.kode} · {it.nama}
              </option>
            ))}
          </Select>
        </div>
        <DatePicker value={startDate} onChange={(val) => setStartDate(val)} placeholder="Dari tanggal" className="h-10 rounded-xl text-[13px] font-medium lg:col-span-2 xl:col-span-1" />
        <DatePicker value={endDate} onChange={(val) => setEndDate(val)} align="right" placeholder="Sampai tanggal" className="h-10 rounded-xl text-[13px] font-medium lg:col-span-2 xl:col-span-1" />
        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasActiveFilter}
          className="field-surface inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3.5 text-[13px] font-medium text-[var(--text-soft)] transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 sm:col-span-2 lg:col-span-2 xl:col-span-1"
        >
          <X size={14} /> Reset
        </button>
      </Card>

      {showSaldo && (
        <p className="flex items-center gap-2 px-1 text-xs text-[var(--text-muted-2)]">
          <Info size={13} className="text-[var(--primary)]" />
          Kartu stok aktif — kolom saldo menampilkan stok berjalan setelah setiap mutasi.
        </p>
      )}

      {/* Konten */}
      {processedRows.length === 0 ? (
        emptyState
      ) : viewMode === "table" ? (
        <>
          {/* Tabel butuh ±870px; di bawah xl (sidebar terbuka) pakai daftar ringkas. */}
          <div className="hidden xl:block">
            <Table tableClassName="[&_tbody_td]:whitespace-nowrap [&_th]:px-4 [&_td]:px-4">
              <thead>
                <tr>
                  <Th className="w-32">Tanggal</Th>
                  <Th>Barang</Th>
                  <Th className="w-28">Jenis</Th>
                  <Th className="w-20 text-right">Qty</Th>
                  {showSaldo && <Th className="w-20 text-right">Saldo</Th>}
                  <Th>Keterangan</Th>
                  <Th className="w-32">Petugas</Th>
                  {canEdit && <Th className="w-14 text-center">Aksi</Th>}
                </tr>
              </thead>
              <tbody>
                {ledgerPg.pageData.map((l) => {
                  const meta = TIPE_META[l.tipe];
                  return (
                    <tr key={l.id}>
                      <Td className="text-xs text-[var(--text-muted-2)]">{formatTanggal(l.tanggal)}</Td>
                      <Td>
                        <p className="max-w-[260px] truncate font-semibold text-foreground dark:text-slate-100">{l.itemName}</p>
                        <p className="font-mono text-[11px] text-[var(--text-muted-2)]">{l.itemKode}</p>
                      </Td>
                      <Td>
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", meta.text)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                          {meta.label}
                        </span>
                      </Td>
                      <Td className={cn("tnum text-right text-sm font-bold", qtyClass(l.qty))}>{qtyText(l.qty)}</Td>
                      {showSaldo && (
                        <Td
                          className={cn(
                            "tnum text-right text-sm font-semibold",
                            l.runningBalance < l.itemMinStok ? "text-rose-600 dark:text-rose-300" : "text-foreground dark:text-slate-200"
                          )}
                        >
                          {l.runningBalance}
                        </Td>
                      )}
                      <Td className="max-w-[260px] truncate text-xs text-[var(--text-soft)]" title={l.keterangan ?? ""}>
                        {l.keterangan ?? "Penyesuaian manual"}
                      </Td>
                      <Td className="text-xs text-[var(--text-soft)]">{l.userName}</Td>
                      {canEdit && (
                        <Td className="text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenQuickUpdate(l.itemId, l.itemName)}
                            title="Update stok barang ini"
                            className="mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
                          >
                            <PencilLine size={14} />
                          </button>
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          {/* HP: daftar ringkas */}
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card xl:hidden">
            {ledgerPg.pageData.map((l) => (
              renderCompactRow(l)
            ))}
          </ul>
        </>
      ) : (
        /* Garis waktu ringkas: dikelompokkan per tanggal, ikut paginasi */
        <div className="space-y-4">
          {timelineGroups.map((g) => (
            <section key={g.key}>
              <div className="mb-2 flex items-center gap-3 px-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Calendar size={13} className="text-[var(--primary)]" />
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-[var(--text-muted-2)]">
                  {g.rows.length} mutasi · net <span className={cn("tnum font-bold", qtyClass(g.net))}>{qtyText(g.net)}</span>
                </span>
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {g.rows.map((l) => (
                  renderCompactRow(l)
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {processedRows.length > 0 && (
        <Pagination page={ledgerPg.page} perPage={ledgerPg.perPage} total={ledgerPg.total} onPage={ledgerPg.setPage} onPerPage={ledgerPg.setPerPage} />
      )}

      {/* Modal Quick Update Stok */}
      {canEdit && isUpdateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in" onClick={() => setIsUpdateOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card rounded-2xl overflow-y-auto max-h-[90vh] p-6 shadow-2xl border border-border anim-rise">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div>
                <h3 className="font-bold text-foreground text-base">Perbarui Stok</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">{updateItemName}</p>
              </div>
              <button type="button" onClick={() => setIsUpdateOpen(false)} className="text-slate-400 hover:text-slate-700 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Segment Tab Selector */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-border mb-4">
              <button
                type="button"
                onClick={() => { setUpdateTab("MASUK"); setUpdateError(null); }}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  updateTab === "MASUK"
                    ? "bg-card text-primary-700 shadow-sm border border-border/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Tambah Stok
              </button>
              <button
                type="button"
                onClick={() => { setUpdateTab("KOREKSI"); setUpdateError(null); }}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  updateTab === "KOREKSI"
                    ? "bg-card text-amber-700 shadow-sm border border-border/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Koreksi Stok
              </button>
            </div>

            <form onSubmit={handleQuickSubmit} className="space-y-4">
              {updateTab === "MASUK" ? (
                <div>
                  <Label>Jumlah Masuk</Label>
                  <Input type="number" min={1} max={FIELD_LIMITS.maxQty} value={qtyMasuk} onChange={(e) => setQtyMasuk(e.target.value)} required />
                </div>
              ) : (
                <div>
                  <Label>Stok Fisik (Hasil Hitung)</Label>
                  <Input type="number" min={0} max={FIELD_LIMITS.maxQty} value={stokSeharusnya} onChange={(e) => setStokSeharusnya(e.target.value)} placeholder="Stok fisik hasil hitung" required />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Keterangan / Referensi</Label>
                  <CharCounter value={keterangan} max={FIELD_LIMITS.keterangan} />
                </div>
                <Input
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  maxLength={FIELD_LIMITS.keterangan}
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
