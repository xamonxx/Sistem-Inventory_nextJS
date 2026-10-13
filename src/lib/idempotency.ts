import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * Idempotensi untuk mutasi yang membuat uang/stok baru (AUD-003).
 *
 * Client mengirim key acak per percobaan dan memakai key yang sama saat retry
 * setelah respons ambigu (mis. koneksi putus). Hasil mutasi disimpan di
 * transaksi yang sama dengan datanya, jadi retry mengembalikan hasil tersimpan
 * dan tidak membuat transaksi/pembayaran ganda.
 */

export type IdempotencyScope = "checkout" | "bayar_invoice" | "retur" | "ng_invoice" | "ng_bayar";

export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9-]{16,64}$/, "Kunci permintaan tidak valid.")
  .optional();

export class IdempotencyMismatchError extends Error {
  constructor() {
    super("Kunci permintaan sudah dipakai untuk aksi lain. Muat ulang halaman lalu coba lagi.");
    this.name = "IdempotencyMismatchError";
  }
}

type Db = Prisma.TransactionClient | typeof prisma;

async function readStored<T>(db: Db, key: string, scope: IdempotencyScope, userId: number): Promise<T | null> {
  const row = await db.idempotencyKey.findUnique({ where: { key } });
  if (!row) return null;
  if (row.scope !== scope || row.userId !== userId) throw new IdempotencyMismatchError();
  return JSON.parse(row.response) as T;
}

/** Inside the transaction, before any write: the stored result of an earlier commit, if any. */
export async function findStoredResult<T>(
  tx: Prisma.TransactionClient,
  key: string | undefined,
  scope: IdempotencyScope,
  userId: number
): Promise<T | null> {
  return key ? readStored<T>(tx, key, scope, userId) : null;
}

/** Inside the transaction, after the writes: persist the JSON-safe result under the key. */
export async function storeResult(
  tx: Prisma.TransactionClient,
  key: string | undefined,
  scope: IdempotencyScope,
  userId: number,
  response: unknown
): Promise<void> {
  if (!key) return;
  await tx.idempotencyKey.create({
    data: { key, scope, userId, response: JSON.stringify(response) },
  });
}

/**
 * After a failed transaction: a concurrent request with the same key may have
 * committed first (unique key / serialization conflict). Return its result.
 */
export async function recoverStoredResult<T>(
  key: string | undefined,
  scope: IdempotencyScope,
  userId: number
): Promise<T | null> {
  if (!key) return null;
  try {
    return await readStored<T>(prisma, key, scope, userId);
  } catch {
    return null;
  }
}
