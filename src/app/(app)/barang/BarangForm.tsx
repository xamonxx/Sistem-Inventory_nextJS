"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveItem } from "./actions";
import { Button, Input, Label } from "@/components/ui";
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

  // Handle edit event from window dispatch
  useEffect(() => {
    function onEdit(e: Event) {
      const detail = (e as CustomEvent<ItemRow>).detail;
      setEditing(detail);
      setOpen(true);
    }
    window.addEventListener("edit-barang", onEdit);
    return () => window.removeEventListener("edit-barang", onEdit);
  }, []);

  // Handle URL query trigger (?new=true) safely on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "true") {
        setEditing(null);
        setOpen(true);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  if (!canEdit) {
    return (
      <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
        Mode lihat saja. Hanya <b>Admin Gudang</b> yang bisa menambah/ubah harga &amp; stok barang.
      </p>
    );
  }

  return (
    <>
      <Button onClick={() => { setEditing(null); setOpen(true); }} className="flex items-center gap-1.5 font-semibold shadow-sm cursor-pointer">
        <Plus size={16} /> Tambah Barang
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in" onClick={() => { setOpen(false); setEditing(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white rounded-2xl overflow-y-auto max-h-[90vh] p-6 shadow-2xl border border-border anim-rise">
            <div className="flex items-center justify-between border-b border-border pb-3.5 mb-4">
              <h3 className="font-bold text-slate-900 text-lg">
                {editing ? "Ubah Detail Barang" : "Tambah Barang Baru"}
              </h3>
              <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="text-slate-400 hover:text-slate-700 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form action={formAction} ref={formRef} className="space-y-4">
              <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Kode Barang (unik)</Label>
                  <Input name="kode" defaultValue={editing?.kode ?? ""} placeholder="PC-00001" required />
                </div>
                <div>
                  <Label>Nama Barang</Label>
                  <Input name="nama" defaultValue={editing?.nama ?? ""} placeholder="BB Min 18mm New" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Harga Beli (Rp)</Label>
                  <Input name="hargaBeli" type="number" min={0} defaultValue={editing?.hargaBeli ?? 0} required />
                </div>
                <div>
                  <Label>Harga Jual (Rp)</Label>
                  <Input name="hargaJual" type="number" min={0} defaultValue={editing?.hargaJual ?? 0} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stok Awal</Label>
                  <Input name="stokAwal" type="number" min={0} defaultValue={editing?.stokAwal ?? 0} required />
                </div>
                <div>
                  <Label>Minimum Stok (Peringatan)</Label>
                  <Input name="minStok" type="number" min={0} defaultValue={editing?.minStok ?? 10} required />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="aktif-checkbox"
                  name="aktif"
                  defaultChecked={editing ? editing.aktif : true}
                  value="true"
                  className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)] h-4.5 w-4.5 cursor-pointer"
                />
                <label htmlFor="aktif-checkbox" className="text-sm font-semibold text-slate-750 cursor-pointer select-none">
                  Barang aktif (dapat dijual)
                </label>
              </div>

              {state?.error && (
                <div className="rounded-xl bg-red-50 p-3 border border-red-200 text-xs text-red-700">
                  {state.error}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border mt-5">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>
                  Batal
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Menyimpan…" : "Simpan Barang"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
