"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Check, Download, Percent, Printer, TrendingUp, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Table, Td, Th } from "@/components/ui";
import { PageHeader, Panel, StatCard, StatGrid, TonePill } from "@/components/page";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";
import { usePagination, Pagination } from "@/components/Pagination";
import { exportNgExcel } from "@/lib/export/exportNgExcel";
import { cn, formatRupiah } from "@/lib/utils";
import type { NgAnalisa, NgKonsumenLaporanRow } from "@/lib/ngReports";

function splitPeriodLabel(label: string) {
  const match = label.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) return { title: label, range: "" };
  return { title: match[1], range: match[2] };
}

export function NgLaporanClient({
  analisa,
  perKonsumen,
  userName,
  periodeLabel,
  initialFrom,
  initialTo,
}: {
  analisa: NgAnalisa;
  perKonsumen: NgKonsumenLaporanRow[];
  userName?: string;
  periodeLabel: string;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filtering, startFilter] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [pendingRange, setPendingRange] = useState<ResolvedPeriodRange | null>(null);

  const { summary } = analisa;
  const periodDisplay = splitPeriodLabel(periodeLabel);

  const totals = useMemo(
    () =>
      perKonsumen.reduce(
        (acc, k) => {
          acc.omzet += k.totalOmzet;
          acc.dibayar += k.totalDibayar;
          acc.piutang += k.sisaPiutang;
          acc.profit += k.totalProfit;
          return acc;
        },
        { omzet: 0, dibayar: 0, piutang: 0, profit: 0 }
      ),
    [perKonsumen]
  );

  const pg = usePagination(perKonsumen, 12);


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

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const name = await exportNgExcel({ userName, period: periodeLabel, analisa, perKonsumen });
      toast.success(`Berhasil diunduh: ${name}`);
    } catch (error) {
      console.error("Export NG Laporan gagal:", error);
      toast.error("Gagal mengunduh Excel, coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={cn("space-y-5", filtering && "opacity-60 transition-opacity")}>
      <PageHeader
        eyebrow="Non-Gudang"
        title="Laporan & Unduhan"
        description="Rekap penjualan, keuntungan, dan piutang per konsumen. Excel berisi ringkasan, per toko, top produk, tren, dan per konsumen."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2.5">
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
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer size={14} /> Cetak PDF
            </Button>
            <Button size="sm" variant="success" onClick={handleExport} disabled={exporting}>
              <Download size={14} /> {exporting ? "Mengunduh..." : "Unduh Excel"}
            </Button>
          </div>
        }
      />

      <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted-2)]">
        <span className="font-semibold text-[var(--text-soft)]">{periodDisplay.title}</span>
        {periodDisplay.range && <span>· {periodDisplay.range}</span>}
        <span>· {summary.jumlahInvoice} invoice</span>
        {pendingRange && <span className="no-print font-semibold text-amber-600 dark:text-amber-300">· rentang custom belum diterapkan</span>}
      </p>

      <StatGrid cols={5}>
        <StatCard icon={TrendingUp} tone="sky" label="Total Omzet" value={formatRupiah(summary.totalOmzet)} hint={`${summary.jumlahInvoice} invoice`} />
        <StatCard icon={BarChart3} tone="emerald" label="Total Keuntungan" value={formatRupiah(summary.totalProfit)} hint="Omzet − modal pembelian" />
        <StatCard icon={Percent} tone="violet" label="Total Margin" value={`${summary.margin.toFixed(2)}%`} hint={`Markup ${summary.markup.toFixed(2)}%`} />
        <StatCard icon={Wallet} tone="amber" label="Sisa Piutang" value={formatRupiah(summary.totalPiutang)} hint="Belum tertagih" />
        <StatCard icon={UserRound} tone="slate" label="Konsumen" value={String(perKonsumen.length)} hint="Dengan transaksi" />
      </StatGrid>

      <Panel
        title="Rekap per Konsumen"
        description="Penjualan, pembayaran, piutang, dan keuntungan tiap konsumen"
        icon={UserRound}
        flush
        action={<span className="tnum text-xs font-semibold text-[var(--text-muted-2)]">{perKonsumen.length} konsumen</span>}
      >
        {perKonsumen.length === 0 ? (
          <div className="p-4"><EmptyBox text="Belum ada transaksi pada periode ini." /></div>
        ) : (
          <>
            {/* Di bawah xl: daftar ringkas */}
            <ul className="divide-y divide-border xl:hidden">
              {pg.pageData.map((k, index) => (
                <li key={k.konsumen} className="flex items-start gap-3 px-4 py-3">
                  <span className="tnum mt-0.5 w-6 shrink-0 text-center text-[11px] font-bold text-[var(--text-muted-2)]">
                    {(pg.page - 1) * pg.perPage + index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{k.konsumen}</p>
                      <TonePill value={k.margin} />
                    </div>
                    <p className="truncate text-[11px] text-[var(--text-muted-2)]">
                      {[k.namaGrup, `${k.jumlahInvoice} invoice`].filter(Boolean).join(" · ")}
                    </p>
                    <p className="tnum mt-1 text-xs text-[var(--text-soft)]">
                      <span className="font-semibold text-foreground">{formatRupiah(k.totalOmzet)}</span>
                      {" · untung "}
                      <span className="text-emerald-600 dark:text-emerald-400">{formatRupiah(k.totalProfit)}</span>
                      {k.sisaPiutang > 0 && <span className="text-amber-600 dark:text-amber-300"> · sisa {formatRupiah(k.sisaPiutang)}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden xl:block">
              <Table variant="plain" tableClassName="[&_td]:whitespace-nowrap [&_th]:px-4 [&_td]:px-4">
                <thead>
                  <tr>
                    <Th className="w-12 text-center">#</Th>
                    <Th>Konsumen</Th>
                    <Th className="text-right">Invoice</Th>
                    <Th className="text-right">Omzet</Th>
                    <Th className="text-right">Diterima</Th>
                    <Th className="text-right">Sisa Piutang</Th>
                    <Th className="text-right">Keuntungan</Th>
                    <Th className="text-right">Margin</Th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageData.map((k, index) => (
                    <tr key={k.konsumen}>
                      <Td className="tnum text-center text-xs text-[var(--text-muted-2)]">{(pg.page - 1) * pg.perPage + index + 1}</Td>
                      <Td className="max-w-[280px]">
                        <p className="truncate font-semibold text-foreground" title={k.konsumen}>{k.konsumen}</p>
                        {k.namaGrup && <p className="truncate text-[11px] text-[var(--text-muted-2)]">{k.namaGrup}</p>}
                      </Td>
                      <Td className="tnum text-right text-[var(--text-soft)]">{k.jumlahInvoice}</Td>
                      <Td className="tnum text-right font-semibold text-foreground">{formatRupiah(k.totalOmzet)}</Td>
                      <Td className="tnum text-right text-[var(--text-soft)]">{formatRupiah(k.totalDibayar)}</Td>
                      <Td className={cn("tnum text-right", k.sisaPiutang > 0 ? "text-amber-600 dark:text-amber-300" : "text-[var(--text-muted-2)] opacity-70")}>
                        {k.sisaPiutang > 0 ? formatRupiah(k.sisaPiutang) : "–"}
                      </Td>
                      <Td className="tnum text-right text-emerald-600 dark:text-emerald-400">{formatRupiah(k.totalProfit)}</Td>
                      <Td className="text-right"><TonePill value={k.margin} /></Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--surface-2)]/60">
                    <Td colSpan={3} className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-soft)]">
                      Total ({perKonsumen.length} konsumen)
                    </Td>
                    <Td className="tnum text-right font-bold text-foreground">{formatRupiah(totals.omzet)}</Td>
                    <Td className="tnum text-right font-bold text-foreground">{formatRupiah(totals.dibayar)}</Td>
                    <Td className="tnum text-right font-bold text-amber-600 dark:text-amber-300">{formatRupiah(totals.piutang)}</Td>
                    <Td className="tnum text-right font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(totals.profit)}</Td>
                    <Td />
                  </tr>
                </tfoot>
              </Table>
            </div>

            {perKonsumen.length > pg.perPage && (
              <div className="no-print border-t border-border px-4 py-3 sm:px-5">
                <Pagination page={pg.page} perPage={pg.perPage} total={pg.total} onPage={pg.setPage} />
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-xs font-medium text-[var(--text-muted-2)]">
      {text}
    </div>
  );
}
