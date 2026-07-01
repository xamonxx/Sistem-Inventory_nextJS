import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStokAkhirMap } from "@/lib/stock";
import { EditInvoiceClient } from "../../EditInvoiceClient";
import type { InvoiceRow, InvoiceItem } from "../../InvoiceClient";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  // Only Admin Kasir can edit invoices
  const user = await requireRole("ADMIN_KASIR");

  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: {
      project: true,
      client: true,
      transaction: {
        include: {
          items: { include: { item: true } },
        },
      },
      return: {
        include: {
          items: {
            include: { item: true, itemGanti: true },
          },
          transaction: true,
        },
      },
    },
  });

  if (!inv) notFound();

  // Map invoice items
  let items: InvoiceItem[] = [];
  if (inv.transaction) {
    items = inv.transaction.items.map((it) => ({
      itemId: it.itemId,
      kode: it.item?.kode ?? "-",
      nama: it.namaSnapshot,
      qty: it.qty,
      harga: Number(it.hargaSnapshot),
      subtotal: Number(it.subtotal),
    }));
  } else if (inv.return) {
    const r = inv.return;
    items = [];
    for (const ri of r.items) {
      items.push({
        itemId: ri.itemId,
        kode: ri.item.kode,
        nama: `[RETUR] ${ri.namaSnapshot}`,
        qty: ri.qtyReturned,
        harga: Number(ri.hargaSnapshot),
        subtotal: -(Number(ri.subtotal)),
      });
      if (ri.itemGanti && ri.qtyGanti) {
        items.push({
          itemId: ri.itemGanti.id,
          kode: ri.itemGanti.kode,
          nama: `[GANTI] ${ri.namaGantiSnapshot ?? ri.itemGanti.nama}`,
          qty: ri.qtyGanti,
          harga: Number(ri.hargaGantiSnapshot ?? 0),
          subtotal: Number(ri.subtotalGanti ?? 0),
        });
      }
    }
  }

  // Format invoice object
  const formattedInvoice: InvoiceRow = {
    id: inv.id,
    noInvoice: inv.noInvoice,
    namaClient: inv.namaClient ?? inv.client?.nama ?? "-",
    alamat: inv.alamat,
    namaWs: inv.namaWs,
    namaBank: inv.transaction?.namaBank ?? inv.return?.transaction?.namaBank ?? null,
    noRekening: inv.transaction?.noRekening ?? inv.return?.transaction?.noRekening ?? null,
    atasNama: inv.transaction?.atasNama ?? inv.return?.transaction?.atasNama ?? null,
    total: Number(inv.total),
    totalDibayar: Number(inv.totalDibayar),
    status: inv.status === "DRAFT" ? "DRAFT" : Number(inv.totalDibayar) >= Number(inv.total) ? "PAID" : Number(inv.totalDibayar) > 0 ? "PARTIAL" : "PENDING",
    tanggal: inv.tanggal.toISOString(),
    items,
    projectName: inv.project?.nama ?? undefined,
    noTransaksi: inv.transaction?.noTransaksi ?? inv.return?.transaction?.noTransaksi ?? undefined,
  };

  // Fetch catalog items for autocomplete addition
  const catalogItems = await prisma.item.findMany({
    where: { aktif: true },
    orderBy: { nama: "asc" },
  });
  const stokMap = await getStokAkhirMap(catalogItems.map((i) => i.id));
  const mappedCatalog = catalogItems.map((i) => ({
    id: i.id,
    kode: i.kode,
    nama: i.nama,
    hargaJual: Number(i.hargaJual),
    stok: stokMap[i.id] ?? i.stokAwal,
  }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              href="/invoice"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <ArrowLeft size={14} className="stroke-[2.5]" />
              Kembali
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Koreksi &amp; Edit Invoice</h1>
          </div>
          <p className="text-xs font-semibold text-slate-500 sm:pl-[92px]">
            Ganti barang yang salah co, tambah barang baru, atau kurangi qty. Stok barang yang dibatalkan otomatis kembali ke sistem.
          </p>
        </div>
      </div>

      <EditInvoiceClient invoice={formattedInvoice} catalogItems={mappedCatalog} />
    </div>
  );
}

