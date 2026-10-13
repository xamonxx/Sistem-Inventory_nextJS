"use client";

import { useState, useMemo, useEffect, useRef, useTransition } from "react";
import { deleteNgKonsumen } from "./actions";
import { NgKonsumenForm, type NgKonsumenRow } from "./NgKonsumenForm";
import { Button, Input, Table, Th, Td } from "@/components/ui";
import { FilterBar, IconAction, PageHeader, Panel, StatCard, StatGrid } from "@/components/page";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { usePagination, Pagination } from "@/components/Pagination";
import { Search, Users, UserCheck, Layers, FileText, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export type NgKonsumenData = {
  id: number;
  namaGrup: string | null;
  nama: string;
  alamat: string | null;
  namaWorkshop: string | null;
  invoiceCount: number;
};

export function NgKonsumenClient({ initialItems }: { initialItems: NgKonsumenData[] }) {
  const [items, setItems] = useState<NgKonsumenData[]>(initialItems);
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, startDeleteTransition] = useTransition();

  useEffect(() => setItems(initialItems), [initialItems]);

  const stats = useMemo(() => {
    const total = items.length;
    const withInvoice = items.filter((i) => i.invoiceCount > 0).length;
    const grupCount = new Set(items.map((i) => i.namaGrup).filter((g): g is string => !!g)).size;
    const totalInvoice = items.reduce((a, i) => a + i.invoiceCount, 0);
    return { total, withInvoice, grupCount, totalInvoice };
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (i) =>
        i.nama.toLowerCase().includes(term) ||
        (i.namaGrup ?? "").toLowerCase().includes(term) ||
        (i.alamat ?? "").toLowerCase().includes(term) ||
        (i.namaWorkshop ?? "").toLowerCase().includes(term)
    );
  }, [items, q]);

  const pg = usePagination(filtered, 10);

  const allOnPageSelected = pg.pageData.length > 0 && pg.pageData.every((i) => selectedIds.has(i.id));
  // Status "sebagian terpilih" hanya bisa diset lewat DOM.
  const selectAllRef = useRef<HTMLInputElement>(null);

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pg.pageData.forEach((i) => next.delete(i.id));
      else pg.pageData.forEach((i) => next.add(i.id));
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

  function handleEdit(item: NgKonsumenData) {
    const detail: NgKonsumenRow = {
      id: item.id,
      namaGrup: item.namaGrup,
      nama: item.nama,
      alamat: item.alamat,
      namaWorkshop: item.namaWorkshop,
    };
    window.dispatchEvent(new CustomEvent("edit-ng-konsumen", { detail }));
  }

  function handleDelete() {
    const ids = Array.from(selectedIds);
    startDeleteTransition(async () => {
      const res = await deleteNgKonsumen(ids);
      if (!res.ok) {
        toast.error(res.error ?? "Gagal menghapus konsumen.");
        return;
      }
      if (res.deletedIds?.length) {
        setItems((prev) => prev.filter((x) => !res.deletedIds!.includes(x.id)));
        toast.success(`${res.deletedIds.length} konsumen dihapus`);
      }
      if (res.blocked?.length) {
        toast.warning(`${res.blocked.length} konsumen tak bisa dihapus (sudah punya invoice).`);
      }
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    });
  }

  const somePageSelected = !allOnPageSelected && pg.pageData.some((i) => selectedIds.has(i.id));
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = somePageSelected;
  }, [somePageSelected]);

  const dash = <span className="text-[var(--text-muted-2)] opacity-60">–</span>;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Master data"
        title="Master Konsumen"
        description="Pelanggan trading non-gudang: grup/proyek, alamat, dan workshop untuk invoice."
        actions={<NgKonsumenForm triggerClassName="h-10 justify-center px-4" />}
      />

      <StatGrid>
        <StatCard icon={Users} tone="sky" label="Total Konsumen" value={String(stats.total)} hint="Terdaftar" />
        <StatCard icon={UserCheck} tone="emerald" label="Aktif Transaksi" value={String(stats.withInvoice)} hint="Punya invoice" />
        <StatCard icon={Layers} tone="violet" label="Jumlah Grup" value={String(stats.grupCount)} hint="Grup / proyek" />
        <StatCard icon={FileText} tone="slate" label="Total Invoice" value={String(stats.totalInvoice)} hint="Dari semua konsumen" />
      </StatGrid>

      <FilterBar>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted-2)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={FIELD_LIMITS.search}
            placeholder="Cari nama, grup, alamat, atau workshop…"
            aria-label="Cari konsumen"
            className="h-10 rounded-xl pl-9 text-[13px] font-medium"
          />
        </div>
      </FilterBar>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="anim-rise flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-400/25 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{selectedIds.size} konsumen dipilih</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Batal</Button>
            <Button size="sm" variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} /> Hapus ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      <Panel
        title="Daftar Konsumen"
        description="Konsumen yang sudah punya invoice tidak bisa dihapus (histori dilindungi)"
        icon={Users}
        flush
        action={<span className="tnum text-xs font-semibold text-[var(--text-muted-2)]">{filtered.length} hasil</span>}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Users size={26} className="text-[var(--text-muted-2)] opacity-70" />
            <p className="text-sm font-semibold text-foreground">Belum ada konsumen</p>
            <p className="text-xs text-[var(--text-muted-2)]">Tambahkan konsumen untuk mempercepat pembuatan invoice.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <Table variant="plain" tableClassName="[&_th]:px-4 [&_td]:px-4">
                <thead>
                  <tr>
                    <Th className="w-10 text-center">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                        className="h-4 w-4 cursor-pointer"
                        aria-label="Pilih semua konsumen di halaman ini"
                      />
                    </Th>
                    <Th>Konsumen</Th>
                    <Th>Alamat</Th>
                    <Th>Workshop</Th>
                    <Th className="w-24 text-center">Invoice</Th>
                    <Th className="w-14 text-center">Aksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageData.map((item) => {
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
                        <Td className="min-w-[180px]">
                          <p className="font-semibold text-foreground">{item.nama}</p>
                          {item.namaGrup && <p className="text-[11px] text-[var(--text-muted-2)]">{item.namaGrup}</p>}
                        </Td>
                        <Td className="max-w-[280px] truncate text-xs text-[var(--text-soft)]" title={item.alamat ?? ""}>
                          {item.alamat || dash}
                        </Td>
                        <Td className="whitespace-nowrap text-xs text-[var(--text-soft)]">{item.namaWorkshop || dash}</Td>
                        <Td className="text-center">
                          {item.invoiceCount > 0 ? (
                            <span className="tnum inline-flex min-w-7 justify-center rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                              {item.invoiceCount}
                            </span>
                          ) : (
                            <span className="tnum text-xs text-[var(--text-muted-2)] opacity-60">0</span>
                          )}
                        </Td>
                        <Td className="text-center">
                          <IconAction title="Ubah konsumen" onClick={() => handleEdit(item)}>
                            <Pencil size={15} />
                          </IconAction>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Di bawah lg: daftar ringkas */}
            <ul className="divide-y divide-border lg:hidden">
              {pg.pageData.map((item) => {
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
                        <span className="tnum shrink-0 text-[11px] font-semibold text-[var(--text-muted-2)]">{item.invoiceCount} invoice</span>
                      </div>
                      {item.namaGrup && <p className="truncate text-[11px] text-[var(--text-muted-2)]">{item.namaGrup}</p>}
                      <p className="mt-1 truncate text-xs text-[var(--text-soft)]">
                        {[item.alamat, item.namaWorkshop].filter(Boolean).join(" · ") || "Alamat & workshop belum diisi"}
                      </p>
                    </div>
                    <IconAction title="Ubah konsumen" onClick={() => handleEdit(item)}>
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
                <h3 className="text-base font-bold text-foreground">Hapus {selectedIds.size} konsumen?</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">Konsumen yang sudah punya invoice tidak akan dihapus. Tindakan tidak bisa dibatalkan.</p>
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
