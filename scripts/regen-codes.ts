/**
 * Regenerate kode SEMUA barang ke format PC-{PREFIX}-{NNN}.
 * Dry-run (lihat hasil tanpa simpan):  npm run db:regen-codes
 * Terapkan ke database:                npm run db:regen-codes -- --apply
 */
import { PrismaClient } from "@prisma/client";
import { itemCodePrefix } from "../src/lib/itemCode";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const items = await prisma.item.findMany({ orderBy: { id: "asc" } });

  const seqByPrefix = new Map<string, number>();
  const mapping: { id: number; nama: string; old: string; baru: string }[] = [];

  for (const it of items) {
    const prefix = itemCodePrefix(it.nama);
    const n = (seqByPrefix.get(prefix) ?? 0) + 1;
    seqByPrefix.set(prefix, n);
    const baru = `PC-${prefix}-${String(n).padStart(3, "0")}`;
    mapping.push({ id: it.id, nama: it.nama, old: it.kode, baru });
  }

  console.log(`${APPLY ? "🟢 TERAPKAN" : "🔍 DRY-RUN"} — ${items.length} barang\n`);
  for (const m of mapping) {
    console.log(`${m.old.padEnd(12)} -> ${m.baru.padEnd(12)}  ${m.nama}`);
  }

  // Ringkasan grup prefix
  console.log("\nGrup prefix:");
  for (const [p, n] of [...seqByPrefix.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  PC-${p}-*  : ${n} barang`);
  }

  if (!APPLY) {
    console.log("\n(DRY-RUN) Tidak ada perubahan disimpan. Jalankan dengan --apply untuk menyimpan.");
    return;
  }

  // Terapkan dalam transaksi. Kode baru (PC-XXX-NNN) tidak bertabrakan dgn kode lama.
  await prisma.$transaction(
    mapping.map((m) =>
      prisma.item.update({ where: { id: m.id }, data: { kode: m.baru } })
    )
  );
  console.log(`\n✅ ${mapping.length} kode barang berhasil diperbarui.`);
}

main()
  .catch((e) => {
    console.error("❌ Gagal regen kode:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
