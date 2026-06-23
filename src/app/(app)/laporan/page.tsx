import { requireUser } from "@/lib/auth";
import { laporanMargin, barangTerlaris, laporanStok, laporanPiutang } from "@/lib/reports";
import { LaporanClient } from "./LaporanClient";

export default async function LaporanPage() {
  const user = await requireUser();

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
