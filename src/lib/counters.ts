import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

const CONFIG: Record<string, { prefix: string; pad: number }> = {
  transaksi: { prefix: "PC", pad: 5 },
  return: { prefix: "RET-", pad: 5 },
  invoice: { prefix: "INV-", pad: 5 },
  ng_invoice: { prefix: "NG-", pad: 5 },
};

/**
 * Generate nomor dokumen berurutan & transaksional (anti-bentrok).
 * HARUS dipanggil di dalam prisma.$transaction.
 */
export async function nextDocNumber(tx: TxClient, id: keyof typeof CONFIG): Promise<string> {
  const cfg = CONFIG[id];
  const counter = await tx.counter.upsert({
    where: { id },
    create: { id, prefix: cfg.prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${cfg.prefix}${String(counter.value).padStart(cfg.pad, "0")}`;
}
