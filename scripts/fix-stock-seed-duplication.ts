import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const SEEDED_NOTE = "Stok Awal (Sistem Seeding)";

async function main() {
  const seededLedgers = await prisma.stockLedger.findMany({
    where: {
      tipe: "MASUK",
      refType: "MANUAL",
      keterangan: SEEDED_NOTE,
    },
    select: {
      id: true,
      itemId: true,
      qty: true,
      item: {
        select: {
          kode: true,
          nama: true,
          stokAwal: true,
        },
      },
    },
  });

  const validDuplicates = seededLedgers.filter((ledger) => ledger.item.stokAwal === ledger.qty);
  const suspicious = seededLedgers.filter((ledger) => ledger.item.stokAwal !== ledger.qty);

  console.log("=== Audit Duplikasi Stok Awal Seed ===");
  console.log(`Ledger seed ditemukan : ${seededLedgers.length}`);
  console.log(`Duplikasi valid       : ${validDuplicates.length}`);
  console.log(`Perlu review manual   : ${suspicious.length}`);

  if (suspicious.length > 0) {
    console.log("\nContoh data mencurigakan:");
    for (const ledger of suspicious.slice(0, 10)) {
      console.log(
        `- ${ledger.item.kode} | stokAwal=${ledger.item.stokAwal} | ledgerQty=${ledger.qty} | ledgerId=${ledger.id}`
      );
    }
  }

  if (!APPLY) {
    console.log("\nMode audit saja. Jalankan dengan --apply untuk menghapus ledger duplikat yang valid.");
    return;
  }

  if (validDuplicates.length === 0) {
    console.log("\nTidak ada ledger duplikat yang perlu dihapus.");
    return;
  }

  const idsToDelete = validDuplicates.map((ledger) => ledger.id);
  const deleted = await prisma.stockLedger.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  console.log(`\nLedger duplikat terhapus: ${deleted.count}`);

  const remaining = await prisma.stockLedger.count({
    where: {
      tipe: "MASUK",
      refType: "MANUAL",
      keterangan: SEEDED_NOTE,
    },
  });

  console.log(`Ledger seed tersisa    : ${remaining}`);

  const sample = await prisma.item.findMany({
    take: 5,
    orderBy: { id: "asc" },
    select: {
      kode: true,
      stokAwal: true,
      ledgers: {
        select: { qty: true },
      },
    },
  });

  console.log("\nSample validasi saldo:");
  for (const item of sample) {
    const ledgerSum = item.ledgers.reduce((acc, ledger) => acc + ledger.qty, 0);
    console.log(`- ${item.kode}: stokAwal=${item.stokAwal}, ledger=${ledgerSum}, sisa=${item.stokAwal + ledgerSum}`);
  }
}

main()
  .catch((error) => {
    console.error("Gagal audit/fix stok seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
