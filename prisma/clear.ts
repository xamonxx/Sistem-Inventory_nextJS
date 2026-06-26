import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Hapus SEMUA data dummy/transaksional + master, TAPI pertahankan akun login (users).
// Counter di-reset ke 0 agar penomoran dokumen mulai dari awal (PC00001, INV-00001, RET-00001).
async function main() {
  console.log("🧹 Membersihkan SEMUA data (master + transaksi), kecuali akun login...\n");

  // Urutan penting untuk menghindari pelanggaran FK.
  await prisma.activityLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.return.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.item.deleteMany();
  await prisma.project.deleteMany();
  await prisma.projectGroup.deleteMany();
  await prisma.workshop.deleteMany();
  await prisma.client.deleteMany();

  // Reset penomoran dokumen ke 0 (dokumen berikutnya = value + 1).
  await prisma.counter.updateMany({ data: { value: 0 } });

  const summary = {
    users: await prisma.user.count(),
    items: await prisma.item.count(),
    clients: await prisma.client.count(),
    workshops: await prisma.workshop.count(),
    projects: await prisma.project.count(),
    transactions: await prisma.transaction.count(),
    invoices: await prisma.invoice.count(),
    returns: await prisma.return.count(),
    payments: await prisma.payment.count(),
    stockLedger: await prisma.stockLedger.count(),
    activityLogs: await prisma.activityLog.count(),
  };

  console.log("✅ Selesai. Sisa data:");
  console.table(summary);
  console.log("\nAkun login dipertahankan (kasir / gudang). Counter di-reset ke 0.");
}

main()
  .catch((e) => {
    console.error("❌ Gagal membersihkan:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
