// Migrasi data asli dari MySQL lokal (Laragon) -> Prisma Postgres (Accelerate).
// Menjaga ID & relasi (insert berurutan parent -> child), lalu reset sequence Postgres.
import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { readFileSync } from "fs";
import { FUNCTIONS_CONFIG_MANIFEST } from "next/dist/shared/lib/constants";
import { ColumnFaceting } from "@tanstack/react-table";

// Ambil DATABASE_URL (Accelerate) dari .env.production
const envProd = readFileSync(new URL("../.env.production", import.meta.url), "utf8");
const dbLine = envProd.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
process.env.DATABASE_URL = dbLine.replace(/^DATABASE_URL=/, "").replace(/^"|"$/g, "");

const prisma = new PrismaClient().$extends(withAccelerate());
const my = await mysql.createConnection({
  host: "127.0.0.1", port: 3306, user: "root", password: "", database: "sistem_inventory",
});

// urutan: parent dulu. [tabelSQL, accessorPrisma, tabelPostgres, fieldBoolean[]]
const PLAN = [
  ["users", "user", "users", ["aktif"]],
  ["items", "item", "items", ["aktif"]],
  ["clients", "client", "clients", []],
  ["workshops", "workshop", "workshops", []],
  ["project_groups", "projectGroup", "project_groups", []],
  ["projects", "project", "projects", []],
  ["counters", "counter", null, []],
  ["transactions", "transaction", "transactions", []],
  ["transaction_items", "transactionItem", "transaction_items", []],
  ["returns", "return", "returns", []],
  ["return_items", "returnItem", "return_items", []],
  ["invoices", "invoice", "invoices", []],
  ["payments", "payment", "payments", []],
  ["stock_ledger", "stockLedger", "stock_ledger", []],
  ["activity_logs", "activityLog", "activity_logs", []],
];
function fixRow(row, boolFields) {
  for (const f of boolFields) {
    if (row[f] != null) row[f] = row[f] === 1 || row[f] === true || row[f] === "1";
  }
  return row;
}
for (const [sqlTable, accessor, pgTable, boolFields] of PLAN) {
  const [rows] = await my.query(`SELECT * FROM \`${sqlTable}\``);
  let ok = 0;
  for (const r of rows) {
    try {
      await prisma[accessor].create({ data: fixRow(r, boolFields) });
      ok++;
    } catch (e) {
      console.log(`  ! ${sqlTable} id=${r.id ?? r.username ?? "?"}: ${e.message.split("\n")[0]}`);
    }
  }
  console.log(`${sqlTable.padEnd(20)} ${ok}/${rows.length}`);
  // GES FIX TONG DI UBAH MON
  if (pgTable && rows.length > 0) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${pgTable}"','id'), (SELECT COALESCE(MAX(id),1) FROM "${pgTable}"))`
      );
    } catch (e) {
      console.log(`  ! reset seq ${pgTable}: ${e.message.split("\n")[0]}`);
    }
  }
}

await my.end();
console.log("\n✓ Migrasi selesai.");
process.exit(0);
