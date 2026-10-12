"use client";

import dynamic from "next/dynamic";

// Recharts hanya dirender di client; placeholder skeleton mengisi tinggi kontainer.
const loading = () => <div className="h-full w-full animate-pulse rounded-xl bg-[var(--surface-2)] opacity-50" />;

export const RevenueTrendChart = dynamic(
  () => import("@/components/DashboardCharts").then((m) => m.RevenueTrendChart),
  { ssr: false, loading }
);

export const MarginPctChart = dynamic(
  () => import("@/components/DashboardCharts").then((m) => m.MarginPctChart),
  { ssr: false, loading }
);

export const TopItemsChart = dynamic(
  () => import("@/components/DashboardCharts").then((m) => m.TopItemsChart),
  { ssr: false, loading }
);

export const ProjectSalesChart = dynamic(
  () => import("@/components/DashboardCharts").then((m) => m.ProjectSalesChart),
  { ssr: false, loading }
);
