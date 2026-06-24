import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getStokAkhirMap } from "@/lib/stock";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { Card, Badge } from "@/components/ui";
import { DashboardCharts } from "@/components/DashboardCharts";
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Wallet,
  Building2,
  Users,
  PlusCircle,
  FileText,
  RotateCcw,
  Plus,
  Info,
  Clock,
  Layers,
  CircleAlert,
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
  searchParams: Promise<{ from?: string; to?: string; mode?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 86400000);

  // Parse filters & mode
  const dateFrom = params.from ? new Date(params.from) : startOfDay(new Date(now.getTime() - 29 * 86400000));
  const dateTo = params.to ? new Date(params.to + "T23:59:59") : new Date();
  const isOwnerMode = params.mode === "owner";

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

  // 5. Active Projects & Clients
  const activeProjectsCount = await prisma.project.count();
  const activeClientsCount = await prisma.client.count();

  // 6. Revenue & Margin Trend
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

  // 7. Top Selling Items
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

  // 9. Inventory calculations
  const items = await prisma.item.findMany({ where: { aktif: true } });
  const stokMap = await getStokAkhirMap();
  const allStok = items.map((it) => ({
    ...it,
    stok: stokMap.get(it.id) ?? it.stokAwal,
  }));

  const lowStockItems = allStok.filter((it) => it.stok >= 0 && it.stok < it.minStok).sort((a, b) => a.stok - b.stok);
  const negativeStockItems = allStok.filter((it) => it.stok < 0).sort((a, b) => a.stok - b.stok);

  const totalAssetValue = allStok.reduce((acc, it) => acc + Number(it.hargaBeli) * it.stok, 0);

  // Operational metrics
  const transactionsTodayCount = await prisma.transaction.count({
    where: { tanggal: { gte: today, lt: tomorrow } }
  });
  const logsTodayCount = await prisma.activityLog.count({
    where: { createdAt: { gte: today, lt: tomorrow } }
  });

  // Recent timeline events (Logs)
  const recentLogs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { user: true }
  });

  // Build KPIs based on Selected Mode
  const kpiCards = isOwnerMode
    ? [
        { label: "Omset Bulan Ini", value: formatRupiah(omsetMonth), desc: "Penjualan kotor bulan berjalan", icon: TrendingUp, tone: "success" },
        { label: "Margin Kotor", value: isGudang ? formatRupiah(marginTotal) : "🔒 Terbatas", desc: "Berdasarkan filter tanggal", icon: Layers, tone: "blue" },
        { label: "Outstanding Piutang", value: formatRupiah(outstandingReceivables), desc: `${unpaidInvoices.length} invoice aktif`, icon: Wallet, tone: "amber" },
        { label: "Nilai Aset Gudang", value: isGudang ? formatRupiah(totalAssetValue) : "🔒 Terbatas", desc: "Total nilai modal persediaan", icon: Package, tone: "slate" },
        { label: "Proyek Konstruksi", value: String(activeProjectsCount), desc: "Proyek aktif terdaftar", icon: Building2, tone: "blue" },
        { label: "Pelanggan Terdaftar", value: String(activeClientsCount), desc: "Customer di dalam CRM", icon: Users, tone: "primary" },
      ]
    : [
        { label: "Omset Hari Ini", value: formatRupiah(omsetToday), desc: "Total penjualan hari ini", icon: TrendingUp, tone: "success" },
        { label: "Transaksi Hari Ini", value: `${transactionsTodayCount} trx`, desc: "Invoice kasir terbuat", icon: FileText, tone: "blue" },
        { label: "Stok Kritis (Safety)", value: `${lowStockItems.length} barang`, desc: "Stok di bawah batas minimum", icon: AlertTriangle, tone: "amber" },
        { label: "Stok Minus Gudang", value: `${negativeStockItems.length} barang`, desc: "Koreksi fisik dibutuhkan", icon: CircleAlert, tone: "red" },
        { label: "Operator Aktif", value: `${await prisma.user.count({ where: { aktif: true } })} user`, desc: "Total staf terdaftar", icon: Users, tone: "primary" },
        { label: "Aktivitas Hari Ini", value: `${logsTodayCount} logs`, desc: "Audit trail log operasional", icon: Clock, tone: "slate" },
      ];

  const toneColors: Record<string, string> = {
    success: "#10b981",
    blue: "#3b82f6",
    amber: "#f59e0b",
    red: "#ef4444",
    primary: "#d35a1f",
    slate: "#64748b",
  };

  return (
    <div className="space-y-8">
      {/* Dashboard Top Header */}
      <header className="anim-rise flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <p className="u-label flex items-center gap-2 text-[var(--primary)] font-bold">
            <span className="inline-block h-[2px] w-6 bg-[var(--primary)]" />
            Sistem ERP Putra Corp
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            {isOwnerMode ? "Owner Business Dashboard" : "Operational Workspace"}
          </h1>
          <p className="mt-1.5 text-xs font-semibold text-slate-500">
            Selamat datang kembali, <span className="text-slate-800 font-bold">{user.nama}</span>.
          </p>
        </div>

        {/* Toggle Mode & Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Mode Switcher capsule */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-border w-full sm:w-auto">
            <Link
              href={`/?mode=operational${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`}
              className={`flex-1 sm:flex-none rounded-lg px-4 py-2 text-xs font-bold text-center transition-all duration-150 ${
                !isOwnerMode
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-950"
              }`}
            >
              Operasional
            </Link>
            <Link
              href={`/?mode=owner${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`}
              className={`flex-1 sm:flex-none rounded-lg px-4 py-2 text-xs font-bold text-center transition-all duration-150 ${
                isOwnerMode
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-950"
              }`}
            >
              Owner
            </Link>
          </div>

          <form className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ""}
              className="flex-1 sm:flex-none h-10 min-w-0 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs outline-none focus:border-[var(--primary)]"
            />
            <span className="text-xs text-slate-400 font-bold">s/d</span>
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? ""}
              className="flex-1 sm:flex-none h-10 min-w-0 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs outline-none focus:border-[var(--primary)]"
            />
            {params.mode && <input type="hidden" name="mode" value={params.mode} />}
            <button className="flex-1 sm:flex-none h-10 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white shadow-md hover:bg-[var(--primary-strong)] cursor-pointer transition">
              Saring
            </button>
            {params.from || params.to ? (
              <Link href={isOwnerMode ? "/?mode=owner" : "/"} className="flex-1 sm:flex-none flex h-10 items-center justify-center rounded-xl border border-border bg-white px-3 text-xs font-bold text-slate-650 hover:bg-slate-50 shadow-xs">
                Reset
              </Link>
            ) : null}
          </form>
        </div>
      </header>

      {/* KPI Card grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="tick-card anim-rise relative flex flex-col justify-between overflow-hidden rounded-[18px] border border-border bg-white p-4 sm:p-5 shadow-[var(--shadow-card)]"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="absolute inset-x-0 top-0 h-[4px]" style={{ background: toneColors[kpi.tone] }} />
              <div className="flex items-start justify-between gap-3">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-450 leading-tight">{kpi.label}</p>
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/50">
                  <Icon size={13} style={{ color: toneColors[kpi.tone] }} strokeWidth={2.5} />
                </div>
              </div>
              <div className="mt-3 min-w-0">
                <h3 className="font-display font-extrabold text-slate-900 leading-none tracking-tight tnum text-xs sm:text-sm">
                  {kpi.value}
                </h3>
                <p className="mt-1 text-[9px] sm:text-[10px] font-semibold text-slate-450 leading-tight">{kpi.desc}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Charts Section */}
      <section className="anim-rise">
        <DashboardCharts
          revenueTrend={trendData}
          topItems={topItems}
          projectSales={projectSales}
        />
      </section>

      {/* Spacious Double Column Layout: Activity & Alerts */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3 anim-rise">
        {/* Activity Timeline (Linear-style list) */}
        <Card className="lg:col-span-2 space-y-5">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock size={16} className="text-[var(--primary)]" /> Riwayat Audit Operasional
            </h3>
            <p className="text-xs text-slate-400 mt-1">Log audit aktivitas staf kasir dan gudang terbaru.</p>
          </div>

          <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-5">
            {recentLogs.map((log) => (
              <div key={log.id} className="relative text-xs">
                {/* Bullet point indicator */}
                <span className="absolute -left-[21px] top-1 flex h-2 w-2 rounded-full bg-slate-350 ring-4 ring-white" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {log.user?.nama ?? "System"} melakukan <span className="font-bold text-slate-950">{log.aksi}</span>
                    </p>
                    <p className="text-[10px] text-slate-450 mt-0.5">Target: {log.entitas} (ID: {log.entitasId ?? "—"})</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}

            {recentLogs.length === 0 && (
              <p className="text-xs text-slate-450 text-center py-4">Belum ada catatan aktivitas.</p>
            )}
          </div>
        </Card>

        {/* Alert Center Dashboard */}
        <Card className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" /> Alert Center
            </h3>
            <p className="text-xs text-slate-400 mt-1">Peringatan stok gudang & piutang tempo kritis.</p>
          </div>

          <div className="space-y-3">
            {/* Stok Minus alert card */}
            {negativeStockItems.length > 0 && (
              <div className="rounded-xl border border-red-100 bg-red-50/50 p-3.5 text-xs text-red-800">
                <p className="font-bold flex items-center gap-1.5 mb-1.5">
                  <CircleAlert size={14} className="text-red-500" /> Stok Minus Gudang ({negativeStockItems.length})
                </p>
                <ul className="space-y-1">
                  {negativeStockItems.slice(0, 3).map((it) => (
                    <li key={it.id} className="flex justify-between items-center text-[10px] font-semibold text-red-750">
                      <span className="truncate pr-2">{it.nama}</span>
                      <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-red-700">{it.stok} unit</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stok Menipis alert card */}
            {lowStockItems.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5 text-xs text-amber-800">
                <p className="font-bold flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle size={14} className="text-amber-500" /> Stok Kritis ({lowStockItems.length})
                </p>
                <ul className="space-y-1">
                  {lowStockItems.slice(0, 3).map((it) => (
                    <li key={it.id} className="flex justify-between items-center text-[10px] font-semibold text-amber-755">
                      <span className="truncate pr-2">{it.nama}</span>
                      <span>tersisa {it.stok} (min {it.minStok})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Overdue receivables warning card */}
            {unpaidInvoices.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/55 p-3.5 text-xs text-slate-700">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 mb-1.5">
                  <FileText size={14} className="text-slate-500" /> Piutang Jatuh Tempo
                </p>
                <ul className="divide-y divide-slate-100">
                  {unpaidInvoices.slice(0, 2).map((inv) => {
                    const sisa = Number(inv.total) - Number(inv.totalDibayar);
                    const dueDate = addDays(inv.tanggal, 30);
                    const isOverdue = dueDate.getTime() < now.getTime();
                    if (!isOverdue) return null;
                    return (
                      <li key={inv.noInvoice} className="py-2 flex justify-between items-start text-[10px]">
                        <div>
                          <p className="font-bold text-slate-800">{inv.noInvoice}</p>
                          <p className="text-slate-400 font-semibold">{inv.namaClient ?? "Pelanggan"}</p>
                        </div>
                        <p className="font-bold font-mono text-red-500 text-right">
                          {formatRupiah(sisa)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
