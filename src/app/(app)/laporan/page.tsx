import { requireUser } from "@/lib/auth";
import { laporanMargin, barangTerlaris, laporanStok, laporanPiutang } from "@/lib/reports";
import { LaporanClient } from "./LaporanClient";

export default async function LaporanPage() {
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

  // Fetch reports on server-side
  const margin = await laporanMargin();
  const terlaris = await barangTerlaris(10);
  const stok = await laporanStok();
  const piutang = await laporanPiutang();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analitik &amp; Laporan ERP</h1>
        <p className="text-sm text-muted">Akses data performa penjualan harian, sisa outstanding piutang, dan valuasi aset persediaan gudang.</p>
      </div>

      <LaporanClient
        role={user.role}
        marginData={margin}
        terlaris={terlaris}
        stokData={stok}
        piutangData={piutang}
      />
    </div>
  );
}
