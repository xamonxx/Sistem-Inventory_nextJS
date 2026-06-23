import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nota, type NotaItem } from "@/components/Nota";
import { PrintBar } from "@/components/PrintBar";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: {
      transaction: { include: { items: true } },
      return: { include: { itemRetur: true, itemGanti: true } },
    },
  });
  if (!inv) notFound();

  let items: NotaItem[] = [];
  let catatan: string | undefined;

  if (inv.transaction) {
    items = inv.transaction.items.map((it) => ({
      nama: it.namaSnapshot,
      harga: Number(it.hargaSnapshot),
      qty: it.qty,
      subtotal: Number(it.subtotal),
    }));
  } else if (inv.return) {
    const r = inv.return;
    items = [{ nama: `[RETUR] ${r.itemRetur.nama}`, harga: Number(r.hargaReturSnapshot), qty: r.qtyRetur, subtotal: -(Number(r.hargaReturSnapshot) * r.qtyRetur) }];
    if (r.itemGanti && r.qtyGanti) {
      items.push({ nama: `[GANTI] ${r.itemGanti.nama}`, harga: Number(r.hargaGantiSnapshot), qty: r.qtyGanti, subtotal: Number(r.hargaGantiSnapshot) * r.qtyGanti });
    }
    catatan = "Tagihan dari selisih tukar barang.";
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PrintBar backHref="/invoice" />
      <div className="print-area rounded-xl border border-border bg-white shadow-sm">
        <Nota
          data={{
            noInvoice: inv.noInvoice,
            tanggal: inv.tanggal.toISOString(),
            namaClient: inv.namaClient,
            alamat: inv.alamat,
            namaWs: inv.namaWs,
            items,
            total: Number(inv.total),
            judul: "INVOICE / TAGIHAN",
            catatan,
          }}
        />
      </div>
    </div>
  );
}
