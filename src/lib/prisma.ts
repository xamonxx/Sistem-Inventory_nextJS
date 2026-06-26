import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makePrisma(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends(withAccelerate());
  // Cast back to PrismaClient so helper functions that accept PrismaClient/TransactionClient
  // keep working — Accelerate extension is still applied at runtime.
  return client as unknown as PrismaClient;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
