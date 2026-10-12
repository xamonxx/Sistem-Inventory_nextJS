"use client";

import { useState, useMemo, useEffect, useRef, useTransition } from "react";
import { toggleNgProdukAktif, deleteNgProduk } from "./actions";
import { NgBarangForm, type NgProdukRow } from "./NgBarangForm";
import { Button, Input, Select, Table, Th, Td } from "@/components/ui";
import { FilterBar, IconAction, PageHeader, Panel, StatCard, StatGrid, StatusDot, TonePill } from "@/components/page";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { formatRupiah } from "@/lib/utils";
import { usePagination, Pagination } from "@/components/Pagination";
import { Search, Boxes, Store, Percent, Pencil, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
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
  // Status "sebagian terpilih" hanya bisa diset lewat DOM.
  const selectAllRef = useRef<HTMLInputElement>(null);

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

  const somePageSelected = !allOnPageSelected && pg.pageData.some((i) => selectedIds.has(i.id));
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = somePageSelected;
  }, [somePageSelected]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Master data"
        title="Master Barang Non-Gudang"
        description="Barang trading dari toko sumber: harga modal, harga jual, dan margin."
        actions={<NgBarangForm triggerClassName="h-10 justify-center px-4" />}
      />

      <StatGrid>
        <StatCard icon={Boxes} tone="sky" label="Total Barang" value={String(stats.total)} hint="Kode barang non-gudang" />
        <StatCard icon={Store} tone="violet" label="Toko Sumber" value={String(stats.tokoCount)} hint="Supplier aktif" />
        <StatCard icon={CheckCircle2} tone="emerald" label="Barang Aktif" value={String(stats.active)} hint="Siap dijual" />
        <StatCard icon={Percent} tone="amber" label="Rata-rata Margin" value={`${stats.avgMargin.toFixed(1)}%`} hint="Gross margin" />
      </StatGrid>

      <FilterBar>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_220px]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted-2)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={FIELD_LIMITS.search}
              placeholder="Cari nama, toko, atau kategori…"
              aria-label="Cari barang"
              className="h-10 rounded-xl pl-9 text-[13px] font-medium"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            className="h-10 w-full rounded-xl px-3.5 text-[13px] font-medium"
            aria-label="Filter status"
          >
            <option value="ALL">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </Select>
          <Select
            value={tokoFilter}
            onChange={(e) => setTokoFilter(e.target.value)}
            className="h-10 w-full rounded-xl px-3.5 text-[13px] font-medium"
            aria-label="Filter toko sumber"
          >
            <option value="ALL">Semua toko</option>
            {tokoList.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      </FilterBar>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="anim-rise flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-400/25 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{selectedIds.size} barang dipilih</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Batal</Button>
            <Button size="sm" variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} /> Hapus ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      <Panel
        title="Daftar Barang"
        description="Barang dari toko sumber untuk invoice non-gudang"
        icon={Boxes}
        flush
        action={<span className="tnum text-xs font-semibold text-[var(--text-muted-2)]">{filtered.length} hasil</span>}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Boxes size={26} className="text-[var(--text-muted-2)] opacity-70" />
            <p className="text-sm font-semibold text-foreground">Belum ada barang</p>
            <p className="text-xs text-[var(--text-muted-2)]">Tambahkan barang dari toko sumber atau ubah filter.</p>
          </div>
        ) : (
          <>
            <div className="hidden xl:block">
              <Table variant="plain" tableClassName="[&_td]:whitespace-nowrap [&_th]:px-4 [&_td]:px-4">
                <thead>
                  <tr>
                    <Th className="w-10 text-center">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                        className="h-4 w-4 cursor-pointer"
                        aria-label="Pilih semua barang di halaman ini"
                      />
                    </Th>
                    <Th>Barang</Th>
                    <Th>Toko Sumber</Th>
                    <Th>Satuan</Th>
                    <Th className="text-right">Harga Beli</Th>
                    <Th className="text-right">Harga Jual</Th>
                    <Th className="text-right">Margin</Th>
                    <Th>Status</Th>
                    <Th className="w-14 text-center">Aksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageData.map((item) => {
                    const m = marginPct(item.hargaBeli, item.hargaJual);
                    const selected = selectedIds.has(item.id);
                    return (
                      <tr key={item.id} className={selected ? "bg-rose-50/70 dark:bg-rose-500/[0.07]" : undefined}>
                        <Td className="text-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(item.id)}
                            className="h-4 w-4 cursor-pointer"
                            aria-label={`Pilih ${item.nama}`}
                          />
                        </Td>
                        <Td className="max-w-[280px]">
                          <p className="truncate font-semibold text-foreground" title={item.nama}>{item.nama}</p>
                          <p className="text-[11px] text-[var(--text-muted-2)]">{item.kategori ?? "Tanpa kategori"}</p>
                        </Td>
                        <Td className="text-xs text-[var(--text-soft)]">{item.namaToko}</Td>
                        <Td className="text-xs text-[var(--text-muted-2)]">{item.satuan ?? "–"}</Td>
                        <Td className="tnum text-right text-xs text-[var(--text-soft)]">{formatRupiah(item.hargaBeli)}</Td>
                        <Td className="tnum text-right font-semibold text-foreground">{formatRupiah(item.hargaJual)}</Td>
                        <Td className="text-right"><TonePill value={m} /></Td>
                        <Td>
                          <button
                            type="button"
                            onClick={() => handleToggleAktif(item)}
                            disabled={pending}
                            title="Klik untuk mengaktifkan / menonaktifkan"
                            className="cursor-pointer rounded-md px-1 py-0.5 transition hover:bg-[var(--surface-2)] disabled:opacity-50"
                          >
                            <StatusDot tone={item.aktif ? "emerald" : "slate"}>{item.aktif ? "Aktif" : "Nonaktif"}</StatusDot>
                          </button>
                        </Td>
                        <Td className="text-center">
                          <IconAction title="Ubah barang" onClick={() => handleEdit(item)}>
                            <Pencil size={15} />
                          </IconAction>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Di bawah xl: daftar ringkas */}
            <ul className="divide-y divide-border xl:hidden">
              {pg.pageData.map((item) => {
                const m = marginPct(item.hargaBeli, item.hargaJual);
                const selected = selectedIds.has(item.id);
                return (
                  <li key={item.id} className={selected ? "flex items-start gap-3 bg-rose-50/70 px-4 py-3 dark:bg-rose-500/[0.07]" : "flex items-start gap-3 px-4 py-3"}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                      aria-label={`Pilih ${item.nama}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{item.nama}</p>
                        <TonePill value={m} />
                      </div>
                      <p className="truncate text-[11px] text-[var(--text-muted-2)]">
                        {[item.kategori, item.namaToko, item.satuan].filter(Boolean).join(" · ")}
                      </p>
                      <p className="tnum mt-1 text-xs text-[var(--text-soft)]">
                        Beli {formatRupiah(item.hargaBeli)} · <span className="font-semibold text-foreground">Jual {formatRupiah(item.hargaJual)}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleToggleAktif(item)}
                        disabled={pending}
                        className="mt-1.5 cursor-pointer disabled:opacity-50"
                        title="Klik untuk mengaktifkan / menonaktifkan"
                      >
                        <StatusDot tone={item.aktif ? "emerald" : "slate"}>{item.aktif ? "Aktif" : "Nonaktif"}</StatusDot>
                      </button>
                    </div>
                    <IconAction title="Ubah barang" onClick={() => handleEdit(item)}>
                      <Pencil size={15} />
                    </IconAction>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-border px-4 py-3 sm:px-5">
              <Pagination page={pg.page} perPage={pg.perPage} total={pg.total} onPage={pg.setPage} />
            </div>
          </>
        )}
      </Panel>

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
