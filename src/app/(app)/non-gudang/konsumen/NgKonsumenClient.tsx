"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { deleteNgKonsumen } from "./actions";
import { NgKonsumenForm, type NgKonsumenRow } from "./NgKonsumenForm";
import { Button, Card, Input, Table, TableActionButton, Th, Td, Badge } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { usePagination, Pagination } from "@/components/Pagination";
import { Tooltip } from "@/components/Tooltip";
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

  const kpi = [
    { icon: Users, label: "Total Konsumen", value: String(stats.total), detail: "terdaftar" },
    { icon: UserCheck, label: "Aktif Transaksi", value: String(stats.withInvoice), detail: "punya invoice" },
    { icon: Layers, label: "Jumlah Grup", value: String(stats.grupCount), detail: "grup / proyek" },
    { icon: FileText, label: "Total Invoice", value: String(stats.totalInvoice), detail: "dari semua konsumen" },
  ];

  return (
    <div className="space-y-5">
      <header className="liquid-panel liquid-panel-strong dashboard-hero relative z-20 rounded-xl border-sky-200/70 dark:border-sky-300/15" style={{ overflow: "visible" }}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_520px]">
          <div className="border-b border-sky-200/70 p-5 dark:border-sky-300/15 lg:border-b-0 lg:border-r">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-md border border-sky-200/80 bg-sky-50/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--primary-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200">
                Master Data
              </span>
              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-normal text-foreground dark:text-white md:text-5xl">
                Master Konsumen
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-200/90">
                Data pelanggan trading non-gudang: grup/proyek, alamat, dan workshop untuk dipakai saat membuat invoice.
              </p>
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
        <div className="grid gap-3 sm:grid-cols-[minmax(280px,1fr)_auto] sm:items-center">
          <div className="relative w-full min-w-0">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[var(--text-soft)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={FIELD_LIMITS.search}
              placeholder="Cari nama, grup, alamat, atau workshop..."
              className="h-12 rounded-lg border-sky-200/80 bg-white/80 pl-11 pr-4 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl dark:border-sky-300/15 dark:bg-slate-950/45"
            />
          </div>
          <NgKonsumenForm triggerClassName="h-12 w-full justify-center px-5 sm:w-auto sm:min-w-[190px]" />
        </div>
      </Card>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/20 sm:flex-row sm:items-center sm:justify-between anim-rise">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{selectedIds.size} konsumen dipilih</p>
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
            <p className="text-sm font-black text-foreground">Daftar Konsumen</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">Konsumen yang sudah punya invoice tidak bisa dihapus (histori dilindungi).</p>
          </div>
          <Badge tone={selectedIds.size > 0 ? "amber" : "blue"}>{filtered.length} hasil</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table variant="plain" tableClassName="min-w-[820px]">
            <thead>
              <tr>
                <Th className="w-10 text-center">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} className="h-4 w-4 rounded border-border cursor-pointer" aria-label="Pilih semua konsumen di halaman ini" />
                </Th>
                <Th>Konsumen</Th>
                <Th>Alamat</Th>
                <Th>Workshop</Th>
                <Th className="text-center">Invoice</Th>
                <Th className="text-center">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {pg.pageData.map((item) => (
                <tr key={item.id}>
                  <Td className="text-center">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="h-4 w-4 rounded border-border cursor-pointer" aria-label={`Pilih ${item.nama}`} />
                  </Td>
                  <Td>
                    <div className="font-bold text-foreground text-xs sm:text-sm">{item.nama}</div>
                    {item.namaGrup && <div className="mt-0.5 text-[10px] font-semibold text-[var(--primary-strong)]">{item.namaGrup}</div>}
                  </Td>
                  <Td className="max-w-[240px] truncate text-xs text-slate-500" title={item.alamat ?? ""}>{item.alamat ?? "-"}</Td>
                  <Td className="text-xs text-slate-500">{item.namaWorkshop ?? "-"}</Td>
                  <Td className="text-center">
                    <Badge tone={item.invoiceCount > 0 ? "green" : "slate"} className="text-[10px]">{item.invoiceCount}</Badge>
                  </Td>
                  <Td className="text-center">
                    <Tooltip label="Ubah konsumen" description="Edit nama, grup, alamat & workshop">
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
              ))}
              {filtered.length === 0 && (
                <tr>
                  <Td colSpan={6} className="py-16 text-center text-slate-400 select-none">
                    <Users className="mx-auto mb-2 text-slate-200 dark:text-slate-700" size={32} />
                    <p className="text-sm font-semibold">Belum ada konsumen</p>
                    <p className="text-xs">Tambahkan konsumen untuk mempercepat pembuatan invoice.</p>
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
