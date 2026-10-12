import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReturClient } from "./ReturClient";

export default async function ReturPage() {
  const user = await requireUser();

  if (user.role !== "ADMIN_KASIR" && user.role !== "ADMIN_GUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-800">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700">
          Menu Retur / Tukar hanya diizinkan untuk <strong>Admin Kasir</strong> dan <strong>Admin Gudang / Owner</strong>.
        </p>
      </div>
    );
  }

  const items = await prisma.item.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } });
  const data = items.map((i) => ({ id: i.id, kode: i.kode, nama: i.nama, hargaJual: Number(i.hargaJual) }));

  const transactions = await prisma.transaction.findMany({
    select: {
      noTransaksi: true,
      namaClient: true,
    },
    orderBy: {
      tanggal: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Retur / Tukar Barang</h1>
        <p className="text-sm text-muted">
          Barang A dikembalikan (masuk stok), opsional ditukar Barang B (keluar stok). Selisih jadi tagihan/refund.
        </p>
      </div>
      <ReturClient items={data} transactions={transactions} />
    </div>
  );
}
