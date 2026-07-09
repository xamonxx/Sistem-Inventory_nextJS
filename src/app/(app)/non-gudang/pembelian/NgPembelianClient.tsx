"use client";

import { useMemo, useState, useTransition, type ElementType, type ReactNode } from "react";
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
import { Badge, Button, Table, Td, Th } from "@/components/ui";
import { Pagination, usePagination } from "@/components/Pagination";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";
import { cn, formatRupiah, formatTanggal } from "@/lib/utils";
import type { NgPembelian } from "@/lib/ngReports";

const BAR_COLORS = ["#0284c7", "#10b981", "#f97316", "#6366f1", "#ef4444", "#eab308", "#14b8a6", "#ec4899"];
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

  const stats = [
    { icon: ShoppingBag, tone: "blue" as const, label: "Total Pembelian", value: formatRupiah(summary.totalPembelian), hint: "Modal beli seluruh toko" },
    { icon: FileText, tone: "slate" as const, label: "Jumlah Pembelian", value: String(summary.jumlahInvoice), hint: `Rata-rata ${formatRupiah(averagePurchase)}` },
    { icon: Store, tone: "emerald" as const, label: "Toko Sumber", value: String(summary.jumlahToko), hint: strongestStore ? `Terbesar: ${strongestStore.namaToko}` : "Belum ada toko" },
    { icon: Boxes, tone: "amber" as const, label: "Total Qty", value: `${summary.totalQty} unit`, hint: "Barang dibeli" },
  ];

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
      <header className="liquid-panel liquid-panel-strong dashboard-hero relative z-20 rounded-xl" style={{ overflow: "visible" }}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="border-b border-slate-200/80 p-5 dark:border-slate-800/80 lg:border-b-0 lg:border-r md:p-6">
            <p className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--primary-strong)] dark:border-sky-900/60 dark:bg-sky-950/35">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              Riwayat Non-Gudang
            </p>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-normal text-foreground md:text-5xl">
              Riwayat Pembelian Barang
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300 md:text-base">
              Rekap barang yang dibeli dari tiap toko sumber (harga beli/modal). Satu invoice = satu pembelian dari satu toko.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <HeroMini label="Total Modal" value={formatRupiah(summary.totalPembelian)} />
              <HeroMini label="Toko Terbesar" value={strongestStore?.namaToko ?? "-"} />
              <HeroMini label="Rata-rata" value={formatRupiah(averagePurchase)} />
            </div>
          </div>

          <div className="relative z-40 flex flex-col justify-between gap-4 bg-slate-50/75 p-5 dark:bg-slate-950/25 md:p-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Periode aktif</p>
              <p className="mt-2 truncate text-xl font-black tracking-tight text-foreground sm:text-2xl" title={periodeLabel}>
                {periodDisplay.title}
              </p>
              {periodDisplay.range && (
                <p className="mt-1 truncate text-sm font-bold text-slate-600 dark:text-slate-300" title={periodDisplay.range}>
                  {periodDisplay.range}
                </p>
              )}
              <p className="mt-1 text-xs font-semibold text-slate-500">{summary.jumlahInvoice} pembelian dianalisa | {summary.totalQty} unit</p>
            </div>
            <div className="flex flex-col gap-2">
              <PeriodFilter
                onChange={handlePeriodChange}
                defaultPreset={initialFrom || initialTo ? "custom" : "all"}
                defaultFrom={initialFrom}
                defaultTo={initialTo}
              />
              {pendingRange && (
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Rentang custom belum diterapkan - klik <span className="font-bold">Terapkan</span>.
                </p>
              )}
              {pendingRange && (
                <Button
                  variant="outline"
                  onClick={() => pendingRange && applyRange(pendingRange)}
                  disabled={!canApply || filtering}
                  className="h-12 font-black"
                >
                  <Check size={15} />
                  Terapkan
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-0 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <Panel
        title="Pembelian per Toko Sumber"
        icon={<Store size={16} />}
        desc="Diurutkan dari nilai pembelian terbesar agar toko dominan cepat terlihat."
      >
        {perToko.length === 0 ? (
          <EmptyBox text="Belum ada pembelian pada periode ini." />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {perToko.map((row, index) => (
                <article key={row.namaToko} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-400">#{index + 1}</p>
                      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-black text-foreground">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }} />
                        <span className="truncate">{row.namaToko}</span>
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-right text-sm font-black text-[var(--primary-strong)]">{formatRupiah(row.totalPembelian)}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <span
                      className="block h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${Math.max(6, (row.totalPembelian / maxStorePurchase) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{row.jumlahInvoice} pembelian | {row.totalQty} unit</p>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table variant="plain" className="rounded-lg border border-slate-200 dark:border-slate-800" tableClassName="min-w-[820px]">
                <thead>
                  <tr>
                    <Th className="w-16">Rank</Th>
                    <Th>Toko Sumber</Th>
                    <Th className="text-right">Pembelian</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Kontribusi</Th>
                    <Th className="text-right">Total Pembelian</Th>
                  </tr>
                </thead>
                <tbody>
                  {perToko.map((row, index) => (
                    <tr key={row.namaToko}>
                      <Td className="text-xs font-black text-slate-400">#{index + 1}</Td>
                      <Td className="min-w-[260px] text-xs font-semibold">
                        <div className="flex items-center gap-2 text-foreground">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }} />
                          <span>{row.namaToko}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <span
                            className="block h-full rounded-full bg-[var(--primary)]"
                            style={{ width: `${Math.max(4, (row.totalPembelian / maxStorePurchase) * 100)}%` }}
                          />
                        </div>
                      </Td>
                      <Td className="text-right text-xs">{row.jumlahInvoice}</Td>
                      <Td className="text-right text-xs">{row.totalQty}</Td>
                      <Td className="text-right text-xs font-bold text-slate-600 dark:text-slate-300">
                        {summary.totalPembelian > 0 ? `${((row.totalPembelian / summary.totalPembelian) * 100).toFixed(1)}%` : "0%"}
                      </Td>
                      <Td className="whitespace-nowrap text-right text-xs font-bold text-[var(--primary-strong)]">{formatRupiah(row.totalPembelian)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Riwayat Pembelian per Invoice"
        icon={<FileText size={16} />}
        desc="Klik baris untuk melihat rincian barang yang dibeli."
      >
        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--text-soft)]" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setInvoicePage(1);
              }}
              placeholder="Cari no. invoice, toko, atau nama barang..."
              className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
            <span className="rounded-md bg-slate-100 px-2.5 py-2 dark:bg-slate-800">{filteredInvoices.length} invoice tampil</span>
            <span className="rounded-md bg-sky-50 px-2.5 py-2 text-[var(--primary-strong)] dark:bg-sky-950/35">{summary.jumlahToko} toko sumber</span>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <EmptyBox text={query ? "Tidak ada pembelian yang cocok." : "Belum ada pembelian pada periode ini."} />
        ) : (
          <div className="space-y-2.5">
            {pagedInvoices.map((inv) => {
              const isOpen = expanded.has(inv.id);
              return (
                <article key={inv.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => toggleExpand(inv.id)}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left transition-[background-color,box-shadow,transform] hover:bg-sky-50/70 active:bg-sky-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/15 dark:hover:bg-sky-400/8 dark:active:bg-sky-950/20 lg:grid-cols-[auto_minmax(190px,1fr)_180px_120px_160px]"
                  >
                    <ChevronDown size={16} className={cn("shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-xs font-bold text-foreground">{inv.noInvoice}</span>
                        <Badge tone="blue" className="text-[9px]">{inv.namaToko}</Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500 lg:hidden">
                        {formatTanggal(inv.tanggal)} | {inv.jumlahItem} barang | {inv.totalQty} unit
                      </p>
                    </div>
                    <span className="hidden text-right text-xs font-bold text-slate-500 lg:block">{formatTanggal(inv.tanggal)}</span>
                    <span className="hidden text-right text-xs font-bold text-slate-500 lg:block">{inv.jumlahItem} barang</span>
                    <span className="col-start-2 whitespace-nowrap text-left text-sm font-black text-[var(--primary-strong)] lg:col-start-auto lg:text-right">
                      {formatRupiah(inv.totalPembelian)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/25">
                      <div className="overflow-x-auto">
                        <Table variant="plain" className="rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" tableClassName="min-w-[560px]">
                          <thead>
                            <tr>
                              <Th className="text-[10px]">Nama Barang</Th>
                              <Th className="text-right text-[10px]">Qty</Th>
                              <Th className="text-right text-[10px]">Harga Beli</Th>
                              <Th className="text-right text-[10px]">Subtotal</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {inv.items.map((it, i) => (
                              <tr key={i}>
                                <Td className="text-xs font-semibold text-foreground">{it.nama}</Td>
                                <Td className="text-right font-mono text-xs">{it.qty}</Td>
                                <Td className="whitespace-nowrap text-right font-mono text-xs text-slate-600 dark:text-slate-300">{formatRupiah(it.hargaBeli)}</Td>
                                <Td className="whitespace-nowrap text-right font-mono text-xs font-bold">{formatRupiah(it.subtotal)}</Td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200 dark:border-slate-800">
                              <Td className="text-[10px] font-black uppercase tracking-wide text-slate-500" colSpan={3}>Total Pembelian</Td>
                              <Td className="whitespace-nowrap text-right font-mono text-xs font-black text-[var(--primary-strong)]">{formatRupiah(inv.totalPembelian)}</Td>
                            </tr>
                          </tfoot>
                        </Table>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
            <Pagination
              page={invoicePage}
              perPage={invoicePerPage}
              total={invoiceTotal}
              onPage={setInvoicePage}
              className="pt-4"
            />
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, desc, icon, children }: { title: string; desc?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-300/80 bg-white shadow-[0_18px_55px_-46px_rgba(15,23,42,0.6)] dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/25 sm:px-5">
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-[var(--primary-strong)] ring-1 ring-sky-100 dark:bg-sky-950/30 dark:ring-sky-900/50">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-black leading-tight text-foreground">{title}</h2>
          {desc && <p className="mt-0.5 text-xs font-medium text-slate-500">{desc}</p>}
        </div>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function HeroMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white/70 px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/45">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-foreground" title={value}>{value}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "blue" | "amber" | "slate";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900/50",
    blue: "bg-sky-50 text-[var(--primary-strong)] ring-sky-100 dark:bg-sky-950/30 dark:ring-sky-900/50",
    amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900/50",
    slate: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  };
  return (
    <article className="rounded-xl border border-slate-300/80 bg-white p-4 shadow-[0_18px_55px_-48px_rgba(15,23,42,0.65)] dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-3 truncate text-xl font-black tracking-tight text-foreground">{value}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-500" title={hint}>{hint}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1", tones[tone])}>
          <Icon size={18} />
        </div>
      </div>
    </article>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 text-center text-sm font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-950/20">
      {text}
    </div>
  );
}
