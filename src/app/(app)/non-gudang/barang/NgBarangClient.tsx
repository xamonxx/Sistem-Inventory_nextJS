"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { toggleNgProdukAktif, deleteNgProduk } from "./actions";
import { NgBarangForm, type NgProdukRow } from "./NgBarangForm";
import { Button, Card, Input, Select, Table, TableActionButton, Th, Td, Badge } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { formatRupiah } from "@/lib/utils";
import { usePagination, Pagination } from "@/components/Pagination";
import { Tooltip } from "@/components/Tooltip";
import { Search, Boxes, Store, Percent, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export type NgProdukData = {
  id: number;
  nama: string;
  namaToko: string;
  kategori: string | null;
  satuan: string | null;
  hargaBeli: number;
  hargaJual: number;
  aktif: boolean;
};

function marginPct(hargaBeli: number, hargaJual: number): number {
  if (hargaJual <= 0) return 0;
  return ((hargaJual - hargaBeli) / hargaJual) * 100;
}

export function NgBarangClient({ initialItems }: { initialItems: NgProdukData[] }) {
  const [items, setItems] = useState<NgProdukData[]>(initialItems);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [tokoFilter, setTokoFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();

  useEffect(() => setItems(initialItems), [initialItems]);

  const tokoList = useMemo(
    () => Array.from(new Set(items.map((i) => i.namaToko))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.aktif).length;
    const tokoCount = tokoList.length;
    const margins = items.map((i) => marginPct(i.hargaBeli, i.hargaJual)).filter((m) => Number.isFinite(m));
    const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
    return { total, active, tokoCount, avgMargin };
  }, [items, tokoList]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      const matchesTerm =
        !term ||
        i.nama.toLowerCase().includes(term) ||
        i.namaToko.toLowerCase().includes(term) ||
        (i.kategori ?? "").toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "ALL" || (statusFilter === "ACTIVE" ? i.aktif : !i.aktif);
      const matchesToko = tokoFilter === "ALL" || i.namaToko === tokoFilter;
      return matchesTerm && matchesStatus && matchesToko;
    });
  }, [items, q, statusFilter, tokoFilter]);

  const pg = usePagination(filtered, 10);

  const allOnPageSelected = pg.pageData.length > 0 && pg.pageData.every((i) => selectedIds.has(i.id));

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pg.pageData.forEach((i) => next.delete(i.id));
      } else {
        pg.pageData.forEach((i) => next.add(i.id));
      }
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

  function handleEdit(item: NgProdukData) {
    const detail: NgProdukRow = { ...item };
    window.dispatchEvent(new CustomEvent("edit-ng-produk", { detail }));
  }

  function handleToggleAktif(item: NgProdukData) {
    startTransition(async () => {
      const res = await toggleNgProdukAktif(item.id, !item.aktif);
      if (res.error) toast.error(res.error);
      else {
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, aktif: !x.aktif } : x)));
        toast.success(item.aktif ? "Barang dinonaktifkan" : "Barang diaktifkan");
      }
    });
  }

  function handleDelete() {
    const ids = Array.from(selectedIds);
    startDeleteTransition(async () => {
      const res = await deleteNgProduk(ids);
      if (!res.ok) {
        toast.error(res.error ?? "Gagal menghapus barang.");
        return;
      }
      if (res.deletedIds?.length) {
        setItems((prev) => prev.filter((x) => !res.deletedIds!.includes(x.id)));
        toast.success(`${res.deletedIds.length} barang dihapus`);
      }
      if (res.blocked?.length) {
        toast.warning(`${res.blocked.length} barang tak bisa dihapus (sudah dipakai di invoice).`);
      }
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    });
  }

  const kpi = [
    { icon: Boxes, label: "Total Barang", value: String(stats.total), detail: "SKU non-gudang" },
    { icon: Store, label: "Toko Sumber", value: String(stats.tokoCount), detail: "supplier aktif" },
    { icon: Boxes, label: "Barang Aktif", value: String(stats.active), detail: "siap dijual" },
    { icon: Percent, label: "Rata-rata Margin", value: `${stats.avgMargin.toFixed(1)}%`, detail: "gross margin" },
  ];

  return (
    <div className="space-y-5">
      <header className="liquid-panel liquid-panel-strong dashboard-hero relative z-20 rounded-xl border-sky-200/70 dark:border-sky-300/15" style={{ overflow: "visible" }}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_520px]">
          <div className="border-b border-sky-200/70 p-5 dark:border-sky-300/15 lg:border-b-0 lg:border-r">
            <div className="grid gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 rounded-md border border-sky-200/80 bg-sky-50/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--primary-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200">
                  Master Data
                </span>
                <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-normal text-foreground dark:text-white md:text-5xl">
                  Master Barang Non-Gudang
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-200/90">
                  Pusat data barang trading: toko sumber, harga modal, harga jual, dan margin operasional.
                </p>
              </div>
            </div>
          </div>

          <section className="grid grid-cols-2 divide-x divide-y divide-sky-200/60 bg-sky-50/55 dark:divide-sky-300/15 dark:bg-slate-950/25">
            {kpi.map(({ icon: Icon, label, value, detail }) => (
              <div key={label} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-black tracking-normal text-foreground dark:text-white">{value}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{detail}</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-sky-200/80 bg-white/80 text-[var(--primary-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl dark:border-sky-300/15 dark:bg-sky-400/10 dark:text-sky-200">
                    <Icon size={17} />
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </header>

      {/* Toolbar */}
      <Card className="liquid-panel relative z-30 rounded-xl border-sky-200/70 p-3 dark:border-sky-300/15 md:p-4" style={{ overflow: "visible" }}>
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_auto_auto] xl:items-center">
          <div className="relative w-full min-w-0">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[var(--text-soft)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={FIELD_LIMITS.search}
              placeholder="Cari nama, toko, atau kategori..."
              className="h-12 rounded-lg border-sky-200/80 bg-white/80 pl-11 pr-4 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl dark:border-sky-300/15 dark:bg-slate-950/45"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-nowrap lg:items-center">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
              className="h-12 w-full rounded-lg text-xs font-bold sm:w-[180px] xl:shrink-0"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </Select>
            <Select
              value={tokoFilter}
              onChange={(e) => setTokoFilter(e.target.value)}
              className="h-12 w-full rounded-lg text-xs font-bold sm:w-[220px] xl:shrink-0"
            >
              <option value="ALL">Semua Toko</option>
              {tokoList.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <NgBarangForm triggerClassName="h-12 w-full justify-center px-5 sm:w-auto xl:min-w-[180px]" />
        </div>
      </Card>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/20 sm:flex-row sm:items-center sm:justify-between anim-rise">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{selectedIds.size} barang dipilih</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Batal</Button>
            <Button size="sm" variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} /> Hapus ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="liquid-panel relative z-0 overflow-hidden rounded-xl border-sky-200/70 p-0 dark:border-sky-300/15">
        <div className="flex flex-col gap-2 border-b border-sky-200/70 bg-sky-50/55 px-5 py-4 dark:border-sky-300/15 dark:bg-slate-950/25 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-foreground">Daftar Barang</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">Data barang dari toko sumber yang bisa dipakai untuk CO non-gudang.</p>
          </div>
          <Badge tone={selectedIds.size > 0 ? "amber" : "blue"}>{filtered.length} hasil</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table variant="plain" tableClassName="min-w-[980px]">
            <thead>
              <tr>
                <Th className="w-10 text-center">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} className="h-4 w-4 rounded border-border cursor-pointer" aria-label="Pilih semua barang di halaman ini" />
                </Th>
                <Th>Barang</Th>
                <Th>Toko Sumber</Th>
                <Th>Satuan</Th>
                <Th className="text-right">Harga Beli</Th>
                <Th className="text-right">Harga Jual</Th>
                <Th className="text-right">Margin</Th>
                <Th className="text-center">Status</Th>
                <Th className="text-center">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {pg.pageData.map((item) => {
                const m = marginPct(item.hargaBeli, item.hargaJual);
                return (
                  <tr key={item.id}>
                    <Td className="text-center">
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="h-4 w-4 rounded border-border cursor-pointer" aria-label={`Pilih ${item.nama}`} />
                    </Td>
                    <Td>
                      <div className="font-bold text-foreground text-xs sm:text-sm">{item.nama}</div>
                      {item.kategori && <div className="mt-0.5 text-[10px] text-slate-450">{item.kategori}</div>}
                    </Td>
                    <Td className="text-xs font-semibold text-slate-600 dark:text-slate-300">{item.namaToko}</Td>
                    <Td className="text-xs text-slate-500">{item.satuan ?? "-"}</Td>
                    <Td className="text-right font-mono text-xs">{formatRupiah(item.hargaBeli)}</Td>
                    <Td className="text-right font-mono text-xs font-bold text-foreground">{formatRupiah(item.hargaJual)}</Td>
                    <Td className="text-right">
                      <Badge tone={m >= 15 ? "green" : m > 0 ? "amber" : "red"} className="text-[10px]">{m.toFixed(1)}%</Badge>
                    </Td>
                    <Td className="text-center">
                      <Tooltip label="Ubah status" description="Klik untuk aktif / nonaktifkan barang">
                        <button
                          type="button"
                          onClick={() => handleToggleAktif(item)}
                          disabled={pending}
                          className="cursor-pointer disabled:opacity-50"
                          aria-label={`Ubah status ${item.nama}`}
                        >
                          <Badge tone={item.aktif ? "green" : "slate"} className="text-[10px]">{item.aktif ? "Aktif" : "Nonaktif"}</Badge>
                        </button>
                      </Tooltip>
                    </Td>
                    <Td className="text-center">
                      <Tooltip label="Ubah barang" description="Edit nama, toko, harga & margin">
                        <TableActionButton
                          type="button"
                          onClick={() => handleEdit(item)}
                          aria-label={`Ubah ${item.nama}`}
                        >
                          <Pencil size={15} />
                        </TableActionButton>
                      </Tooltip>
                    </Td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <Td colSpan={9} className="py-16 text-center text-slate-400 select-none">
                    <Boxes className="mx-auto mb-2 text-slate-200 dark:text-slate-700" size={32} />
                    <p className="text-sm font-semibold">Belum ada barang</p>
                    <p className="text-xs">Tambahkan barang dari toko sumber untuk mulai.</p>
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-sky-200/70 bg-white/55 px-4 py-3 backdrop-blur-xl dark:border-sky-300/15 dark:bg-slate-950/25">
            <Pagination page={pg.page} perPage={pg.perPage} total={pg.total} onPage={pg.setPage} />
          </div>
        )}
      </Card>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-fade-in" style={{ zIndex: 2147483001 }} onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="anim-rise w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-rose-500/10 text-rose-500">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Hapus {selectedIds.size} barang?</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">Barang yang sudah dipakai di invoice tidak akan dihapus. Tindakan tidak bisa dibatalkan.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="w-full sm:w-auto">Batal</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting} className="w-full sm:w-auto">
                {deleting ? "Menghapus…" : "Ya, Hapus"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
