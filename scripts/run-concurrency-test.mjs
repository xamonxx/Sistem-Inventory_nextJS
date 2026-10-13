/**
 * Runs scripts/concurrency-test.ts against a disposable local database:
 * create `sistem_inventory_conc_<timestamp>` on the same LOCAL MySQL server,
 * push the schema, run the test, then drop the database. Credentials are read
 * from .env and never printed. Refuses to run against a non-local host.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
const base = process.env.DATABASE_URL;
if (!base) throw new Error("DATABASE_URL is not set.");

const url = new URL(base);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
  throw new Error(`Refusing to run: database host is not local (${url.hostname}).`);
}
const dbName = `sistem_inventory_conc_${Date.now()}`;
url.pathname = `/${dbName}`;
const env = { ...process.env, DATABASE_URL: url.toString() };
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

let status = 1;
try {
  console.log(`Disposable database: ${dbName}`);
  execFileSync(npx, ["prisma", "db", "push", "--skip-generate"], { env, stdio: ["ignore", "ignore", "inherit"], shell: process.platform === "win32" });
  const run = spawnSync(
    process.execPath,
    ["--require", "./scripts/test-support/stub-require.cjs", "--import", "tsx", "scripts/concurrency-test.ts"],
    { env, stdio: "inherit" }
  );
  status = run.status ?? 1;
} finally {
  const drop = spawnSync(
    process.execPath,
    [
      "-e",
      `const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();` +
        `p.$executeRawUnsafe("DROP DATABASE IF EXISTS \`${dbName}\`").then(()=>console.log("Dropped ${dbName}")).finally(()=>p.$disconnect());`,
    ],
    { env, stdio: "inherit" }
  );
  if (drop.status !== 0) console.error(`WARNING: could not drop ${dbName}; drop it manually.`);
}
process.exit(status);
