import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { laporanOmset, laporanMargin, laporanPiutang, laporanStok } from "@/lib/reports";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "stok";

  // Security role validation
  if (type === "margin" && user.role !== "ADMIN_GUDANG") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const wb = XLSX.utils.book_new();

  if (type === "ringkasan") {
    // Export all reports in one workbook
    const omset = await laporanOmset();
    const wsOmset = XLSX.utils.json_to_sheet(omset);
    XLSX.utils.book_append_sheet(wb, wsOmset, "Omset");

    if (user.role === "ADMIN_GUDANG") {
      const margin = await laporanMargin();
      const wsMargin = XLSX.utils.json_to_sheet(margin);
      XLSX.utils.book_append_sheet(wb, wsMargin, "Margin");
    }

    const piutang = await laporanPiutang();
    const wsPiutang = XLSX.utils.json_to_sheet(piutang);
    XLSX.utils.book_append_sheet(wb, wsPiutang, "Piutang");

    const stok = await laporanStok();
    const wsStok = XLSX.utils.json_to_sheet(stok);
    XLSX.utils.book_append_sheet(wb, wsStok, "Stok");
  } else {
    let rows: Record<string, unknown>[] = [];
    let sheetName = "Laporan";

    switch (type) {
      case "omset": rows = await laporanOmset(); sheetName = "Omset"; break;
      case "margin": rows = await laporanMargin(); sheetName = "Margin"; break;
      case "piutang": rows = await laporanPiutang(); sheetName = "Piutang"; break;
      case "stok": rows = await laporanStok(); sheetName = "Stok"; break;
      default: return NextResponse.json({ error: "Tipe tidak dikenal" }, { status: 400 });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const body = new Uint8Array(buf);

  const tanggal = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="laporan-${type}-${tanggal}.xlsx"`,
    },
  });
}
