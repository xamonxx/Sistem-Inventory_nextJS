"use server";

import { z } from "zod";
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

export async function universalSearch(query: string): Promise<SearchResult[]> {
  const session = await getSession();
  if (!session) return [];

  const parsed = searchSchema.safeParse({ query });
  if (!parsed.success) return [];
  const q = parsed.data.query.toLowerCase();

  const results: SearchResult[] = [];

  // 1. Search items
  const items = await prisma.item.findMany({
    where: {
      OR: [
        { nama: { contains: q } },
        { kode: { contains: q } }
      ]
    },
    take: 4
  });
  items.forEach(it => {
    results.push({
      id: it.id,
      type: "item",
      title: it.nama,
      subtitle: `Barang • SKU: ${it.kode} • Harga: Rp ${Number(it.hargaJual).toLocaleString("id-ID")}`,
      link: `/barang?id=${it.id}`
    });
  });

  // 2. Search invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { noInvoice: { contains: q } },
        { namaClient: { contains: q } }
      ]
    },
    take: 4
  });
  invoices.forEach(inv => {
    results.push({
      id: inv.id,
      type: "invoice",
      title: inv.noInvoice,
      subtitle: `Invoice • Klien: ${inv.namaClient ?? "Pelanggan Umum"} • Total: Rp ${Number(inv.total).toLocaleString("id-ID")}`,
      link: `/invoice?id=${inv.id}`
    });
  });

  // 3. Search clients
  const clients = await prisma.client.findMany({
    where: {
      nama: { contains: q }
    },
    take: 3
  });
  clients.forEach(c => {
    results.push({
      id: c.id,
      type: "client",
      title: c.nama,
      subtitle: `Klien/Customer • Alamat: ${c.alamat ?? "—"}`,
      link: `/invoice?client=${encodeURIComponent(c.nama)}` // Filter invoices by customer name
    });
  });

  // 4. Search projects
  const projects = await prisma.project.findMany({
    where: {
      nama: { contains: q }
    },
    take: 3
  });
  projects.forEach(p => {
    results.push({
      id: p.id,
      type: "project",
      title: p.nama,
      subtitle: `Proyek Konstruksi`,
      link: `/invoice?project=${encodeURIComponent(p.nama)}`
    });
  });

  return results;
}
