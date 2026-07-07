"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveNgProduk } from "./actions";
import { Button, Input, Label, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";

export type NgProdukRow = {
  id?: number;
  nama: string;
  namaToko: string;
  kategori: string | null;
  satuan: string | null;
  hargaBeli: number;
  hargaJual: number;
  aktif: boolean;
};

export function NgBarangForm({ triggerClassName }: { triggerClassName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NgProdukRow | null>(null);
  const [nama, setNama] = useState("");
  const [namaToko, setNamaToko] = useState("");
  const [mounted, setMounted] = useState(false);
  const [state, formAction, pending] = useActionState(saveNgProduk, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setNama(editing?.nama ?? "");
    setNamaToko(editing?.namaToko ?? "");
  }, [editing, open]);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      setOpen(false);
      setEditing(null);
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  // Edit trigger dari tabel
  useEffect(() => {
    function onEdit(e: Event) {
      const detail = (e as CustomEvent<NgProdukRow>).detail;
      setEditing(detail);
      setOpen(true);
    }
    window.addEventListener("edit-ng-produk", onEdit);
    return () => window.removeEventListener("edit-ng-produk", onEdit);
  }, []);

  return (
    <>
      <Button
        onClick={() => { setEditing(null); setOpen(true); }}
        className={cn("flex items-center gap-1.5 font-semibold shadow-sm", triggerClassName)}
      >
        <Plus size={16} /> Tambah Barang
      </Button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in" style={{ zIndex: 2147483050 }} onClick={() => { setOpen(false); setEditing(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="scrollbar-none w-full max-w-lg bg-card rounded-2xl overflow-y-auto max-h-[90vh] p-5 shadow-2xl border border-border anim-rise sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-3.5 mb-4">
              <h3 className="font-bold text-foreground text-lg">
                {editing ? "Ubah Barang Non-Gudang" : "Tambah Barang Non-Gudang"}
              </h3>
              <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="text-muted hover:text-foreground transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form action={formAction} ref={formRef} className="space-y-4">
              <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Nama Barang</Label>
                    <CharCounter value={nama} max={FIELD_LIMITS.namaBarang} />
                  </div>
                  <Input
                    name="nama"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    maxLength={FIELD_LIMITS.namaBarang}
                    placeholder="mis. Keramik Roman 40x40"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Toko Sumber</Label>
                    <CharCounter value={namaToko} max={FIELD_LIMITS.supplierName} />
                  </div>
                  <Input
                    name="namaToko"
                    value={namaToko}
                    onChange={(e) => setNamaToko(e.target.value)}
                    maxLength={FIELD_LIMITS.supplierName}
                    placeholder="mis. Toko Bangunan Jaya"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Kategori</Label>
                  <Input name="kategori" defaultValue={editing?.kategori ?? ""} maxLength={40} placeholder="mis. Keramik" />
                </div>
                <div>
                  <Label>Satuan</Label>
                  <Input name="satuan" defaultValue={editing?.satuan ?? ""} maxLength={20} placeholder="mis. Dus / Pcs / Lembar" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Harga Beli (Rp)</Label>
                  <Input name="hargaBeli" type="number" min={0} defaultValue={editing?.hargaBeli ?? ""} placeholder="0" />
                </div>
                <div>
                  <Label>Harga Jual (Rp)</Label>
                  <Input name="hargaJual" type="number" min={0} defaultValue={editing?.hargaJual ?? ""} placeholder="0" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ng-aktif-checkbox"
                  name="aktif"
                  defaultChecked={editing ? editing.aktif : true}
                  value="true"
                  className="rounded border-border text-[var(--primary)] focus:ring-[var(--primary)] h-4.5 w-4.5 cursor-pointer"
                />
                <label htmlFor="ng-aktif-checkbox" className="text-sm font-semibold text-foreground cursor-pointer select-none">
                  Barang aktif (dapat dijual)
                </label>
              </div>

              {state?.error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
                  {state.error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2.5 pt-3 border-t border-border mt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }} className="w-full sm:w-auto">
                  Batal
                </Button>
                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                  {pending ? "Menyimpan…" : "Simpan Barang"}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
