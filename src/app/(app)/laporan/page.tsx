import { requireUser } from "@/lib/auth";
import { laporanMargin, barangTerlaris, laporanStok, laporanPiutang, type ReportRange } from "@/lib/reports";
import { LaporanClient } from "./LaporanClient";

/** Parse "YYYY-MM-DD" jadi rentang inklusif (awal hari s/d akhir hari). */
function parseRange(from?: string, to?: string): ReportRange {
  const range: ReportRange = {};
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

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; label?: string }>;
}) {
  const user = await requireUser();

  if (user.role !== "ADMIN_GUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-800">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700">
          Menu Analitik &amp; Laporan hanya diizinkan untuk <strong>Admin Gudang / Owner</strong>.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const range = parseRange(sp.from, sp.to);
  const periodeLabel = sp.label && sp.label.trim().length > 0 ? sp.label : "Semua Waktu";

  // Fetch reports on server-side (mengikuti rentang periode aktif).
  // Catatan: Stok & Aset adalah snapshot posisi TERKINI, tidak difilter periode.
  const margin = await laporanMargin(range);
  const terlaris = await barangTerlaris(10, range);
  const stok = await laporanStok();
  const piutang = await laporanPiutang(range);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analitik &amp; Laporan ERP</h1>
        <p className="text-sm text-muted">Akses data performa penjualan harian, sisa outstanding piutang, dan valuasi aset persediaan gudang.</p>
      </div>

      <LaporanClient
        role={user.role}
        userName={user.nama}
        periodeLabel={periodeLabel}
        initialFrom={sp.from ?? ""}
        initialTo={sp.to ?? ""}
        marginData={margin}
        terlaris={terlaris}
        stokData={stok}
        piutangData={piutang}
      />
    </div>
  );
}
