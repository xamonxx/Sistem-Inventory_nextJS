"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveItem } from "./actions";
import { Button, Card, Input, Label } from "@/components/ui";
import { Plus, X } from "lucide-react";

export type ItemRow = {
  id: number;
  kode: string;
  nama: string;
  hargaBeli: number;
  hargaJual: number;
  stokAwal: number;
  minStok: number;
  aktif: boolean;
};

export function BarangForm({ canEdit }: { canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [state, formAction, pending] = useActionState(saveItem, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      setOpen(false);
      setEditing(null);
      formRef.current?.reset();
    }
  }, [state]);

  // expose edit handler via window event (dipanggil dari tombol di tabel)
  useEffect(() => {
    function onEdit(e: Event) {
      const detail = (e as CustomEvent<ItemRow>).detail;
      setEditing(detail);
      setOpen(true);
    }
    window.addEventListener("edit-barang", onEdit);
    return () => window.removeEventListener("edit-barang", onEdit);
  }, []);

  if (!canEdit) {
    return (
      <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
        Mode lihat saja. Hanya <b>Admin Gudang</b> yang bisa menambah/ubah harga &amp; stok barang.
      </p>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus size={18} /> Tambah Barang
      </Button>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{editing ? "Ubah Barang" : "Tambah Barang"}</h2>
        <button onClick={() => { setOpen(false); setEditing(null); }} className="text-muted hover:text-foreground">
          <X size={20} />
        </button>
      </div>

      <form action={formAction} ref={formRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
        <div>
          <Label>Kode Barang (unik)</Label>
          <Input name="kode" defaultValue={editing?.kode ?? ""} placeholder="PC-00001" required />
        </div>
        <div>
          <Label>Nama Barang</Label>
          <Input name="nama" defaultValue={editing?.nama ?? ""} placeholder="BB Min 18mm New" required />
        </div>
        <div>
          <Label>Harga Beli</Label>
          <Input name="hargaBeli" type="number" min={0} defaultValue={editing?.hargaBeli ?? 0} />
        </div>
        <div>
          <Label>Harga Jual</Label>
          <Input name="hargaJual" type="number" min={0} defaultValue={editing?.hargaJual ?? 0} />
        </div>
        <div>
          <Label>Stok Awal</Label>
          <Input name="stokAwal" type="number" defaultValue={editing?.stokAwal ?? 0} />
        </div>
        <div>
          <Label>Minimum Stok (peringatan)</Label>
          <Input name="minStok" type="number" min={0} defaultValue={editing?.minStok ?? 10} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="aktif" defaultChecked={editing ? editing.aktif : true} className="h-4 w-4" />
          Barang aktif
        </label>

        {state?.error && (
          <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <div className="sm:col-span-2 flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
          <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>
            Batal
          </Button>
        </div>
      </form>
    </Card>
  );
}
