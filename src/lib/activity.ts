import { prisma } from "@/lib/prisma";

export async function logActivity(input: {
  userId?: number;
  aksi: string;
  entitas: string;
  entitasId?: string | number;
  detail?: unknown;
}) {
  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      aksi: input.aksi,
      entitas: input.entitas,
      entitasId: input.entitasId != null ? String(input.entitasId) : null,
      detail: input.detail != null ? JSON.stringify(input.detail) : null,
    },
  });
}
