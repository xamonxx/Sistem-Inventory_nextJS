"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LabelList,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatRupiah } from "@/lib/utils";

type TrendPoint = { tanggal: string; omset: number; margin: number };

const AXIS_TICK = { fontSize: 10, fill: "var(--text-muted-2)" };

const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "0 18px 40px -20px rgba(2, 6, 23, 0.45)",
  color: "var(--foreground)",
  fontSize: "12px",
  padding: "8px 12px",
};

const TOOLTIP_LABEL_STYLE = { fontWeight: 700, color: "var(--foreground)", marginBottom: 4 };

const PROJECT_COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e"];

function compactRupiah(v: number) {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}rb`;
  return String(v);
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function RevenueTrendChart({ data, showMargin = true }: { data: TrendPoint[]; showMargin?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="bentoOmset" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="bentoMargin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="tanggal" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={18} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} tickFormatter={compactRupiah} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          cursor={{ stroke: "var(--line-strong)", strokeDasharray: "3 3" }}
          formatter={(v: unknown, name: unknown) => [formatRupiah(v as number), name as string]}
        />
        <Area
          name="Omzet"
          type="monotoneX"
          dataKey="omset"
          stroke="#0ea5e9"
          strokeWidth={2.25}
          fill="url(#bentoOmset)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        {showMargin && (
          <Area
            name="Margin"
            type="monotoneX"
            dataKey="margin"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#bentoMargin)"
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MarginPctChart({ data }: { data: TrendPoint[] }) {
  // Hari tanpa omzet tidak punya persentase margin; null agar garis tidak jatuh ke 0%.
  const points = data.map((d) => ({
    tanggal: d.tanggal,
    marginPct: d.omset > 0 ? Math.round((d.margin / d.omset) * 1000) / 10 : null,
  }));
  const valid = points.map((p) => p.marginPct).filter((v): v is number => v !== null);
  const avg = valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="bentoMarginPct" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="tanggal" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={18} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          cursor={{ stroke: "var(--line-strong)", strokeDasharray: "3 3" }}
          formatter={(v: unknown) => [`${v as number}%`, "Margin"]}
        />
        {avg !== null && (
          <ReferenceLine
            y={avg}
            stroke="#f59e0b"
            strokeOpacity={0.55}
            strokeDasharray="5 5"
            label={{ value: `Rata-rata ${avg}%`, position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }}
          />
        )}
        <Area
          name="Margin %"
          type="monotoneX"
          dataKey="marginPct"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#bentoMarginPct)"
          connectNulls
          dot={{ r: 2.5, strokeWidth: 0, fill: "#f59e0b" }}
          activeDot={{ r: 4.5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Tick nama barang satu baris (tick bawaan Recharts membungkus teks panjang). */
function ItemTick({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: string } }) {
  const name = String(payload?.value ?? "");
  return (
    <text x={Number(x) - 8} y={Number(y)} dy={4} textAnchor="end" fontSize={11} fill="var(--text-soft)">
      <title>{name}</title>
      {truncate(name, 21)}
    </text>
  );
}

export function TopItemsChart({ data }: { data: { nama: string; qty: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={6}>
        <defs>
          <linearGradient id="bentoTopBar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="nama"
          width={140}
          axisLine={false}
          tickLine={false}
          tick={ItemTick}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          cursor={{ fill: "var(--surface-2)", fillOpacity: 0.5 }}
          // Fill bar berupa gradient (url(#...)), bukan warna; tanpa ini teks item jatuh ke hitam.
          itemStyle={{ color: "var(--foreground)" }}
          formatter={(v: unknown) => [`${v as number} unit`, "Terjual"]}
        />
        <Bar dataKey="qty" radius={[0, 8, 8, 0]} background={{ fill: "var(--surface-2)", fillOpacity: 0.45, radius: 8 }}>
          {data.map((_, i) => (
            <Cell key={i} fill="url(#bentoTopBar)" fillOpacity={i < 3 ? 1 : 0.55} />
          ))}
          <LabelList dataKey="qty" position="right" style={{ fontSize: 11, fontWeight: 700, fill: "var(--foreground)" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProjectSalesChart({ data }: { data: { nama: string; total: number }[] }) {
  const total = data.reduce((a, d) => a + d.total, 0);
  return (
    <div className="flex h-full flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="nama" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none">
              {data.map((_, i) => (
                <Cell key={i} fill={PROJECT_COLORS[i % PROJECT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [formatRupiah(v as number), undefined]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">Total</span>
          <span className="tnum text-sm font-extrabold text-foreground">{compactRupiah(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2.5">
        {data.map((d, i) => (
          <li key={d.nama} className="flex items-center gap-2.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-[var(--text-soft)]" title={d.nama}>
              {d.nama}
            </span>
            <span className="tnum shrink-0 font-bold text-foreground">{formatRupiah(d.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
