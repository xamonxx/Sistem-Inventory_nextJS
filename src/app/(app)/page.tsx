import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getStokAkhirMap } from "@/lib/stock";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { Card, Badge } from "@/components/ui";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DatePicker } from "@/components/DatePicker";
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

// Terima hanya format YYYY-MM-DD yang valid; selain itu pakai fallback.
function parseDateParam(value: string | undefined, fallback: Date, endOfDay = false): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const d = new Date(value + (endOfDay ? "T23:59:59" : "T00:00:00"));
  return isNaN(d.getTime()) ? fallback : d;
}

// Cache dashboard for 30 seconds (balances real-time data with performance)
export const revalidate = 30;

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

  // Parse filters & mode (validasi format tanggal supaya query tidak menerima Invalid Date)
  const dateFrom = parseDateParam(params.from, startOfDay(new Date(now.getTime() - 29 * 86400000)));
  const dateTo = parseDateParam(params.to, new Date(), true);
  const isOwnerMode = user.role !== "ADMIN_KASIR" && params.mode === "owner";

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

  // 6. Revenue & Margin Trend (Optimized: 2 queries instead of 60)
  const chartDays = 30;
  const chartStartDate = startOfDay(new Date(now.getTime() - (chartDays - 1) * 86400000));
  
  // Fetch all transactions for the entire period in ONE query
  const allTransactions = await prisma.transaction.findMany({
    where: { tanggal: { gte: chartStartDate } },
    select: { tanggal: true, grandTotal: true },
  });

  // Fetch all transaction items for margin calculation in ONE query (if needed)
  let allTransactionItems: Array<{ tanggal: Date; qty: number; hargaSnapshot: any; hargaBeliSnapshot: any }> = [];
  if (isGudang) {
    allTransactionItems = await prisma.transactionItem.findMany({
      where: { transaction: { tanggal: { gte: chartStartDate } } },
      select: { 
        qty: true, 
        hargaSnapshot: true, 
        hargaBeliSnapshot: true,
        transaction: { select: { tanggal: true } }
      },
    }).then(items => items.map(it => ({
      tanggal: it.transaction.tanggal,
      qty: it.qty,
      hargaSnapshot: it.hargaSnapshot,
      hargaBeliSnapshot: it.hargaBeliSnapshot,
    })));
  }

  // Group data by date in memory
  const dateMap = new Map<string, { omset: number; margin: number }>();
  
  // Process transactions
  for (const trx of allTransactions) {
    const dateKey = trx.tanggal.toISOString().split('T')[0];
    const existing = dateMap.get(dateKey) ?? { omset: 0, margin: 0 };
    existing.omset += Number(trx.grandTotal);
    dateMap.set(dateKey, existing);
  }

  // Process transaction items for margin
  for (const item of allTransactionItems) {
    const dateKey = item.tanggal.toISOString().split('T')[0];
    const existing = dateMap.get(dateKey) ?? { omset: 0, margin: 0 };
    existing.margin += (Number(item.hargaSnapshot) - Number(item.hargaBeliSnapshot)) * item.qty;
    dateMap.set(dateKey, existing);
  }

  // Build trend data array with all 30 days (including zeros)
  const trendData: { tanggal: string; omset: number; margin: number }[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = startOfDay(new Date(now.getTime() - i * 86400000));
    const dateKey = d.toISOString().split('T')[0];
    const data = dateMap.get(dateKey) ?? { omset: 0, margin: 0 };
    
    trendData.push({
      tanggal: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(d),
      omset: data.omset,
      margin: data.margin,
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
    stok: stokMap[it.id] ?? it.stokAwal,
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
        ...(user.role !== "ADMIN_KASIR"
          ? [
              { label: "Operator Aktif", value: `${await prisma.user.count({ where: { aktif: true } })} user`, desc: "Total staf terdaftar", icon: Users, tone: "primary" },
              { label: "Aktivitas Hari Ini", value: `${logsTodayCount} logs`, desc: "Audit trail log operasional", icon: Clock, tone: "slate" },
            ]
          : []),
      ];

  const toneColors: Record<string, string> = {
    success: "#16a34a",
    blue: "#2563eb",
    amber: "#f59e0b",
    red: "#ef4444",
    primary: "#0f766e",
    slate: "#60736f",
  };

  return (
    <div className="space-y-7">
      {/* Dashboard Top Header */}
      <header className="relative z-20 anim-rise overflow-visible rounded-lg border border-border bg-[var(--card)] p-5 shadow-[var(--shadow-card)] md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="u-label flex items-center gap-2 text-[var(--primary)] font-bold">
            <span className="inline-block h-[2px] w-6 bg-[var(--primary)]" />
            Sistem ERP Putra Corp
          </p>
          <h1 className="mt-2 font-extrabold text-slate-950">
            {isOwnerMode ? "Owner Business Dashboard" : "Operational Workspace"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Selamat datang kembali, <span className="text-slate-800 font-bold">{user.nama}</span>.
          </p>
        </div>

        {/* Toggle Mode & Filters */}
        <div className="flex w-full flex-col gap-3 xl:w-auto xl:items-end">
          {/* Mode Switcher capsule */}
          {user.role !== "ADMIN_KASIR" && (
            <div className="flex w-full rounded-lg border border-border bg-[#e7efec] p-1 sm:w-auto">
              <Link
                href={`/?mode=operational${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`}
                className={`flex-1 rounded-md px-4 py-2 text-center text-xs font-bold transition-all duration-150 sm:flex-none ${
                  !isOwnerMode
                    ? "bg-white text-[var(--primary-strong)] shadow-sm"
                    : "text-slate-500 hover:text-slate-950"
                }`}
              >
                Operasional
              </Link>
              <Link
                href={`/?mode=owner${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`}
                className={`flex-1 rounded-md px-4 py-2 text-center text-xs font-bold transition-all duration-150 sm:flex-none ${
                  isOwnerMode
                    ? "bg-white text-[var(--primary-strong)] shadow-sm"
                    : "text-slate-500 hover:text-slate-950"
                }`}
              >
                Owner
              </Link>
            </div>
          )}

          <form className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
            <DatePicker
              name="from"
              defaultValue={params.from ?? ""}
              className="h-11 min-w-[145px] flex-1 text-xs font-semibold sm:flex-none sm:w-40"
            />
            <span className="text-xs text-slate-400 font-bold">s/d</span>
            <DatePicker
              name="to"
              defaultValue={params.to ?? ""}
              align="right"
              className="h-11 min-w-[145px] flex-1 text-xs font-semibold sm:flex-none sm:w-40"
            />
            {params.mode && <input type="hidden" name="mode" value={params.mode} />}
            <button className="h-11 flex-1 rounded-lg bg-[var(--primary)] px-5 text-xs font-bold text-white shadow-md shadow-emerald-900/10 transition hover:bg-[var(--primary-strong)] cursor-pointer sm:flex-none">
              Saring
            </button>
            {params.from || params.to ? (
              <Link href={isOwnerMode ? "/?mode=owner" : "/"} className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-white px-3 text-xs font-bold text-slate-600 shadow-xs hover:bg-slate-50 sm:flex-none">
                Reset
              </Link>
            ) : null}
          </form>
        </div>
        </div>
      </header>

      {/* Alert Center (Moved to the top) */}
      {(negativeStockItems.length > 0 || lowStockItems.length > 0) && (
        <Card className="anim-rise space-y-5 border-amber-200/70 bg-[#fffdf7]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
            <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" /> Alert Center
            </h3>
            <p className="text-xs text-slate-500 mt-1">Peringatan stok gudang kritis.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Butuh tindakan
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Stok Minus alert card */}
            {negativeStockItems.length > 0 && (
              <div className="rounded-lg border border-red-100 bg-red-50/70 p-4 text-xs text-red-800">
                <p className="font-bold flex items-center gap-1.5 mb-1.5">
                  <CircleAlert size={14} className="text-red-500" /> Stok Minus Gudang ({negativeStockItems.length})
                </p>
                <ul className="space-y-1">
                  {negativeStockItems.slice(0, 3).map((it) => (
                    <li key={it.id} className="flex items-center justify-between text-[11px] font-semibold text-red-700">
                      <span className="truncate pr-2">{it.nama}</span>
                      <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700">{it.stok} unit</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stok Menipis alert card */}
            {lowStockItems.length > 0 && (
              <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-4 text-xs text-amber-800">
                <p className="font-bold flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle size={14} className="text-amber-500" /> Stok Kritis ({lowStockItems.length})
                </p>
                <ul className="space-y-1">
                  {lowStockItems.slice(0, 3).map((it) => (
                    <li key={it.id} className="flex items-center justify-between text-[11px] font-semibold text-amber-800">
                      <span className="truncate pr-2">{it.nama}</span>
                      <span>tersisa {it.stok} (min {it.minStok})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* KPI Card grid */}
      <section className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 ${kpiCards.length === 4 ? "2xl:grid-cols-4" : "2xl:grid-cols-6"}`}>
        {kpiCards.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="tick-card anim-rise relative flex min-h-[126px] flex-col justify-between overflow-hidden rounded-lg border border-border bg-[var(--card)] p-4 shadow-[var(--shadow-card)]"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="absolute inset-y-4 left-0 w-[4px] rounded-r-full" style={{ background: toneColors[kpi.tone] }} />
              <div className="flex items-start justify-between gap-3">
                <p className="pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">{kpi.label}</p>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white">
                  <Icon size={13} style={{ color: toneColors[kpi.tone] }} strokeWidth={2.5} />
                </div>
              </div>
              <div className="mt-3 min-w-0 pl-2">
                <div data-tooltip={kpi.value}>
                  <h3 className="tnum overflow-hidden text-ellipsis whitespace-nowrap font-display text-[17px] font-extrabold leading-none text-slate-950">
                    {kpi.value}
                  </h3>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-500 leading-tight truncate" title={kpi.desc}>{kpi.desc}</p>
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
          showMargin={user.role !== "ADMIN_KASIR"}
        />
      </section>

      {/* Spacious Double Column Layout: Activity */}
      {user.role !== "ADMIN_KASIR" && (
        <section className="anim-rise">
          {/* Activity Timeline (Linear-style list) */}
          <Card className="space-y-5">
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
                      <p className="text-[10px] text-slate-500 mt-0.5">Target: {log.entitas} (ID: {log.entitasId ?? "—"})</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}

              {recentLogs.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">Belum ada catatan aktivitas.</p>
              )}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
