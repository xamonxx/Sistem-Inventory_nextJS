"use server";

import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const searchSchema = z.object({
  query: z.string().min(1).max(80).trim(),
});

export type SearchResult = {
  id: number;
  type: "item" | "invoice" | "client" | "project";
  title: string;
  subtitle: string;
  link: string;
};

/**
 * Search scoped to the gudang (warehouse/retail) domain — Item, Invoice,
 * Client, Project. Item results are gudang-only (linked to /barang, which
 * is gated to ADMIN_GUDANG), so they're omitted for ADMIN_KASIR to avoid
 * dead-end "Akses Ditolak" links.
 */
async function searchGudang(q: string, role: Role): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  if (role === "ADMIN_GUDANG") {
    const items = await prisma.item.findMany({
      where: {
        OR: [{ nama: { contains: q } }, { kode: { contains: q } }],
      },
      take: 4,
    });
    items.forEach((it) => {
      results.push({
        id: it.id,
        type: "item",
        title: it.nama,
        subtitle: `Barang • SKU: ${it.kode} • Harga: Rp ${Number(it.hargaJual).toLocaleString("id-ID")}`,
        link: `/barang?id=${it.id}`,
      });
    });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [{ noInvoice: { contains: q } }, { namaClient: { contains: q } }],
    },
    take: 4,
  });
  invoices.forEach((inv) => {
    results.push({
      id: inv.id,
      type: "invoice",
      title: inv.noInvoice,
      subtitle: `Invoice • Klien: ${inv.namaClient ?? "Pelanggan Umum"} • Total: Rp ${Number(inv.total).toLocaleString("id-ID")}`,
      link: `/invoice?id=${inv.id}`,
    });
  });

  const clients = await prisma.client.findMany({
    where: { nama: { contains: q } },
    take: 3,
  });
  clients.forEach((c) => {
    results.push({
      id: c.id,
      type: "client",
      title: c.nama,
      subtitle: `Klien/Customer • Alamat: ${c.alamat ?? "—"}`,
      link: `/invoice?client=${encodeURIComponent(c.nama)}`,
    });
  });

  const projects = await prisma.project.findMany({
    where: { nama: { contains: q } },
    take: 3,
  });
  projects.forEach((p) => {
    results.push({
      id: p.id,
      type: "project",
      title: p.nama,
      subtitle: `Proyek Konstruksi`,
      link: `/invoice?project=${encodeURIComponent(p.nama)}`,
    });
  });

  return results;
}

/**
 * Search scoped to the non-gudang (trading/reseller) domain — NgProduk,
 * NgInvoice, NgKonsumen. Entirely separate tables from the gudang domain
 * (see prisma/schema.prisma), so this must not fall through to searchGudang.
 */
async function searchNonGudang(q: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  const produk = await prisma.ngProduk.findMany({
    where: {
      OR: [
        { nama: { contains: q } },
        { namaToko: { contains: q } },
        { kategori: { contains: q } },
      ],
    },
    take: 4,
  });
  produk.forEach((p) => {
    results.push({
      id: p.id,
      type: "item",
      title: p.nama,
      subtitle: `Barang Non-Gudang • Toko: ${p.namaToko} • Harga: Rp ${Number(p.hargaJual).toLocaleString("id-ID")}`,
      link: `/non-gudang/barang?id=${p.id}`,
    });
  });

  const invoices = await prisma.ngInvoice.findMany({
    where: {
      OR: [
        { noInvoice: { contains: q } },
        { namaKonsumen: { contains: q } },
        { namaToko: { contains: q } },
      ],
    },
    take: 4,
  });
  invoices.forEach((inv) => {
    results.push({
      id: inv.id,
      type: "invoice",
      title: inv.noInvoice,
      subtitle: `Invoice Non-Gudang • ${inv.namaKonsumen ?? "Tanpa nama konsumen"} • Toko: ${inv.namaToko} • Total: Rp ${Number(inv.totalPenjualan).toLocaleString("id-ID")}`,
      link: `/non-gudang/invoice?id=${inv.id}`,
    });
  });

  const konsumen = await prisma.ngKonsumen.findMany({
    where: {
      OR: [{ nama: { contains: q } }, { namaGrup: { contains: q } }],
    },
    take: 3,
  });
  konsumen.forEach((k) => {
    results.push({
      id: k.id,
      type: "client",
      title: k.nama,
      subtitle: `Konsumen Non-Gudang${k.namaGrup ? ` • Grup: ${k.namaGrup}` : ""}${k.alamat ? ` • ${k.alamat}` : ""}`,
      link: `/non-gudang/konsumen?id=${k.id}`,
    });
  });

  return results;
}

export async function universalSearch(query: string): Promise<SearchResult[]> {
  const session = await getSession();
  if (!session) return [];

  const parsed = searchSchema.safeParse({ query });
  if (!parsed.success) return [];
  const q = parsed.data.query.toLowerCase();

  // Gudang and non-gudang are fully isolated domains (separate Prisma models,
  // separate routes) — searching the wrong domain either returns nothing
  // useful or links to pages the role can't open.
  if (session.role === "ADMIN_NONGUDANG") {
    return searchNonGudang(q);
  }
  return searchGudang(q, session.role);
}
