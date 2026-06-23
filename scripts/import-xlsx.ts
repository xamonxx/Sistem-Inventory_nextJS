/**
 * Importer data dari KASIR MEI 2026 (1).xlsm ke database.
 * Jalankan: npx tsx scripts/import-xlsx.ts "C:/path/ke/KASIR MEI 2026 (1).xlsm"
 *
 * Mapping (berdasarkan struktur file nyata):
 *  - Sheet "Transaksi Kasir": master barang ada di kolom P..T
 *      P=KODE  Q=NAMA BARANG  R=HARGA BELI  S=HARGA JUAL  T=STOK AWAL   (mulai baris 5)
 *  - Sheet "Daftar Transaksi": transaksi keluar (penjualan) di kolom B..H
 *      B=No.Transaksi C=Tanggal(serial) D=Nama Barang E=Harga F=Banyaknya G=Jumlah H=Nama Project (mulai baris 3)
 *
 * Aturan koreksi yang diterapkan:
 *  - Tanggal serial Excel -> Date
 *  - Baris #VALUE! / tak valid -> dikarantina ke import-errors.csv (tidak diam-diam di-skip)
 *  - Nama barang dinormalisasi untuk pencocokan; kode dijaga unik
 */
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const filePath =
  process.argv[2] ?? "C:/Users/Administrator/Downloads/KASIR MEI 2026 (1).xlsm";

const errors: string[] = ["sheet,baris,alasan,data"];
function logError(sheet: string, row: number, reason: string, data: unknown) {
  errors.push(`${sheet},${row},"${reason}","${JSON.stringify(data).replace(/"/g, "'")}"`);
}

function norm(s: unknown): string {
  return String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function excelDate(serial: unknown): Date | null {
  const n = num(serial);
  if (n == null) return null;
  // serial < 60 atau angka aneh dianggap tidak valid untuk tanggal transaksi
  if (n < 1000) return null;
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
}

async function main() {
  if (!fs.existsSync(filePath)) {
    console.error(`File tidak ditemukan: ${filePath}`);
    process.exit(1);
  }

  const existing = await prisma.item.count();
  if (existing > 0) {
    console.error(
      `Database sudah berisi ${existing} barang. Importer ini untuk DB kosong. Kosongkan dulu jika ingin re-import.`
    );
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath, { cellDates: false });

  // ---------- 1) MASTER BARANG ----------
  const wsMaster = wb.Sheets["Transaksi Kasir"];
  if (!wsMaster) throw new Error("Sheet 'Transaksi Kasir' tidak ditemukan");
  const master = XLSX.utils.sheet_to_json<Record<string, unknown>>(wsMaster, {
    header: "A",
    range: 4, // mulai baris 5 (0-indexed 4)
    defval: null,
  });

  const itemByNama = new Map<string, number>();
  let kodeSeq = 0;
  let itemCount = 0;

  for (let i = 0; i < master.length; i++) {
    const r = master[i];
    const nama = r["Q"];
    if (!nama || norm(nama) === "" || norm(nama) === "0") continue; // baris kosong

    const hargaBeli = num(r["R"]) ?? 0;
    const hargaJual = num(r["S"]) ?? 0;
    const stokAwal = num(r["T"]) ?? 0;

    // kode dari kolom P; kalau numeric/duplikat, generate PC-xxxxx
    let kode = String(r["P"] ?? "").trim();
    if (!kode || /^\d+$/.test(kode)) {
      kodeSeq++;
      kode = `PC-${String(kodeSeq).padStart(5, "0")}`;
    }
    const key = norm(nama);
    if (itemByNama.has(key)) {
      logError("Transaksi Kasir", i + 5, "nama barang duplikat - dilewati", { nama });
      continue;
    }

    try {
      const created = await prisma.item.create({
        data: {
          kode,
          nama: String(nama).trim(),
          hargaBeli: new Prisma.Decimal(hargaBeli),
          hargaJual: new Prisma.Decimal(hargaJual),
          stokAwal: Math.trunc(stokAwal),
          minStok: 10,
        },
      });
      itemByNama.set(key, created.id);
      itemCount++;

      // BARANG MASUK (kolom U) -> ledger MASUK agar stok rekonsiliasi dengan Excel
      const barangMasuk = num(r["U"]) ?? 0;
      if (barangMasuk > 0) {
        await prisma.stockLedger.create({
          data: {
            itemId: created.id,
            tipe: "MASUK",
            qty: Math.trunc(barangMasuk),
            keterangan: "Impor stok masuk (kolom BARANG MASUK)",
            refType: "MANUAL",
          },
        });
      }
    } catch (e) {
      logError("Transaksi Kasir", i + 5, `gagal simpan item: ${(e as Error).message}`, { kode, nama });
    }
  }
  console.log(`Master barang terimpor: ${itemCount}`);

  // ---------- 2) TRANSAKSI KELUAR (PENJUALAN) ----------
  const wsTrx = wb.Sheets["Daftar Transaksi"];
  if (!wsTrx) throw new Error("Sheet 'Daftar Transaksi' tidak ditemukan");
  const trxRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wsTrx, {
    header: "A",
    range: 2, // mulai baris 3
    defval: null,
  });

  // Kelompokkan per No. Transaksi
  type Line = { nama: string; harga: number; qty: number; project: string; tanggal: Date | null; rowIdx: number };
  const groups = new Map<string, Line[]>();

  for (let i = 0; i < trxRows.length; i++) {
    const r = trxRows[i];
    const no = String(r["B"] ?? "").trim();
    const nama = r["D"];
    if (!no || !nama) continue;

    const harga = num(r["E"]);
    const qty = num(r["F"]);
    if (harga == null || qty == null) {
      logError("Daftar Transaksi", i + 3, "harga/qty tidak valid (mis. #VALUE!)", { no, nama, harga: r["E"], qty: r["F"] });
      continue;
    }
    const tanggal = excelDate(r["C"]);
    if (!groups.has(no)) groups.set(no, []);
    groups.get(no)!.push({
      nama: String(nama).trim(),
      harga,
      qty: Math.trunc(qty),
      project: String(r["H"] ?? "").trim(),
      tanggal,
      rowIdx: i + 3,
    });
  }

  let trxCount = 0;
  let lineCount = 0;
  let autoItem = 0;

  for (const [no, lines] of groups) {
    const tanggal = lines.find((l) => l.tanggal)?.tanggal ?? new Date();
    const project = lines.find((l) => l.project)?.project ?? "";

    try {
      await prisma.$transaction(async (tx) => {
        let grandTotal = new Prisma.Decimal(0);
        const trx = await tx.transaction.create({
          data: {
            noTransaksi: no,
            tanggal,
            tipe: project ? "PROJECT" : "RETAIL",
            namaClient: project || null,
            grandTotal: new Prisma.Decimal(0),
          },
        });

        for (const l of lines) {
          let itemId = itemByNama.get(norm(l.nama));
          // auto-create item bila nama tak cocok master (dilaporkan)
          if (!itemId) {
            kodeSeq++;
            const it = await tx.item.create({
              data: {
                kode: `PC-${String(kodeSeq).padStart(5, "0")}`,
                nama: l.nama,
                hargaBeli: new Prisma.Decimal(0),
                hargaJual: new Prisma.Decimal(l.harga),
                stokAwal: 0,
                minStok: 10,
              },
            });
            itemId = it.id;
            itemByNama.set(norm(l.nama), it.id);
            autoItem++;
            logError("Daftar Transaksi", l.rowIdx, "nama tak cocok master - item dibuat otomatis", { nama: l.nama });
          }

          const subtotal = new Prisma.Decimal(l.harga).mul(l.qty);
          grandTotal = grandTotal.add(subtotal);
          await tx.transactionItem.create({
            data: {
              transactionId: trx.id,
              itemId,
              namaSnapshot: l.nama,
              hargaSnapshot: new Prisma.Decimal(l.harga),
              hargaBeliSnapshot: new Prisma.Decimal(0),
              qty: l.qty,
              subtotal,
            },
          });
          await tx.stockLedger.create({
            data: {
              itemId,
              tanggal,
              tipe: "KELUAR",
              qty: -l.qty,
              keterangan: `Impor penjualan ${no}`,
              refType: "TRANSACTION",
              refId: trx.id,
            },
          });
          lineCount++;
        }

        await tx.transaction.update({ where: { id: trx.id }, data: { grandTotal } });
      });
      trxCount++;
    } catch (e) {
      logError("Daftar Transaksi", lines[0]?.rowIdx ?? 0, `gagal simpan transaksi ${no}: ${(e as Error).message}`, { no });
    }
  }

  // ---------- 2b) TRANSAKSI MASUK (RESTOCK) — kolom J..N ----------
  let masukCount = 0;
  for (let i = 0; i < trxRows.length; i++) {
    const r = trxRows[i];
    const nama = r["K"];
    const qty = num(r["M"]);
    if (!nama || qty == null || qty === 0) continue;
    const tanggal = excelDate(r["J"]);
    let itemId = itemByNama.get(norm(nama));
    if (!itemId) {
      kodeSeq++;
      const it = await prisma.item.create({
        data: {
          kode: `PC-${String(kodeSeq).padStart(5, "0")}`,
          nama: String(nama).trim(),
          hargaBeli: new Prisma.Decimal(num(r["L"]) ?? 0),
          hargaJual: new Prisma.Decimal(0),
          stokAwal: 0,
          minStok: 10,
        },
      });
      itemId = it.id;
      itemByNama.set(norm(nama), it.id);
      autoItem++;
      logError("Daftar Transaksi (MASUK)", i + 3, "nama tak cocok master - item dibuat otomatis", { nama });
    }
    await prisma.stockLedger.create({
      data: {
        itemId,
        tanggal: tanggal ?? new Date(),
        tipe: "MASUK",
        qty: Math.trunc(qty),
        keterangan: "Impor barang masuk",
        refType: "MANUAL",
      },
    });
    masukCount++;
  }
  console.log(`Barang masuk (restock) terimpor: ${masukCount} baris`);

  // set counter transaksi ke nomor tertinggi PCxxxxx supaya tidak bentrok
  const maxPc = [...groups.keys()]
    .map((n) => /^PC0*(\d+)$/.exec(n)?.[1])
    .filter(Boolean)
    .map((x) => parseInt(x as string))
    .reduce((a, b) => Math.max(a, b), 0);
  if (maxPc > 0) {
    await prisma.counter.upsert({
      where: { id: "transaksi" },
      create: { id: "transaksi", prefix: "PC", value: maxPc },
      update: { value: maxPc },
    });
  }

  // tulis error/karantina
  const errPath = path.join(process.cwd(), "import-errors.csv");
  fs.writeFileSync(errPath, errors.join("\n"), "utf8");

  console.log(`Transaksi terimpor: ${trxCount} (${lineCount} baris item)`);
  console.log(`Item dibuat otomatis (nama tak cocok master): ${autoItem}`);
  console.log(`Catatan error/karantina: ${errors.length - 1} baris -> ${errPath}`);
  console.log("Selesai. Cek import-errors.csv untuk direview.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
