import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ActivityDb = PrismaClient | Prisma.TransactionClient;

/**
 * Tulis audit log. Untuk mutasi domain, kirim `tx` dari `prisma.$transaction`
 * agar log ikut commit/rollback bersama data (tidak ada mutasi tanpa log, dan
 * kegagalan log tidak terjadi setelah data sudah tersimpan).
 */
export async function logActivity(
  input: {
    userId?: number;
    aksi: string;
    entitas: string;
    entitasId?: string | number;
    detail?: unknown;
  },
  db: ActivityDb = prisma
) {
  await db.activityLog.create({
    data: {
      userId: input.userId,
      aksi: input.aksi,
      entitas: input.entitas,
      entitasId: input.entitasId != null ? String(input.entitasId) : null,
      detail: input.detail != null ? JSON.stringify(input.detail) : null,
    },
  });
}
