"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  Check,
  ChevronDown,
  FileText,
  Search,
  ShoppingBag,
  Store,
} from "lucide-react";
import { Button, Input, Table, Td, Th } from "@/components/ui";
import { PageHeader, Panel, StatCard, StatGrid } from "@/components/page";
import { Pagination, usePagination } from "@/components/Pagination";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";
import { cn, formatRupiah, formatTanggal } from "@/lib/utils";
import type { NgPembelian } from "@/lib/ngReports";

const INVOICE_PAGE_SIZE = 15;

function splitPeriodLabel(label: string) {
  const match = label.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) return { title: label, range: "" };
  return { title: match[1], range: match[2] };
}

export function NgPembelianClient({
  data,
  periodeLabel,
  initialFrom,
  initialTo,
}: {
  data: NgPembelian;
  periodeLabel: string;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filtering, startFilter] = useTransition();
  const [pendingRange, setPendingRange] = useState<ResolvedPeriodRange | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { summary, perToko, invoices } = data;
  const periodDisplay = splitPeriodLabel(periodeLabel);
  const strongestStore = perToko[0];
  const maxStorePurchase = Math.max(...perToko.map((row) => row.totalPembelian), 1);
  const averagePurchase = summary.jumlahInvoice > 0 ? summary.totalPembelian / summary.jumlahInvoice : 0;


  const filteredInvoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.noInvoice.toLowerCase().includes(q) ||
        inv.namaToko.toLowerCase().includes(q) ||
        inv.items.some((it) => it.nama.toLowerCase().includes(q))
    );
  }, [invoices, query]);
  const {
    page: invoicePage,
    setPage: setInvoicePage,
    pageData: pagedInvoices,
    perPage: invoicePerPage,
    total: invoiceTotal,
  } = usePagination(filteredInvoices, INVOICE_PAGE_SIZE);

  function applyRange(range: ResolvedPeriodRange) {
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    if (range.label) params.set("label", range.label);
    const qs = params.toString();
    setPendingRange(null);
    startFilter(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function handlePeriodChange(range: ResolvedPeriodRange) {
    if (range.preset === "custom") setPendingRange(range);
    else applyRange(range);
  }

  const canApply = !!pendingRange && !!(pendingRange.from || pendingRange.to);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={cn("space-y-5", filtering && "opacity-60 transition-opacity")}>
      <PageHeader
        eyebrow="Non-Gudang"
        title="Riwayat Pembelian Barang"
        description="Barang yang dibeli dari tiap toko sumber (harga beli/modal). Satu invoice = satu pembelian dari satu toko."
        actions={
          <>
            <PeriodFilter
              onChange={handlePeriodChange}
              defaultPreset={initialFrom || initialTo ? "custom" : "all"}
              defaultFrom={initialFrom}
              defaultTo={initialTo}
              align="right"
            />
            {pendingRange && (
              <Button size="sm" variant="outline" onClick={() => pendingRange && applyRange(pendingRange)} disabled={!canApply || filtering}>
                <Check size={14} /> Terapkan
              </Button>
            )}
          </>
        }
      />

      <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted-2)]">
        <span className="font-semibold text-[var(--text-soft)]">{periodDisplay.title}</span>
        {periodDisplay.range && <span>· {periodDisplay.range}</span>}
        <span>· {summary.jumlahInvoice} pembelian · {summary.totalQty} unit</span>
        {pendingRange && <span className="font-semibold text-amber-600 dark:text-amber-300">· rentang custom belum diterapkan</span>}
      </p>

      <StatGrid>
        <StatCard icon={ShoppingBag} tone="sky" label="Total Pembelian" value={formatRupiah(summary.totalPembelian)} hint="Modal beli seluruh toko" />
        <StatCard icon={FileText} tone="slate" label="Jumlah Pembelian" value={String(summary.jumlahInvoice)} hint={`Rata-rata ${formatRupiah(averagePurchase)}`} />
        <StatCard icon={Store} tone="violet" label="Toko Sumber" value={String(summary.jumlahToko)} hint={strongestStore ? `Terbesar: ${strongestStore.namaToko}` : "Belum ada toko"} />
        <StatCard icon={Boxes} tone="amber" label="Total Jumlah" value={`${summary.totalQty} unit`} hint="Barang dibeli" />
      </StatGrid>

      <Panel title="Pembelian per Toko Sumber" description="Diurutkan dari nilai pembelian terbesar" icon={Store} flush>
        {perToko.length === 0 ? (
          <div className="p-4"><EmptyBox text="Belum ada pembelian pada periode ini." /></div>
        ) : (
          <ul className="divide-y divide-border">
            {perToko.map((row, index) => {
              const share = summary.totalPembelian > 0 ? (row.totalPembelian / summary.totalPembelian) * 100 : 0;
              return (
                <li key={row.namaToko} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5 lg:grid-cols-[auto_minmax(0,1.6fr)_90px_90px_80px_150px]">
                  <Rank n={index + 1} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{row.namaToko}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400"
                        style={{ width: `${Math.max(4, (row.totalPembelian / maxStorePurchase) * 100)}%` }}
                      />
                    </div>
                    <p className="tnum mt-1 text-[11px] text-[var(--text-muted-2)] lg:hidden">
                      {row.jumlahInvoice} pembelian · {row.totalQty} unit · {share.toFixed(1)}%
                    </p>
                  </div>
                  <span className="tnum hidden text-right text-xs text-[var(--text-soft)] lg:block">{row.jumlahInvoice} beli</span>
                  <span className="tnum hidden text-right text-xs text-[var(--text-soft)] lg:block">{row.totalQty} unit</span>
                  <span className="tnum hidden text-right text-xs font-semibold text-[var(--text-soft)] lg:block">{share.toFixed(1)}%</span>
                  <span className="tnum text-right text-sm font-semibold text-foreground">{formatRupiah(row.totalPembelian)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="Riwayat Pembelian per Invoice"
        description="Klik baris untuk melihat rincian barang yang dibeli"
        icon={FileText}
        flush
        action={
          <span className="tnum text-xs font-semibold text-[var(--text-muted-2)]">
            {filteredInvoices.length} invoice · {summary.jumlahToko} toko
          </span>
        }
      >
        <div className="border-b border-border p-3 sm:p-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted-2)]" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setInvoicePage(1);
              }}
              placeholder="Cari no. invoice, toko, atau nama barang…"
              aria-label="Cari pembelian"
              className="h-10 rounded-xl pl-9 text-[13px] font-medium"
            />
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="p-4"><EmptyBox text={query ? "Tidak ada pembelian yang cocok." : "Belum ada pembelian pada periode ini."} /></div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {pagedInvoices.map((inv) => {
                const isOpen = expanded.has(inv.id);
                return (
                  <li key={inv.id}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(inv.id)}
                      aria-expanded={isOpen}
                      className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]/40 sm:px-5 lg:grid-cols-[auto_minmax(0,1fr)_120px_100px_150px]"
                    >
                      <ChevronDown size={16} className={cn("shrink-0 text-[var(--text-muted-2)] transition-transform", isOpen && "rotate-180")} />
                      <div className="min-w-0">
                        <p className="tnum text-sm font-semibold text-foreground">{inv.noInvoice}</p>
                        <p className="truncate text-[11px] text-[var(--text-muted-2)]">
                          {inv.namaToko}
                          <span className="lg:hidden"> · {formatTanggal(inv.tanggal)} · {inv.jumlahItem} barang</span>
                        </p>
                      </div>
                      <span className="hidden text-right text-xs text-[var(--text-muted-2)] lg:block">{formatTanggal(inv.tanggal)}</span>
                      <span className="tnum hidden text-right text-xs text-[var(--text-soft)] lg:block">{inv.jumlahItem} barang</span>
                      <span className="tnum whitespace-nowrap text-right text-sm font-semibold text-foreground">{formatRupiah(inv.totalPembelian)}</span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border bg-[var(--surface-2)]/40 px-3 py-3 sm:px-5">
                        <div className="overflow-x-auto rounded-xl border border-border bg-card">
                          <Table variant="plain" tableClassName="min-w-[520px] [&_td]:whitespace-nowrap [&_th]:px-4 [&_td]:px-4 [&_td]:h-11">
                            <thead>
                              <tr>
                                <Th>Nama Barang</Th>
                                <Th className="text-right">Qty</Th>
                                <Th className="text-right">Harga Beli</Th>
                                <Th className="text-right">Subtotal</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {inv.items.map((it, i) => (
                                <tr key={i}>
                                  <Td className="font-semibold text-foreground">{it.nama}</Td>
                                  <Td className="tnum text-right text-[var(--text-soft)]">{it.qty}</Td>
                                  <Td className="tnum text-right text-[var(--text-soft)]">{formatRupiah(it.hargaBeli)}</Td>
                                  <Td className="tnum text-right font-semibold text-foreground">{formatRupiah(it.subtotal)}</Td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <Td className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted-2)]" colSpan={3}>Total pembelian</Td>
                                <Td className="tnum text-right font-bold text-foreground">{formatRupiah(inv.totalPembelian)}</Td>
                              </tr>
                            </tfoot>
                          </Table>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border px-4 py-3 sm:px-5">
              <Pagination page={invoicePage} perPage={invoicePerPage} total={invoiceTotal} onPage={setInvoicePage} />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "tnum inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
        n <= 3 ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "text-[var(--text-muted-2)]"
      )}
    >
      {n}
    </span>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-xs font-medium text-[var(--text-muted-2)]">
      {text}
    </div>
  );
}
