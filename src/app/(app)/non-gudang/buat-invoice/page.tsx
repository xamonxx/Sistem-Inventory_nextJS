import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NgBuatInvoiceClient } from "./NgBuatInvoiceClient";

export default async function NonGudangBuatInvoicePage() {
  const user = await requireUser();

  if (user.role !== "ADMIN_NONGUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <h1 className="text-xl font-bold text-red-800 dark:text-red-300">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          Fitur pembuatan invoice non-gudang hanya diizinkan untuk <strong>Admin Non-Gudang</strong>.
        </p>
      </div>
    );
  }

  const products = await prisma.ngProduk.findMany({
    where: { aktif: true },
    orderBy: [{ namaToko: "asc" }, { nama: "asc" }],
    select: {
      id: true,
      nama: true,
      namaToko: true,
      kategori: true,
      satuan: true,
      hargaBeli: true,
      hargaJual: true,
    },
  });

  const tokoOptions = Array.from(new Set(products.map((product) => product.namaToko))).sort((a, b) => a.localeCompare(b));

  const konsumen = await prisma.ngKonsumen.findMany({
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, namaGrup: true, alamat: true, namaWorkshop: true },
  });

  return (
    <NgBuatInvoiceClient
      tokoOptions={tokoOptions}
      konsumenOptions={konsumen.map((k) => ({
        id: k.id,
        nama: k.nama,
        namaGrup: k.namaGrup ?? "",
        alamat: k.alamat ?? "",
        namaWorkshop: k.namaWorkshop ?? "",
      }))}
      items={products.map((product) => ({
        ...product,
        hargaBeli: Number(product.hargaBeli),
        hargaJual: Number(product.hargaJual),
      }))}
    />
  );
}
