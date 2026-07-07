"use server";

import { revalidatePath } from "next/cache";
import { NgPaymentType, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { nextDocNumber } from "@/lib/counters";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { logActivity } from "@/lib/activity";
import { computeNgCart } from "@/lib/ngMargin";
import { prisma } from "@/lib/prisma";
import { dbId, firstIssue, money, optionalText, qtyPositive, requiredText, safeError } from "@/lib/validation";

const createNgInvoiceSchema = z
  .object({
    tanggal: z.coerce.date(),
    namaToko: requiredText(FIELD_LIMITS.supplierName, "Toko sumber"),
    namaKonsumen: optionalText(FIELD_LIMITS.namaClient, "Nama konsumen"),
    namaGrup: optionalText(FIELD_LIMITS.projectGroupNama, "Nama grup"),
    alamat: optionalText(FIELD_LIMITS.alamat, "Alamat"),
    namaWorkshop: optionalText(FIELD_LIMITS.namaWs, "Nama workshop"),
    paymentStatus: z.enum(["LUNAS", "TEMPO"]),
    paymentMethod: z.nativeEnum(NgPaymentType),
    namaBank: optionalText(FIELD_LIMITS.namaBank, "Nama bank"),
    noRekening: optionalText(FIELD_LIMITS.noRekening, "Nomor rekening"),
    atasNama: optionalText(FIELD_LIMITS.atasNama, "Atas nama"),
    items: z.array(z.object({ produkId: dbId, qty: qtyPositive })).min(1, "Keranjang CO masih kosong."),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === "TRANSFER") {
      if (!data.namaBank) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["namaBank"], message: "Nama bank wajib diisi untuk metode transfer." });
      }
      if (!data.noRekening) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["noRekening"], message: "Nomor rekening wajib diisi untuk metode transfer." });
      }
      if (!data.atasNama) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["atasNama"], message: "Atas nama wajib diisi untuk metode transfer." });
      }
    }
  });

const resolveNgProductSchema = z
  .object({
    tokoSumber: requiredText(FIELD_LIMITS.supplierName, "Toko sumber"),
    nama: requiredText(FIELD_LIMITS.namaBarang, "Nama barang"),
    kategori: optionalText(40, "Kategori"),
    satuan: optionalText(20, "Satuan"),
    hargaBeli: money,
    hargaJual: money,
    qty: qtyPositive,
    forceUpdate: z.boolean().optional().default(false),
  })
  .refine((data) => data.hargaJual >= data.hargaBeli, {
    message: "Harga jual tidak boleh lebih kecil dari harga beli.",
    path: ["hargaJual"],
  });

type CreateNgInvoiceInput = {
  tanggal: string;
  namaToko: string;
  namaKonsumen: string;
  namaGrup: string;
  alamat: string;
  namaWorkshop: string;
  paymentStatus: "LUNAS" | "TEMPO";
  paymentMethod: "CASH" | "TRANSFER";
  namaBank: string;
  noRekening: string;
  atasNama: string;
  items: { produkId: number; qty: number }[];
};

const DB_PERCENT_MAX = 9999.99;

function percentDecimalForDb(value: number) {
  return new Prisma.Decimal(Math.min(DB_PERCENT_MAX, Math.max(0, value)));
}

function mergeInvoiceItems(items: { produkId: number; qty: number }[]) {
  const merged = new Map<number, number>();

  for (const item of items) {
    merged.set(item.produkId, (merged.get(item.produkId) ?? 0) + item.qty);
  }

  return Array.from(merged, ([produkId, qty]) => ({ produkId, qty }));
}

export async function createNgInvoice(input: CreateNgInvoiceInput) {
  const user = await requireRole("ADMIN_NONGUDANG");

  const parsed = createNgInvoiceSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const data = parsed.data;

  const invoiceItems = mergeInvoiceItems(data.items);
  if (invoiceItems.some((item) => item.qty > FIELD_LIMITS.maxQty)) {
    return { error: "Qty barang terlalu besar." };
  }

  const productIds = invoiceItems.map((item) => item.produkId);
  const products = await prisma.ngProduk.findMany({
    where: { id: { in: productIds }, aktif: true },
    select: {
      id: true,
      nama: true,
      namaToko: true,
      hargaBeli: true,
      hargaJual: true,
    },
  });

  if (products.length !== productIds.length) {
    return { error: "Sebagian barang non-gudang tidak ditemukan atau sudah nonaktif." };
  }

  if (products.some((product) => product.namaToko !== data.namaToko)) {
    return { error: "Semua barang di CO harus berasal dari toko sumber yang sama." };
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const computed = computeNgCart(
    invoiceItems.map((item) => {
      const product = productMap.get(item.produkId)!;
      return {
        produkId: product.id,
        nama: product.nama,
        namaToko: product.namaToko,
        hargaBeli: Number(product.hargaBeli),
        hargaJual: Number(product.hargaJual),
        qty: item.qty,
      };
    })
  );

  const dueDate =
    data.paymentStatus === "TEMPO"
      ? new Date(data.tanggal.getFullYear(), data.tanggal.getMonth(), data.tanggal.getDate() + 7)
      : null;

  const totalPenjualan = new Prisma.Decimal(computed.totalPenjualan);
  const totalDibayar = data.paymentStatus === "LUNAS" ? totalPenjualan : new Prisma.Decimal(0);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const noInvoice = await nextDocNumber(tx, "ng_invoice");

      const invoice = await tx.ngInvoice.create({
        data: {
          noInvoice,
          tanggal: data.tanggal,
          status: data.paymentStatus === "LUNAS" ? "LUNAS" : "PENDING",
          namaToko: data.namaToko,
          jatuhTempo: dueDate,
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
          totalDibayar,
          userId: user.id,
          items: {
            create: computed.lines.map((line) => ({
              produkId: line.produkId,
              namaSnapshot: line.nama,
              namaTokoSnapshot: line.namaToko,
              hargaBeliSnapshot: new Prisma.Decimal(line.hargaBeli),
              hargaJualSnapshot: new Prisma.Decimal(line.hargaJual),
              qty: line.qty,
              subtotalModal: new Prisma.Decimal(line.subtotalModal),
              subtotalPenjualan: new Prisma.Decimal(line.subtotalPenjualan),
              subtotalProfit: new Prisma.Decimal(line.subtotalProfit),
            })),
          },
        },
        include: {
          items: true,
          payments: true,
        },
      });

      if (data.paymentStatus === "LUNAS") {
        await tx.ngPayment.create({
          data: {
            invoiceId: invoice.id,
            tanggal: data.tanggal,
            tipe: data.paymentMethod,
            jumlah: totalPenjualan,
            keterangan: `Pelunasan awal untuk ${invoice.noInvoice}`,
            userId: user.id,
          },
        });
      }

      return invoice;
    });

    await logActivity({
      userId: user.id,
      aksi: "CREATE_NG_INVOICE",
      entitas: "NgInvoice",
      entitasId: created.id,
      detail: {
        noInvoice: created.noInvoice,
        namaToko: created.namaToko,
        namaKonsumen: created.namaKonsumen,
        totalPenjualan: computed.totalPenjualan,
        totalProfit: computed.totalProfit,
        itemCount: computed.lines.length,
      },
    });

    revalidatePath("/non-gudang");
    revalidatePath("/non-gudang/buat-invoice");
    revalidatePath("/non-gudang/invoice");

    return {
      ok: true,
      invoice: {
        id: created.id,
        noInvoice: created.noInvoice,
        tanggal: created.tanggal.toISOString(),
        namaToko: created.namaToko,
        namaKonsumen: created.namaKonsumen ?? "",
        namaGrup: created.namaGrup ?? "",
        alamat: created.alamat ?? "",
        namaWorkshop: created.namaWorkshop ?? "",
        status: created.status,
        jatuhTempo: created.jatuhTempo?.toISOString() ?? null,
        paymentMethod: data.paymentMethod,
        totalModal: computed.totalModal,
        totalPenjualan: computed.totalPenjualan,
        totalProfit: computed.totalProfit,
        margin: computed.margin,
        markup: computed.markup,
        items: computed.lines,
        namaBank: created.namaBank ?? "",
        noRekening: created.noRekening ?? "",
        atasNama: created.atasNama ?? "",
      },
    };
  } catch (error) {
    return safeError(error, "Gagal membuat invoice non-gudang.");
  }
}

export async function resolveNgProductForCart(input: {
  tokoSumber: string;
  nama: string;
  kategori?: string;
  satuan?: string;
  hargaBeli: number;
  hargaJual: number;
  qty: number;
  forceUpdate?: boolean;
}) {
  await requireRole("ADMIN_NONGUDANG");

  const parsed = resolveNgProductSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const data = parsed.data;

  try {
    const existing = await prisma.ngProduk.findFirst({
      where: {
        aktif: true,
        namaToko: data.tokoSumber,
        nama: data.nama,
      },
      select: {
        id: true,
        nama: true,
        namaToko: true,
        kategori: true,
        satuan: true,
        hargaBeli: true,
        hargaJual: true,
      },
    });

    const differs =
      !!existing &&
      (Number(existing.hargaBeli) !== data.hargaBeli ||
        Number(existing.hargaJual) !== data.hargaJual ||
        (existing.kategori ?? "") !== (data.kategori || "") ||
        (existing.satuan ?? "") !== (data.satuan || ""));

    if (existing && differs && !data.forceUpdate) {
      return {
        conflict: true,
        message: `Barang "${existing.nama}" sudah ada dengan harga/data berbeda. Lanjutkan untuk memperbarui data barang sebelumnya?`,
        existing: {
          id: existing.id,
          nama: existing.nama,
          namaToko: existing.namaToko,
          kategori: existing.kategori ?? "",
          satuan: existing.satuan ?? "",
          hargaBeli: Number(existing.hargaBeli),
          hargaJual: Number(existing.hargaJual),
        },
        incoming: {
          nama: data.nama,
          namaToko: data.tokoSumber,
          kategori: data.kategori || "",
          satuan: data.satuan || "",
          hargaBeli: data.hargaBeli,
          hargaJual: data.hargaJual,
          qty: data.qty,
        },
      };
    }

    const product = existing
      ? await prisma.ngProduk.update({
          where: { id: existing.id },
          data: {
            kategori: data.kategori || null,
            satuan: data.satuan || null,
            hargaBeli: new Prisma.Decimal(data.hargaBeli),
            hargaJual: new Prisma.Decimal(data.hargaJual),
          },
        })
      : await prisma.ngProduk.create({
          data: {
            nama: data.nama,
            namaToko: data.tokoSumber,
            kategori: data.kategori || null,
            satuan: data.satuan || null,
            hargaBeli: new Prisma.Decimal(data.hargaBeli),
            hargaJual: new Prisma.Decimal(data.hargaJual),
            aktif: true,
          },
        });

    revalidatePath("/non-gudang/barang");
    revalidatePath("/non-gudang/buat-invoice");

    return {
      ok: true,
      product: {
        id: product.id,
        nama: product.nama,
        namaToko: product.namaToko,
        kategori: product.kategori ?? "",
        satuan: product.satuan ?? "",
        hargaBeli: Number(product.hargaBeli),
        hargaJual: Number(product.hargaJual),
        qty: data.qty,
      },
      updatedExisting: !!existing,
    };
  } catch (error) {
    return safeError(error, "Gagal memproses barang non-gudang.");
  }
}
