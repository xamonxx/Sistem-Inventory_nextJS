import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getStokAkhirMap } from "@/lib/stock";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { Card, Badge, Button } from "@/components/ui";
import { DashboardCharts } from "@/components/DashboardCharts";
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Wallet,
  Building2,
  Users,
  ArrowRight,
  PlusCircle,
  FileText,
  RotateCcw,
  Plus,
  Info,
} from "lucide-react";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 86400000);

  // Parse filters
  const dateFrom = params.from ? new Date(params.from) : startOfDay(new Date(now.getTime() - 29 * 86400000));
  const dateTo = params.to ? new Date(params.to + "T23:59:59") : new Date();

  const isGudang = user.role === "ADMIN_GUDANG";

  // 1. KPI Today's Revenue
  const omsetTodayAgg = await prisma.transaction.aggregate({
    where: { tanggal: { gte: today, lt: tomorrow } },
    _sum: { grandTotal: true },
  });
  const omsetToday = Number(omsetTodayAgg._sum.grandTotal ?? 0);

  // 2. Monthly Revenue
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const omsetMonthAgg = await prisma.transaction.aggregate({
    where: { tanggal: { gte: firstDayOfMonth } },
    _sum: { grandTotal: true },
  });
  const omsetMonth = Number(omsetMonthAgg._sum.grandTotal ?? 0);

  // 3. Gross Margin (Only computed for ADMIN_GUDANG)
  let marginTotal = 0;
  if (isGudang) {
    const marginAgg = await prisma.transactionItem.findMany({
      where: { transaction: { tanggal: { gte: dateFrom, lte: dateTo } } },
      select: { qty: true, hargaSnapshot: true, hargaBeliSnapshot: true },
    });
    marginTotal = marginAgg.reduce(
      (acc, it) => acc + (Number(it.hargaSnapshot) - Number(it.hargaBeliSnapshot)) * it.qty,
      0
    );
  }

  // 4. Outstanding Receivables
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { status: { not: "LUNAS" } },
    select: { total: true, totalDibayar: true, tanggal: true, noInvoice: true, namaClient: true },
  });
  const outstandingReceivables = unpaidInvoices.reduce(
    (acc, inv) => acc + (Number(inv.total) - Number(inv.totalDibayar)),
    0
  );

  // 5. Active Projects & Active Clients Count
  const activeProjectsCount = await prisma.project.count();
  const activeClientsCount = await prisma.client.count();

  // 6. Revenue & Margin Trend for charts (Grouped by date)
  const chartDays = 30;
  const trendData: { tanggal: string; omset: number; margin: number }[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = startOfDay(new Date(now.getTime() - i * 86400000));
    const dEnd = new Date(d.getTime() + 86400000);

    const aggTrx = await prisma.transaction.aggregate({
      where: { tanggal: { gte: d, lt: dEnd } },
      _sum: { grandTotal: true },
    });

    let dayMargin = 0;
    if (isGudang) {
      const dayItems = await prisma.transactionItem.findMany({
        where: { transaction: { tanggal: { gte: d, lt: dEnd } } },
        select: { qty: true, hargaSnapshot: true, hargaBeliSnapshot: true },
      });
      dayMargin = dayItems.reduce((acc, it) => acc + (Number(it.hargaSnapshot) - Number(it.hargaBeliSnapshot)) * it.qty, 0);
    }

    trendData.push({
      tanggal: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(d),
      omset: Number(aggTrx._sum.grandTotal ?? 0),
      margin: dayMargin,
    });
  }

  // 7. Top Selling Items (by quantity sold in date range)
  const topSellingAgg = await prisma.transactionItem.groupBy({
    by: ["itemId", "namaSnapshot"],
    where: { transaction: { tanggal: { gte: dateFrom, lte: dateTo } } },
    _sum: { qty: true },
    orderBy: { _sum: { qty: "desc" } },
    take: 10,
  });
  const topItems = topSellingAgg.map((x) => ({
    nama: x.namaSnapshot,
    qty: x._sum.qty ?? 0,
  }));

  // 8. Sales by Project
  const projectSalesAgg = await prisma.transaction.groupBy({
    by: ["projectId"],
    where: {
      projectId: { not: null },
      tanggal: { gte: dateFrom, lte: dateTo },
    },
    _sum: { grandTotal: true },
    orderBy: { _sum: { grandTotal: "desc" } },
    take: 5,
  });
  const projectIds = projectSalesAgg.map((x) => x.projectId as number);
  const projectsMeta = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, nama: true },
  });
  const projectMap = new Map(projectsMeta.map((p) => [p.id, p.nama]));
  const projectSales = projectSalesAgg.map((x) => ({
    nama: projectMap.get(x.projectId as number) ?? "Proyek Tidak Dikenal",
    total: Number(x._sum.grandTotal ?? 0),
  }));

  // 9. Inventory Monitoring
  const items = await prisma.item.findMany({ where: { aktif: true } });
  const stokMap = await getStokAkhirMap();
  const allStok = items.map((it) => ({
    ...it,
    stok: stokMap.get(it.id) ?? it.stokAwal,
  }));

  const lowStockItems = allStok.filter((it) => it.stok >= 0 && it.stok < it.minStok).sort((a, b) => a.stok - b.stok).slice(0, 5);
  const negativeStockItems = allStok.filter((it) => it.stok < 0).sort((a, b) => a.stok - b.stok).slice(0, 5);

  // Fast & Slow moving products (Fast = high quantity sold, Slow = active but zero or low sold quantity)
  const productMovementMap = new Map<number, number>();
  const allSalesVolume = await prisma.transactionItem.groupBy({
    by: ["itemId"],
    _sum: { qty: true },
  });
  for (const row of allSalesVolume) {
    productMovementMap.set(row.itemId, row._sum.qty ?? 0);
  }

  const itemsWithSales = allStok.map((it) => ({
    ...it,
    volume: productMovementMap.get(it.id) ?? 0,
  }));

  const fastMoving = [...itemsWithSales].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const slowMoving = [...itemsWithSales].filter(it => it.volume === 0).slice(0, 5);

  // 10. Recent Activity list (Union actions from ledger and returns)
  const recentSales = await prisma.transaction.findMany({
    orderBy: { tanggal: "desc" },
    take: 5,
    include: { user: true },
  });
  const recentAdjustments = await prisma.stockLedger.findMany({
    where: { tipe: "KOREKSI" },
    orderBy: { tanggal: "desc" },
    take: 5,
    include: { item: true, user: true },
  });
  const recentReturns = await prisma.return.findMany({
    orderBy: { tanggal: "desc" },
    take: 5,
    include: { user: true },
  });

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <header className="anim-rise sticky top-0 z-20 mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line-strong bg-[var(--paper)]/90 py-4 backdrop-blur-md">
        <div>
          <p className="u-label flex items-center gap-2 text-[var(--primary)]">
            <span className="inline-block h-[2px] w-6 bg-[var(--primary)]" /> Ruang Kendali
          </p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-none">Executive Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Selamat datang kembali, <span className="font-semibold text-foreground">{user.nama}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2">
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ""}
              className="h-9 rounded-[4px] border border-line-strong bg-white px-2.5 text-sm tnum"
            />
            <span className="text-xs text-muted">s/d</span>
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? ""}
              className="h-9 rounded-[4px] border border-line-strong bg-white px-2.5 text-sm tnum"
            />
            <button className="h-9 rounded-[4px] bg-[var(--primary)] px-3.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[var(--primary-strong)]">
              Saring
            </button>
            {params.from || params.to ? (
              <Link href="/" className="flex h-9 items-center justify-center rounded-[4px] border border-line-strong bg-white px-3 text-xs font-medium">
                Reset
              </Link>
            ) : null}
          </form>
          <a
            href={`/api/export?type=stok`}
            className="hidden h-9 items-center justify-center gap-1.5 rounded-[4px] border border-line-strong bg-white px-3 text-xs font-semibold text-foreground hover:bg-[var(--paper-2)] sm:inline-flex"
          >
            Ekspor Stok
          </a>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Omset Hari Ini", value: formatRupiah(omsetToday), foot: "Harian", icon: TrendingUp, accent: "var(--success)", restricted: false },
          { label: "Omset Bulan Ini", value: formatRupiah(omsetMonth), foot: "Akumulasi bulanan", icon: Package, accent: "var(--steel)", restricted: false },
          { label: "Margin Kotor", value: formatRupiah(marginTotal), foot: "Berdasarkan filter", icon: TrendingUp, accent: "var(--success)", restricted: !isGudang },
          { label: "Piutang Berjalan", value: formatRupiah(outstandingReceivables), foot: `${unpaidInvoices.length} invoice aktif`, icon: Wallet, accent: "var(--warning)", restricted: false },
          { label: "Total Proyek", value: String(activeProjectsCount), foot: "Proyek konstruksi", icon: Building2, accent: "var(--steel)", restricted: false },
          { label: "Total Pelanggan", value: String(activeClientsCount), foot: "Client terdaftar", icon: Users, accent: "var(--primary)", restricted: false },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="tick-card anim-rise relative flex flex-col justify-between overflow-hidden rounded-[6px] border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: kpi.accent }} />
              <div className="flex items-start justify-between">
                <p className="u-label pr-2">{kpi.label}</p>
                <Icon size={15} style={{ color: kpi.accent }} strokeWidth={2.2} />
              </div>
              {kpi.restricted ? (
                <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-muted">
                  <Info size={13} /> 🔒 Restricted
                </p>
              ) : (
                <p className="mt-3 font-display text-[1.35rem] font-extrabold leading-none tracking-tight tnum">
                  {kpi.value}
                </p>
              )}
              <p className="mt-2 text-[0.7rem] text-muted">{kpi.foot}</p>
            </div>
          );
        })}
      </section>

      {/* Quick Actions Panel */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Aksi Cepat Operational</h2>
        <div className="flex flex-wrap gap-3">
          {user.role === "ADMIN_KASIR" && (
            <Link href="/kasir" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-white hover:opacity-90">
              <PlusCircle size={15} /> Transaksi POS Baru
            </Link>
          )}
          {user.role === "ADMIN_GUDANG" && (
            <Link href="/stok" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-medium text-white hover:bg-emerald-700">
              <Plus size={15} /> Input Barang Masuk
            </Link>
          )}
          <Link href="/retur" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-4 text-xs font-medium text-foreground hover:bg-slate-50">
            <RotateCcw size={15} /> Retur / Tukar Barang
          </Link>
          <Link href="/invoice" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-4 text-xs font-medium text-foreground hover:bg-slate-50">
            <FileText size={15} /> Tagihan & Receivables
          </Link>
        </div>
      </section>

      {/* Graphical Charts */}
      <section>
        <DashboardCharts
          revenueTrend={trendData}
          topItems={topItems}
          projectSales={projectSales}
        />
      </section>

      {/* Grid of Monitors */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Inventory Monitor */}
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-1.5">
              <Package size={18} className="text-primary" /> Pengawasan Stok Gudang
            </h2>
            <p className="text-xs text-muted">Deteksi kritis ketersediaan material plywood.</p>
          </div>

          <div className="space-y-3">
            {negativeStockItems.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-600 mb-1">⚠️ Stok Minus</p>
                <ul className="space-y-1">
                  {negativeStockItems.map((it) => (
                    <li key={it.id} className="flex justify-between items-center text-xs">
                      <span className="truncate pr-2">{it.nama}</span>
                      <Badge tone="red">{it.stok} unit</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-amber-600 mb-1">⚠️ Stok Menipis</p>
              {lowStockItems.length === 0 ? (
                <p className="text-xs text-muted">Semua stok di atas minimum aman.</p>
              ) : (
                <ul className="space-y-1">
                  {lowStockItems.map((it) => (
                    <li key={it.id} className="flex justify-between items-center text-xs">
                      <span className="truncate pr-2">{it.nama}</span>
                      <Badge tone="amber">tersisa {it.stok} (min {it.minStok})</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs font-bold text-slate-700 mb-1">🔥 Fast Moving Products</p>
              <ul className="space-y-1">
                {fastMoving.map((it) => (
                  <li key={it.id} className="flex justify-between items-center text-xs">
                    <span className="truncate pr-2">{it.nama}</span>
                    <span className="text-muted font-medium">{it.volume} terjual</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {/* Receivables Monitor */}
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-1.5">
              <Wallet size={18} className="text-amber-600" /> Pengawasan Piutang
            </h2>
            <p className="text-xs text-muted">Invoice jatuh tempo & outstanding balance.</p>
          </div>

          {unpaidInvoices.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">Seluruh invoice telah lunas dibayar. 👍</p>
          ) : (
            <div className="space-y-3">
              <ul className="divide-y divide-border">
                {unpaidInvoices.slice(0, 5).map((inv) => {
                  const sisa = Number(inv.total) - Number(inv.totalDibayar);
                  // Virtual due date: invoice date + 30 days
                  const dueDate = addDays(inv.tanggal, 30);
                  const isOverdue = dueDate.getTime() < now.getTime();

                  return (
                    <li key={inv.noInvoice} className="py-2 flex justify-between items-start text-xs">
                      <div>
                        <Link href={`/invoice`} className="font-mono text-primary font-medium hover:underline">
                          {inv.noInvoice}
                        </Link>
                        <p className="text-slate-500 font-medium text-[10px]">{inv.namaClient ?? "Retail"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatRupiah(sisa)}</p>
                        <p className={`text-[10px] ${isOverdue ? "text-red-500 font-bold" : "text-muted"}`}>
                          Tempo: {formatTanggal(dueDate.toISOString())}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Link href="/invoice" className="flex items-center justify-center gap-1 text-xs text-primary hover:underline pt-2">
                Lihat Semua Tagihan <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </Card>

        {/* Recent Activity Log */}
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-1.5">
              <Info size={18} className="text-indigo-600" /> Log Aktivitas Terkini
            </h2>
            <p className="text-xs text-muted">Riwayat transaksi operasional terbaru.</p>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {recentSales.map((sale) => (
              <div key={sale.id} className="text-xs flex flex-col border-b border-dashed border-border pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-800">Sales POS {sale.noTransaksi}</span>
                  <span className="text-indigo-600">{formatRupiah(sale.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted mt-0.5">
                  <span>Oleh: {sale.user?.nama ?? "-"}</span>
                  <span>{formatTanggal(sale.tanggal)}</span>
                </div>
              </div>
            ))}

            {recentReturns.map((ret) => (
              <div key={ret.id} className="text-xs flex flex-col border-b border-dashed border-border pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between font-medium">
                  <span className="text-amber-700">Retur {ret.noReturn}</span>
                  <span className={Number(ret.selisih) > 0 ? "text-red-600" : "text-emerald-600"}>
                    {formatRupiah(Number(ret.selisih))}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-muted mt-0.5">
                  <span>Alasan: {ret.alasan ?? "-"}</span>
                  <span>{formatTanggal(ret.tanggal)}</span>
                </div>
              </div>
            ))}

            {recentAdjustments.map((adj) => (
              <div key={adj.id} className="text-xs flex flex-col border-b border-dashed border-border pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-700">Koreksi: {adj.item.nama}</span>
                  <span className={adj.qty > 0 ? "text-emerald-600" : "text-red-600"}>
                    {adj.qty > 0 ? `+${adj.qty}` : adj.qty}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-muted mt-0.5">
                  <span>Oleh: {adj.user?.nama ?? "-"}</span>
                  <span>{formatTanggal(adj.tanggal)}</span>
                </div>
              </div>
            ))}

            {recentSales.length === 0 && recentAdjustments.length === 0 && recentReturns.length === 0 && (
              <p className="text-xs text-muted text-center py-4">Belum ada aktivitas tercatat.</p>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
