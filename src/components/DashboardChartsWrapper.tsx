"use client";

import dynamic from "next/dynamic";

const Charts = dynamic(() => import("@/components/DashboardCharts").then(m => ({ default: m.DashboardCharts })), { ssr: false });

type Props = {
  revenueTrend: { tanggal: string; omset: number; margin: number }[];
  topItems: { nama: string; qty: number }[];
  projectSales: { nama: string; total: number }[];
  showMargin?: boolean;
};

export function DashboardCharts(props: Props) {
  return <Charts {...props} />;
}
