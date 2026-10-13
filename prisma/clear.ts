import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Hapus SEMUA data bisnis (master + transaksi + audit), TAPI pertahankan akun login (users).
// Counter juga dihapus; aplikasi akan membuat ulang counter saat dokumen pertama dibuat.
async function main() {
  console.log("🧹 Membersihkan SEMUA data bisnis, kecuali akun login...\n");

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

  // Modul Non-Gudang.
  await prisma.ngPayment.deleteMany();
  await prisma.ngInvoiceItem.deleteMany();
  await prisma.ngInvoice.deleteMany();
  await prisma.ngProduk.deleteMany();
  await prisma.ngKonsumen.deleteMany();

  // Counter bukan akun login; hapus agar database hanya menyisakan users.
  await prisma.counter.deleteMany();

  // Hasil mutasi tersimpan untuk retry (AUD-003); tidak berarti tanpa transaksinya.
  await prisma.idempotencyKey.deleteMany();

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
    ngProduk: await prisma.ngProduk.count(),
    ngKonsumen: await prisma.ngKonsumen.count(),
    ngInvoices: await prisma.ngInvoice.count(),
    ngPayments: await prisma.ngPayment.count(),
    activityLogs: await prisma.activityLog.count(),
    counters: await prisma.counter.count(),
    idempotencyKeys: await prisma.idempotencyKey.count(),
  };

  console.log("✅ Selesai. Sisa data:");
  console.table(summary);
  console.log("\nAkun login dipertahankan.");
}

main()
  .catch((e) => {
    console.error("❌ Gagal membersihkan:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
