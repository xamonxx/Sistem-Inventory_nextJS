import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * True when a transaction lost a concurrency race (MySQL deadlock / write
 * conflict surfaced by Prisma as P2034). Safe to retry from the start.
 */
export function isSerializationConflict(error: unknown): boolean {
  const e = (error ?? {}) as { code?: unknown; message?: unknown };
  if (e.code === "P2034") return true;
  return (
    typeof e.message === "string" &&
    /write conflict|deadlock|could not serialize|record has changed since last read/i.test(e.message)
  );
}

/**
 * Run a read-check-write as one Serializable transaction, retrying a bounded
 * number of times when it loses a concurrency race. Domain errors are not
 * retried. The callback may run more than once, so it must not have side
 * effects outside `tx`.
 */
export async function runSerializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 3
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= attempts || !isSerializationConflict(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt + Math.floor(Math.random() * 25)));
    }
  }
}
