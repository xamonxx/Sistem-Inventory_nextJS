"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { barangMasuk, koreksiStok } from "./actions";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type Item = { id: number; kode: string; nama: string };

export function StokForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [masukState, masukAction, masukPending] = useActionState(barangMasuk, null);
  const [korState, korAction, korPending] = useActionState(koreksiStok, null);
  const masukRef = useRef<HTMLFormElement>(null);
  const korRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (masukState && "ok" in masukState) { masukRef.current?.reset(); router.refresh(); } }, [masukState, router]);
  useEffect(() => { if (korState && "ok" in korState) { korRef.current?.reset(); router.refresh(); } }, [korState, router]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 font-semibold text-emerald-700">Barang Masuk / Restock</h2>
        <form action={masukAction} ref={masukRef} className="space-y-3">
          <div>
            <Label>Barang</Label>
            <Select name="itemId" required>
              <option value="">— pilih barang —</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.kode} · {i.nama}</option>)}
            </Select>
          </div>
          <div><Label>Qty Masuk</Label><Input name="qty" type="number" min={1} required /></div>
          <div><Label>Keterangan (opsional)</Label><Input name="keterangan" placeholder="mis. dari supplier X" /></div>
          {masukState?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{masukState.error}</p>}
          <Button type="submit" variant="success" disabled={masukPending}>{masukPending ? "Menyimpan…" : "Tambah Stok"}</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-amber-700">Koreksi / Penyesuaian Stok</h2>
        <form action={korAction} ref={korRef} className="space-y-3">
          <div>
            <Label>Barang</Label>
            <Select name="itemId" required>
              <option value="">— pilih barang —</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.kode} · {i.nama}</option>)}
            </Select>
          </div>
          <div><Label>Stok Seharusnya (hasil opname)</Label><Input name="stokSeharusnya" type="number" required /></div>
          <div><Label>Keterangan</Label><Input name="keterangan" placeholder="mis. stok opname Juni" /></div>
          {korState?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{korState.error}</p>}
          <Button type="submit" disabled={korPending}>{korPending ? "Menyimpan…" : "Koreksi Stok"}</Button>
        </form>
      </Card>
    </div>
  );
}
