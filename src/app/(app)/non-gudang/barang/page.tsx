import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NgBarangClient } from "./NgBarangClient";

export const revalidate = 60;

export default async function NgBarangPage() {
  const user = await requireUser();

  if (user.role !== "ADMIN_NONGUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <h1 className="text-xl font-bold text-red-800 dark:text-red-300">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          Menu ini hanya diizinkan untuk <strong>Admin Non-Gudang</strong>.
        </p>
      </div>
    );
  }

  const rows = await prisma.ngProduk.findMany({ orderBy: [{ namaToko: "asc" }, { nama: "asc" }] });

  const data = rows.map((r) => ({
    id: r.id,
    nama: r.nama,
    namaToko: r.namaToko,
    kategori: r.kategori,
    satuan: r.satuan,
    hargaBeli: Number(r.hargaBeli),
    hargaJual: Number(r.hargaJual),
    aktif: r.aktif,
  }));

  return <NgBarangClient initialItems={data} />;
}
