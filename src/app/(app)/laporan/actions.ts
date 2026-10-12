"use server";

import { requireRole } from "@/lib/auth";
import { laporanStokKeluar, parseReportRange, type StokKeluarRow } from "@/lib/reports";

/**
 * Data riwayat stok keluar untuk ekspor Excel Laporan. Diambil saat tombol
 * ekspor ditekan (bukan saat render halaman) agar halaman tetap ringan.
 * Rentang memakai format & aturan yang sama dengan halaman (YYYY-MM-DD).
 */
export async function fetchStokKeluarForExport(
  from?: string,
  to?: string
): Promise<{ rows: StokKeluarRow[]; truncated: boolean }> {
  await requireRole("ADMIN_GUDANG");
  const safeFrom = typeof from === "string" ? from.slice(0, 10) : undefined;
  const safeTo = typeof to === "string" ? to.slice(0, 10) : undefined;
  return laporanStokKeluar(parseReportRange(safeFrom, safeTo));
}
