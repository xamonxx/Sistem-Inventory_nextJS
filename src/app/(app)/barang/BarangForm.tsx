"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveItem, suggestItemCode } from "./actions";
import { Button, Input, Label, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { Plus, X, Wand2 } from "lucide-react";

export type ItemRow = {
  id?: number;
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
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [state, formAction, pending] = useActionState(saveItem, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Sinkronkan field terkontrol saat dialog dibuka / mode edit berubah.
  useEffect(() => {
    setKode(editing?.kode ?? "");
    setNama(editing?.nama ?? "");
  }, [editing, open]);

  async function autoCode() {
    if (!nama.trim()) return;
    setSuggesting(true);
    try {
      const k = await suggestItemCode(nama);
      if (k) setKode(k);
    } finally {
      setSuggesting(false);
    }
  }

  // Saat tambah barang baru: isi kode otomatis ketika user selesai mengetik nama
  // dan kode masih kosong.
  async function onNamaBlur() {
    if (!editing && !kode.trim() && nama.trim()) {
      await autoCode();
    }
  }

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
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Nama Barang</Label>
                    <CharCounter value={nama} max={FIELD_LIMITS.namaBarang} />
                  </div>
                  <Input
                    name="nama"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    onBlur={onNamaBlur}
                    maxLength={FIELD_LIMITS.namaBarang}
                    placeholder="BB Min 18mm New"
                    required
                  />
                </div>
                <div>
                  <Label>Kode Barang (otomatis)</Label>
                  <div className="flex gap-1.5">
                    <Input
                      name="kode"
                      value={kode}
                      onChange={(e) => setKode(e.target.value)}
                      maxLength={FIELD_LIMITS.kodeBarang}
                      placeholder="otomatis dari nama"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={autoCode}
                      disabled={suggesting || !nama.trim()}
                      title="Buat kode otomatis dari nama"
                      className="px-2.5 shrink-0"
                    >
                      <Wand2 size={16} />
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Kosongkan untuk dibuat otomatis (mis. PC-BBM-001).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Harga Beli (Rp)</Label>
                  <Input name="hargaBeli" type="number" min={0} defaultValue={editing?.hargaBeli ?? ""} placeholder="0" />
                </div>
                <div>
                  <Label>Harga Jual (Rp)</Label>
                  <Input name="hargaJual" type="number" min={0} defaultValue={editing?.hargaJual ?? ""} placeholder="0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stok Awal</Label>
                  <Input name="stokAwal" type="number" min={0} defaultValue={editing?.stokAwal ?? ""} placeholder="0" />
                </div>
                <div>
                  <Label>Minimum Stok (Peringatan)</Label>
                  <Input name="minStok" type="number" min={0} defaultValue={editing?.minStok ?? ""} placeholder="10" />
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
