import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NgInvoiceClient, type NgCatalogItem, type NgInvoiceRow } from "./NgInvoiceClient";

export default async function NonGudangInvoicePage() {
  const user = await requireUser();

  if (user.role !== "ADMIN_NONGUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <h1 className="text-xl font-bold text-red-800 dark:text-red-300">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          Riwayat invoice non-gudang hanya diizinkan untuk <strong>Admin Non-Gudang</strong>.
        </p>
      </div>
    );
  }

  const invoices = await prisma.ngInvoice.findMany({
    orderBy: { id: "desc" },
    take: 200,
    select: {
      id: true,
      noInvoice: true,
      tanggal: true,
      status: true,
      namaToko: true,
      jatuhTempo: true,
      namaKonsumen: true,
      namaGrup: true,
      alamat: true,
      namaWorkshop: true,
      namaBank: true,
      noRekening: true,
      atasNama: true,
      totalModal: true,
      totalPenjualan: true,
      totalProfit: true,
      margin: true,
      markup: true,
      totalDibayar: true,
      items: {
        select: {
          id: true,
          namaSnapshot: true,
          namaTokoSnapshot: true,
          hargaBeliSnapshot: true,
          hargaJualSnapshot: true,
          qty: true,
          subtotalModal: true,
          subtotalPenjualan: true,
          subtotalProfit: true,
        },
      },
      payments: {
        orderBy: { id: "desc" },
        select: {
          id: true,
          tanggal: true,
          tipe: true,
          jumlah: true,
          keterangan: true,
        },
      },
    },
  });

  const rows: NgInvoiceRow[] = invoices.map((inv) => {
    const totalPenjualan = Number(inv.totalPenjualan);
    const totalDibayar = Number(inv.totalDibayar);
    return {
      id: inv.id,
      noInvoice: inv.noInvoice,
      tanggal: inv.tanggal.toISOString(),
      status: inv.status,
      namaToko: inv.namaToko,
      jatuhTempo: inv.jatuhTempo?.toISOString() ?? null,
      namaKonsumen: inv.namaKonsumen ?? "",
      namaGrup: inv.namaGrup ?? "",
      alamat: inv.alamat ?? "",
      namaWorkshop: inv.namaWorkshop ?? "",
      namaBank: inv.namaBank ?? "",
      noRekening: inv.noRekening ?? "",
      atasNama: inv.atasNama ?? "",
      totalModal: Number(inv.totalModal),
      totalPenjualan,
      totalProfit: Number(inv.totalProfit),
      margin: Number(inv.margin),
      markup: Number(inv.markup),
      totalDibayar,
      sisa: totalPenjualan - totalDibayar,
      items: inv.items.map((it) => ({
        id: it.id,
        nama: it.namaSnapshot,
        namaToko: it.namaTokoSnapshot ?? inv.namaToko,
        hargaBeli: Number(it.hargaBeliSnapshot),
        hargaJual: Number(it.hargaJualSnapshot),
        qty: it.qty,
        subtotalModal: Number(it.subtotalModal),
        subtotalPenjualan: Number(it.subtotalPenjualan),
        subtotalProfit: Number(it.subtotalProfit),
      })),
      payments: inv.payments.map((p) => ({
        id: p.id,
        tanggal: p.tanggal.toISOString(),
        tipe: p.tipe,
        jumlah: Number(p.jumlah),
        keterangan: p.keterangan ?? "",
      })),
    };
  });

  const catalogRaw = await prisma.ngProduk.findMany({
    where: { aktif: true },
    orderBy: [{ namaToko: "asc" }, { nama: "asc" }],
    select: { id: true, nama: true, namaToko: true, hargaBeli: true, hargaJual: true },
  });
  const catalog: NgCatalogItem[] = catalogRaw.map((p) => ({
    id: p.id,
    nama: p.nama,
    namaToko: p.namaToko,
    hargaBeli: Number(p.hargaBeli),
    hargaJual: Number(p.hargaJual),
  }));

  return <NgInvoiceClient initialInvoices={rows} catalog={catalog} userName={user.nama} />;
}
