"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/utils";
import type { NgAnalisa } from "@/lib/ngReports";

const AXIS_TICK = { fontSize: 10, fill: "var(--text-muted-2)" };

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    boxShadow: "0 18px 40px -20px rgba(2, 6, 23, 0.45)",
    color: "var(--foreground)",
    fontSize: "12px",
    padding: "8px 12px",
  },
  labelStyle: { fontWeight: 700, color: "var(--foreground)", marginBottom: 4 },
};

export const NG_SERIES = {
  pembelian: "#0ea5e9",
  omzet: "#10b981",
  profit: "#f59e0b",
};

function fmtAxis(value: unknown) {
  const n = value as number;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}jt`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}rb`;
  return `${n}`;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Tick kategori satu baris (tick bawaan Recharts membungkus teks panjang). */
function NameTick({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: string } }) {
  const name = String(payload?.value ?? "");
  return (
    <text x={Number(x) - 8} y={Number(y)} dy={4} textAnchor="end" fontSize={11} fill="var(--text-soft)">
      <title>{name}</title>
      {truncate(name, 22)}
    </text>
  );
}

/** Tren bulanan: area bergradasi untuk pembelian, omzet, dan keuntungan. */
export function NgTrendChart({ tren }: { tren: NgAnalisa["tren"] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={tren} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        <defs>
          {Object.entries(NG_SERIES).map(([key, color]) => (
            <linearGradient key={key} id={`ngTrend-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={key === "profit" ? 0.25 : 0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="periode" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} tickFormatter={fmtAxis} />
        <Tooltip
          {...TOOLTIP_STYLE}
          cursor={{ stroke: "var(--line-strong)", strokeDasharray: "3 3" }}
          formatter={(v: unknown, n: unknown) => [formatRupiah(v as number), n as string]}
        />
        <Area type="monotoneX" dataKey="pembelian" name="Pembelian" stroke={NG_SERIES.pembelian} strokeWidth={2} fill="url(#ngTrend-pembelian)" activeDot={{ r: 4, strokeWidth: 0 }} />
        <Area type="monotoneX" dataKey="omzet" name="Omzet" stroke={NG_SERIES.omzet} strokeWidth={2.25} fill="url(#ngTrend-omzet)" activeDot={{ r: 4, strokeWidth: 0 }} />
        <Area type="monotoneX" dataKey="profit" name="Keuntungan" stroke={NG_SERIES.profit} strokeWidth={2} fill="url(#ngTrend-profit)" activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Batang horizontal satu warna (gradasi); 3 teratas penuh, sisanya lebih redup. */
export function NgRankBarChart({
  data,
  dataKey,
  label,
  gradientId,
  from,
  to,
}: {
  data: Array<{ name: string } & Record<string, number | string>>;
  dataKey: string;
  label: string;
  gradientId: string;
  from: string;
  to: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={7}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={fmtAxis} />
        <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={NameTick} interval={0} />
        <Tooltip
          {...TOOLTIP_STYLE}
          // Fill batang berupa gradient (url(#...)); tanpa ini teks item jatuh ke hitam.
          itemStyle={{ color: "var(--foreground)" }}
          cursor={{ fill: "var(--surface-2)", fillOpacity: 0.5 }}
          formatter={(v: unknown) => [formatRupiah(v as number), label]}
        />
        <Bar dataKey={dataKey} name={label} radius={[0, 8, 8, 0]} background={{ fill: "var(--surface-2)", fillOpacity: 0.45, radius: 8 }}>
          {data.map((_, i) => (
            <Cell key={i} fill={`url(#${gradientId})`} fillOpacity={i < 3 ? 1 : 0.55} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
