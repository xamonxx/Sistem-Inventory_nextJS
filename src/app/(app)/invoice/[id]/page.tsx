import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInvoiceVerifyUrl } from "@/lib/invoiceVerify";
import { Nota, type NotaItem } from "@/components/Nota";
import { PrintBar } from "@/components/PrintBar";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: {
      transaction: { include: { items: true } },
      return: {
        include: {
          items: {
            include: { item: true, itemGanti: true },
          },
        },
      },
    },
  });
  if (!inv) notFound();
  const verifyUrl = await createInvoiceVerifyUrl(inv.noInvoice);

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
    for (const ri of r.items) {
      items.push({
        nama: `[RETUR] ${ri.namaSnapshot}`,
        harga: Number(ri.hargaSnapshot),
        qty: ri.qtyReturned,
        subtotal: -(Number(ri.subtotal)),
      });
      if (ri.itemGanti && ri.qtyGanti) {
        items.push({
          nama: `[GANTI] ${ri.namaGantiSnapshot ?? ri.itemGanti.nama}`,
          harga: Number(ri.hargaGantiSnapshot),
          qty: ri.qtyGanti,
          subtotal: Number(ri.subtotalGanti),
        });
      }
    }
    catatan = "Tagihan dari selisih tukar barang.";
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PrintBar backHref="/invoice" noInvoice={inv.noInvoice} namaClient={inv.namaClient ?? undefined} />
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
            verifyUrl,
          }}
        />
      </div>
    </div>
  );
}
