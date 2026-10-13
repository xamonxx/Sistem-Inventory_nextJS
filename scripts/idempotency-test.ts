/**
 * DB-backed regression for src/lib/idempotency.ts (AUD-003).
 * Jalankan: npm run test:idempotency  (butuh DATABASE_URL lokal; hanya menulis
 * baris uji di tabel idempotency_keys lalu menghapusnya kembali).
 */
import { prisma } from "../src/lib/prisma";
import {
  findStoredResult,
  IdempotencyMismatchError,
  recoverStoredResult,
  storeResult,
} from "../src/lib/idempotency";

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

const RUN = `test-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const USER_ID = -1; // tidak ada user dengan id negatif; tanpa FK sehingga aman untuk uji

async function commitOnce(key: string, value: number) {
  return prisma.$transaction(async (tx) => {
    const stored = await findStoredResult<{ value: number }>(tx, key, "checkout", USER_ID);
    if (stored) return { ...stored, replayed: true };
    const committed = { value };
    await storeResult(tx, key, "checkout", USER_ID, committed);
    return { ...committed, replayed: false };
  });
}

async function main() {
  console.log("\n=== idempotency (DB) ===");

  const k1 = `${RUN}-a`;
  const first = await commitOnce(k1, 1);
  const retry = await commitOnce(k1, 2);
  ok("commit pertama tersimpan, bukan replay", first.value === 1 && !first.replayed);
  ok("retry dengan key sama mengembalikan hasil pertama", retry.value === 1 && retry.replayed);

  const k2 = `${RUN}-b`;
  const settled = await Promise.allSettled([commitOnce(k2, 10), commitOnce(k2, 20)]);
  const fulfilled = settled.filter((s) => s.status === "fulfilled").length;
  const rows = await prisma.idempotencyKey.count({ where: { key: k2 } });
  const recovered = await recoverStoredResult<{ value: number }>(k2, "checkout", USER_ID);
  ok("dua commit bersamaan: tepat satu baris tersimpan", rows === 1);
  ok("request yang kalah bisa memulihkan hasil pemenang", fulfilled >= 1 && recovered != null);

  let mismatch = false;
  try {
    await prisma.$transaction((tx) => findStoredResult(tx, k1, "bayar_invoice", USER_ID));
  } catch (e) {
    mismatch = e instanceof IdempotencyMismatchError;
  }
  ok("key dipakai untuk scope lain ditolak", mismatch);

  ok("tanpa key tidak ada replay", (await prisma.$transaction((tx) => findStoredResult(tx, undefined, "checkout", USER_ID))) === null);
}

main()
  .catch((e) => {
    failed++;
    console.error(e);
  })
  .finally(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { key: { startsWith: RUN } } });
    await prisma.$disconnect();
    console.log(`\n  LULUS : ${passed}\n  GAGAL : ${failed}\n`);
    if (failed > 0) process.exit(1);
  });
