import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash("password", 10);

  await prisma.user.upsert({
    where: { username: "kasir" },
    update: {},
    create: { username: "kasir", nama: "Admin Kasir", password: pass, role: "ADMIN_KASIR" },
  });
  await prisma.user.upsert({
    where: { username: "gudang" },
    update: {},
    create: { username: "gudang", nama: "Admin Gudang", password: pass, role: "ADMIN_GUDANG" },
  });

  console.log("Seed selesai. Login: kasir/password atau gudang/password");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
