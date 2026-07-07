export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth";
import { ngAnalisa, type NgReportRange } from "@/lib/ngReports";
import { NgDashboardClient } from "./NgDashboardClient";

/** Parse "YYYY-MM-DD" jadi rentang inklusif (awal hari s/d akhir hari). */
function parseRange(from?: string, to?: string): NgReportRange {
  const range: NgReportRange = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const d = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(d.getTime())) range.from = d;
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const d = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) range.to = d;
  }
  return range;
}

export default async function NonGudangDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; label?: string }>;
}) {
  const user = await requireUser();

  if (user.role !== "ADMIN_NONGUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <h1 className="text-xl font-bold text-red-800 dark:text-red-300">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          Modul Non-Gudang hanya diizinkan untuk <strong>Admin Non-Gudang</strong>.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const range = parseRange(sp.from, sp.to);
  const periodeLabel = sp.label && sp.label.trim().length > 0 ? sp.label : "Semua Waktu";

  const analisa = await ngAnalisa(range);

  return (
    <NgDashboardClient
      analisa={analisa}
      userName={user.nama}
      periodeLabel={periodeLabel}
      initialFrom={sp.from ?? ""}
      initialTo={sp.to ?? ""}
    />
  );
}
