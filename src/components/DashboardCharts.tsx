"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatRupiah } from "@/lib/utils";

type ChartProps = {
  revenueTrend: { tanggal: string; omset: number; margin: number }[];
  topItems: { nama: string; qty: number }[];
  projectSales: { nama: string; total: number }[];
};

export function DashboardCharts({ revenueTrend, topItems, projectSales }: ChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-64 flex items-center justify-center text-sm text-muted">Memuat grafik...</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Revenue & Margin Trend */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Tren Omset & Margin Kotor</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorOmset" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : `${v / 1000}rb`)}
              />
              <Tooltip formatter={(v: number) => formatRupiah(v)} />
              <Legend verticalAlign="top" height={36} />
              <Area name="Omset" type="monotone" dataKey="omset" stroke="#1d4ed8" fillOpacity={1} fill="url(#colorOmset)" />
              <Area name="Margin" type="monotone" dataKey="margin" stroke="#059669" fillOpacity={1} fill="url(#colorMargin)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales by Project */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Omset Berdasarkan Proyek</h3>
        <div className="h-72">
          {projectSales.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted">Belum ada data penjualan proyek.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectSales} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1_000_000}jt`} />
                <YAxis type="category" dataKey="nama" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
                <Bar name="Omset" dataKey="total" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Selling Items */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">10 Barang Terlaris (Qty)</h3>
        <div className="h-72">
          {topItems.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted">Belum ada data penjualan.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="nama" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar name="Qty Terjual" dataKey="qty" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Margin Trend (%) */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Tren Persentase Margin Kotor (%)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueTrend.map(d => ({ ...d, marginPct: d.omset > 0 ? Math.round((d.margin / d.omset) * 100) : 0 }))} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Margin (%)"]} />
              <Line name="Margin %" type="monotone" dataKey="marginPct" stroke="#dc2626" strokeWidth={2} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
