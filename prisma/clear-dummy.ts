/**
 * Hapus HANYA data dummy yang dibuat `prisma/seed-dummy.ts`.
 *
 * Yang dihapus:
 *   - Barang gudang berkode `DMY-` beserta seluruh ledger-nya, transaksi yang
 *     memuat barang tersebut (detail, pembayaran, invoice, retur terkait).
 *   - Barang & konsumen Non-Gudang bernama `DMY ...` beserta invoice Non-Gudang
 *     yang memakai salah satunya (item & pembayaran ikut terhapus).
 *
 * Counter nomor dokumen TIDAK di-reset agar nomor baru tidak bentrok.
 * Tindakan ini permanen. Jalankan: npm run db:clear:dummy
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ITEM_PREFIX = "DMY-";
const NAME_PREFIX = "DMY ";

async function main() {
  // ---------- Gudang ----------
  const items = await prisma.item.findMany({ where: { kode: { startsWith: ITEM_PREFIX } }, select: { id: true } });
  const itemIds = items.map((i) => i.id);

  const trxRows = itemIds.length
    ? await prisma.transactionItem.findMany({ where: { itemId: { in: itemIds } }, select: { transactionId: true }, distinct: ["transactionId"] })
    : [];
  const trxIds = trxRows.map((r) => r.transactionId);

  const returns = trxIds.length
    ? await prisma.return.findMany({ where: { transactionId: { in: trxIds } }, select: { id: true } })
    : [];
  const returnIds = returns.map((r) => r.id);

  const invoices = await prisma.invoice.findMany({
    where: { OR: [{ transactionId: { in: trxIds } }, { returnId: { in: returnIds } }] },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);

  // ---------- Non-Gudang ----------
  const ngProduk = await prisma.ngProduk.findMany({ where: { nama: { startsWith: NAME_PREFIX } }, select: { id: true } });
  const ngKonsumen = await prisma.ngKonsumen.findMany({ where: { nama: { startsWith: NAME_PREFIX } }, select: { id: true } });
  const ngProdukIds = ngProduk.map((p) => p.id);
  const ngKonsumenIds = ngKonsumen.map((k) => k.id);
  const ngInvoices = await prisma.ngInvoice.findMany({
    where: { OR: [{ konsumenId: { in: ngKonsumenIds } }, { items: { some: { produkId: { in: ngProdukIds } } } }] },
    select: { id: true },
  });
  const ngInvoiceIds = ngInvoices.map((i) => i.id);

  const result = await prisma.$transaction(
    async (tx) => {
      const payments = await tx.payment.deleteMany({
        where: { OR: [{ transactionId: { in: trxIds } }, { invoiceId: { in: invoiceIds } }] },
      });
      const inv = await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      await tx.returnItem.deleteMany({ where: { returnId: { in: returnIds } } });
      const ret = await tx.return.deleteMany({ where: { id: { in: returnIds } } });
      const ledger = await tx.stockLedger.deleteMany({
        where: {
          OR: [
            { itemId: { in: itemIds } },
            { refType: "TRANSACTION", refId: { in: trxIds } },
            { refType: "RETURN", refId: { in: returnIds } },
          ],
        },
      });
      await tx.transactionItem.deleteMany({ where: { transactionId: { in: trxIds } } });
      const trx = await tx.transaction.deleteMany({ where: { id: { in: trxIds } } });
      const it = await tx.item.deleteMany({ where: { id: { in: itemIds } } });

      const ngInv = await tx.ngInvoice.deleteMany({ where: { id: { in: ngInvoiceIds } } }); // item & payment cascade
      const ngP = await tx.ngProduk.deleteMany({ where: { id: { in: ngProdukIds } } });
      const ngK = await tx.ngKonsumen.deleteMany({ where: { id: { in: ngKonsumenIds } } });

      return { it: it.count, ledger: ledger.count, trx: trx.count, inv: inv.count, payments: payments.count, ret: ret.count, ngInv: ngInv.count, ngP: ngP.count, ngK: ngK.count };
    },
    { timeout: 60_000 }
  );

  console.log("Data dummy dihapus:");
  console.log(`  Barang ${result.it}, ledger ${result.ledger}, transaksi ${result.trx}, invoice ${result.inv}, pembayaran ${result.payments}, retur ${result.ret}`);
  console.log(`  NG invoice ${result.ngInv}, NG barang ${result.ngP}, NG konsumen ${result.ngK}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
