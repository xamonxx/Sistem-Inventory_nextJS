"use server";

import { revalidatePath } from "next/cache";
import { NgPaymentType, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { invalidateAfterCommit } from "@/lib/postCommit";
import {
  findStoredResult,
  idempotencyKeySchema,
  IdempotencyMismatchError,
  recoverStoredResult,
  storeResult,
} from "@/lib/idempotency";
import { computeNgCart } from "@/lib/ngMargin";
import { prisma } from "@/lib/prisma";
import { dbId, firstIssue, money, optionalText, qtyPositive, requiredText, safeError } from "@/lib/validation";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

const bayarNgSchema = z.object({
  invoiceId: dbId,
  jumlah: money.refine((n) => n > 0, "Jumlah bayar harus lebih dari 0."),
  tipe: z.nativeEnum(NgPaymentType),
  tanggal: z.coerce.date().optional(),
  keterangan: optionalText(FIELD_LIMITS.keterangan, "Keterangan"),
  idempotencyKey: idempotencyKeySchema,
});

export type BayarNgInvoiceInput = {
  invoiceId: number;
  jumlah: number;
  tipe?: "CASH" | "TRANSFER";
  tanggal?: string;
  keterangan?: string;
  idempotencyKey?: string;
};

type BayarNgCommitted = {
  ok: true;
  status: "PARTIAL" | "LUNAS";
  totalDibayar: number;
  sisa: number;
  payment: { id: number; tanggal: string; tipe: NgPaymentType; jumlah: number; keterangan: string };
};

/**
 * Catat pembayaran/cicilan piutang konsumen untuk invoice non-gudang (tempo).
 * Guard: tolak invoice sudah lunas, dan jumlah dibatasi ke sisa piutang (anti-overpay).
 * Status naik otomatis: PENDING → PARTIAL → LUNAS. Mirror `bayarInvoice` (domain gudang).
 */
export async function bayarNgInvoice(input: BayarNgInvoiceInput) {
  const user = await requireRole("ADMIN_NONGUDANG");

  const parsed = bayarNgSchema.safeParse({
    invoiceId: input.invoiceId,
    jumlah: input.jumlah,
    tipe: input.tipe ?? "CASH",
    tanggal: input.tanggal,
    keterangan: input.keterangan,
    idempotencyKey: input.idempotencyKey,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const data = parsed.data;

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Retry of an already committed payment: return it instead of paying twice.
      const stored = await findStoredResult<BayarNgCommitted>(tx, data.idempotencyKey, "ng_bayar", user.id);
      if (stored) return { ...stored, replayed: true };

      const inv = await tx.ngInvoice.findUnique({
        where: { id: data.invoiceId },
        select: { id: true, noInvoice: true, totalPenjualan: true, totalDibayar: true },
      });
      if (!inv) return { ok: false as const, error: "Invoice non-gudang tidak ditemukan." };

      const total = new Prisma.Decimal(inv.totalPenjualan);
      const sudah = new Prisma.Decimal(inv.totalDibayar);
      const sisa = total.sub(sudah);
      if (sisa.lte(0)) return { ok: false as const, error: "Invoice ini sudah lunas." };

      // Anti-overpay: batasi pembayaran ke sisa piutang berdasarkan nilai
      // terbaru yang dibaca di dalam transaksi serializable.
      const bayar = Prisma.Decimal.min(new Prisma.Decimal(data.jumlah), sisa);
      const totalDibayar = sudah.add(bayar);
      const lunas = totalDibayar.gte(total);
      const status: "PARTIAL" | "LUNAS" = lunas ? "LUNAS" : "PARTIAL";

      await tx.ngInvoice.update({
        where: { id: data.invoiceId },
        data: { totalDibayar, status },
      });

      const payment = await tx.ngPayment.create({
        data: {
          invoiceId: data.invoiceId,
          tanggal: data.tanggal ?? new Date(),
          tipe: data.tipe,
          jumlah: bayar,
          keterangan: data.keterangan || `Pembayaran cicilan untuk ${inv.noInvoice}`,
          userId: user.id,
        },
      });

      // Audit row commits atomically with the payment.
      await logActivity({
        userId: user.id,
        aksi: "BAYAR_NG_INVOICE",
        entitas: "NgInvoice",
        entitasId: data.invoiceId,
        detail: { noInvoice: inv.noInvoice, bayar: Number(bayar), lunas, tipe: data.tipe },
      }, tx);

      const committed: BayarNgCommitted = {
        ok: true,
        status,
        totalDibayar: Number(totalDibayar),
        sisa: Number(total.sub(totalDibayar)),
        payment: {
          id: payment.id,
          tanggal: payment.tanggal.toISOString(),
          tipe: payment.tipe,
          jumlah: Number(payment.jumlah),
          keterangan: payment.keterangan ?? "",
        },
      };
      await storeResult(tx, data.idempotencyKey, "ng_bayar", user.id, committed);
      return { ...committed, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof IdempotencyMismatchError) return { error: error.message };
    // A concurrent request with the same key may have committed first.
    const recovered = await recoverStoredResult<BayarNgCommitted>(data.idempotencyKey, "ng_bayar", user.id);
    if (!recovered) return safeError(error, "Gagal memproses pembayaran non-gudang.");
    result = { ...recovered, replayed: true };
  }

  if (!result.ok) return { error: result.error };

  // Committed. Cache invalidation is best-effort and cannot report a failure.
  invalidateAfterCommit({ paths: ["/non-gudang/invoice", "/non-gudang"] });

  return result;
}

const DB_PERCENT_MAX = 9999.99;

function percentDecimalForDb(value: number) {
  return new Prisma.Decimal(Math.min(DB_PERCENT_MAX, Math.max(0, value)));
}

const updateNgInvoiceSchema = z.object({
  invoiceId: dbId,
  tanggal: z.coerce.date(),
  namaKonsumen: optionalText(FIELD_LIMITS.namaClient, "Nama konsumen"),
  namaGrup: optionalText(FIELD_LIMITS.projectGroupNama, "Nama grup"),
  alamat: optionalText(FIELD_LIMITS.alamat, "Alamat"),
  namaWorkshop: optionalText(FIELD_LIMITS.namaWs, "Nama workshop"),
  paymentMethod: z.nativeEnum(NgPaymentType),
  namaBank: optionalText(FIELD_LIMITS.namaBank, "Nama bank"),
  noRekening: optionalText(FIELD_LIMITS.noRekening, "Nomor rekening"),
  atasNama: optionalText(FIELD_LIMITS.atasNama, "Atas nama"),
  items: z
    .array(
      z.object({
        produkId: dbId.nullish(),
        nama: requiredText(FIELD_LIMITS.namaBarang, "Nama barang"),
        hargaBeli: money,
        hargaJual: money,
        qty: qtyPositive,
      })
    )
    .min(1, "Minimal 1 barang pada invoice."),
});

export type UpdateNgInvoiceInput = {
  invoiceId: number;
  tanggal: string;
  namaKonsumen?: string;
  namaGrup?: string;
  alamat?: string;
  namaWorkshop?: string;
  paymentMethod: "CASH" | "TRANSFER";
  namaBank?: string;
  noRekening?: string;
  atasNama?: string;
  items: { produkId?: number | null; nama: string; hargaBeli: number; hargaJual: number; qty: number }[];
};

/**
 * Edit invoice non-gudang: metadata konsumen/pembayaran + rincian barang.
 * Karena tanpa stok gudang, item cukup dihapus & dibuat ulang (snapshot) lalu
 * total/margin dihitung ulang. GUARD: total penjualan baru tidak boleh lebih
 * kecil dari yang sudah dibayar (anti-corrupt piutang). Status & jatuh tempo
 * disinkronkan; catatan pembayaran (NgPayment) tidak diubah.
 */
export async function updateNgInvoice(input: UpdateNgInvoiceInput) {
  const user = await requireRole("ADMIN_NONGUDANG");

  const parsed = updateNgInvoiceSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const data = parsed.data;

  if (data.paymentMethod === "TRANSFER" && !(data.namaBank && data.noRekening && data.atasNama)) {
    return { error: "Nama bank, nomor rekening, dan atas nama wajib diisi untuk metode transfer." };
  }

  if (data.items.some((it) => it.qty > FIELD_LIMITS.maxQty)) {
    return { error: "Qty barang terlalu besar." };
  }
  if (data.items.some((it) => it.hargaJual < it.hargaBeli)) {
    return { error: "Harga jual tidak boleh lebih kecil dari harga beli." };
  }

  const inv = await prisma.ngInvoice.findUnique({
    where: { id: data.invoiceId },
    select: { id: true, noInvoice: true, namaToko: true, totalDibayar: true, jatuhTempo: true },
  });
  if (!inv) return { error: "Invoice non-gudang tidak ditemukan." };

  const computed = computeNgCart(
    data.items.map((it) => ({
      produkId: it.produkId ?? undefined,
      nama: it.nama,
      namaToko: inv.namaToko,
      hargaBeli: it.hargaBeli,
      hargaJual: it.hargaJual,
      qty: it.qty,
    }))
  );

  const totalPenjualan = new Prisma.Decimal(computed.totalPenjualan);
  const dibayar = new Prisma.Decimal(inv.totalDibayar);

  // GUARD: total baru tidak boleh di bawah yang sudah dibayar.
  if (totalPenjualan.lt(dibayar)) {
    return {
      error: `Total penjualan baru (${computed.totalPenjualan}) lebih kecil dari yang sudah dibayar. Kurangi pembayaran atau tambah barang terlebih dahulu.`,
    };
  }

  const lunas = dibayar.gte(totalPenjualan);
  const status: "PENDING" | "PARTIAL" | "LUNAS" = lunas ? "LUNAS" : dibayar.gt(0) ? "PARTIAL" : "PENDING";
  // Jatuh tempo: LUNAS → null; belum lunas → pertahankan yang ada, atau set +7 hari bila belum ada.
  const jatuhTempo = lunas
    ? null
    : inv.jatuhTempo ??
      new Date(data.tanggal.getFullYear(), data.tanggal.getMonth(), data.tanggal.getDate() + 7);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ngInvoiceItem.deleteMany({ where: { invoiceId: inv.id } });

      await tx.ngInvoice.update({
        where: { id: inv.id },
        data: {
          tanggal: data.tanggal,
          status,
          jatuhTempo,
          namaKonsumen: data.namaKonsumen || null,
          namaGrup: data.namaGrup || null,
          alamat: data.alamat || null,
          namaWorkshop: data.namaWorkshop || null,
          namaBank: data.paymentMethod === "TRANSFER" ? data.namaBank || null : null,
          noRekening: data.paymentMethod === "TRANSFER" ? data.noRekening || null : null,
          atasNama: data.paymentMethod === "TRANSFER" ? data.atasNama || null : null,
          totalModal: new Prisma.Decimal(computed.totalModal),
          totalPenjualan,
          totalProfit: new Prisma.Decimal(computed.totalProfit),
          margin: percentDecimalForDb(computed.margin),
          markup: percentDecimalForDb(computed.markup),
          items: {
            create: computed.lines.map((line) => ({
              produkId: line.produkId ?? null,
              namaSnapshot: line.nama,
              namaTokoSnapshot: inv.namaToko,
              hargaBeliSnapshot: new Prisma.Decimal(line.hargaBeli),
              hargaJualSnapshot: new Prisma.Decimal(line.hargaJual),
              qty: line.qty,
              subtotalModal: new Prisma.Decimal(line.subtotalModal),
              subtotalPenjualan: new Prisma.Decimal(line.subtotalPenjualan),
              subtotalProfit: new Prisma.Decimal(line.subtotalProfit),
            })),
          },
        },
      });
    });

    const updated = await prisma.ngInvoice.findUniqueOrThrow({
      where: { id: inv.id },
      select: {
        id: true,
        noInvoice: true,
        tanggal: true,
        status: true,
        namaToko: true,
        jatuhTempo: true,
        namaKonsumen: true,
        namaGrup: true,
        alamat: true,
        namaWorkshop: true,
        namaBank: true,
        noRekening: true,
        atasNama: true,
        totalModal: true,
        totalPenjualan: true,
        totalProfit: true,
        margin: true,
        markup: true,
        totalDibayar: true,
        items: {
          select: {
            id: true,
            namaSnapshot: true,
            namaTokoSnapshot: true,
            hargaBeliSnapshot: true,
            hargaJualSnapshot: true,
            qty: true,
            subtotalModal: true,
            subtotalPenjualan: true,
            subtotalProfit: true,
          },
        },
        payments: {
          orderBy: { id: "desc" },
          select: { id: true, tanggal: true, tipe: true, jumlah: true, keterangan: true },
        },
      },
    });

    await logActivity({
      userId: user.id,
      aksi: "UPDATE_NG_INVOICE",
      entitas: "NgInvoice",
      entitasId: inv.id,
      detail: {
        noInvoice: inv.noInvoice,
        totalPenjualan: computed.totalPenjualan,
        totalProfit: computed.totalProfit,
        itemCount: computed.lines.length,
        status,
      },
    });

    revalidatePath("/non-gudang/invoice");
    revalidatePath("/non-gudang");

    const totPenjualan = Number(updated.totalPenjualan);
    const totDibayar = Number(updated.totalDibayar);

    return {
      ok: true as const,
      row: {
        id: updated.id,
        noInvoice: updated.noInvoice,
        tanggal: updated.tanggal.toISOString(),
        status: updated.status,
        namaToko: updated.namaToko,
        jatuhTempo: updated.jatuhTempo?.toISOString() ?? null,
        namaKonsumen: updated.namaKonsumen ?? "",
        namaGrup: updated.namaGrup ?? "",
        alamat: updated.alamat ?? "",
        namaWorkshop: updated.namaWorkshop ?? "",
        namaBank: updated.namaBank ?? "",
        noRekening: updated.noRekening ?? "",
        atasNama: updated.atasNama ?? "",
        totalModal: Number(updated.totalModal),
        totalPenjualan: totPenjualan,
        totalProfit: Number(updated.totalProfit),
        margin: Number(updated.margin),
        markup: Number(updated.markup),
        totalDibayar: totDibayar,
        sisa: totPenjualan - totDibayar,
        items: updated.items.map((it) => ({
          id: it.id,
          nama: it.namaSnapshot,
          namaToko: it.namaTokoSnapshot ?? updated.namaToko,
          hargaBeli: Number(it.hargaBeliSnapshot),
          hargaJual: Number(it.hargaJualSnapshot),
          qty: it.qty,
          subtotalModal: Number(it.subtotalModal),
          subtotalPenjualan: Number(it.subtotalPenjualan),
          subtotalProfit: Number(it.subtotalProfit),
        })),
        payments: updated.payments.map((p) => ({
          id: p.id,
          tanggal: p.tanggal.toISOString(),
          tipe: p.tipe,
          jumlah: Number(p.jumlah),
          keterangan: p.keterangan ?? "",
        })),
      },
    };
  } catch (error) {
    return safeError(error, "Gagal mengubah invoice non-gudang.");
  }
}
