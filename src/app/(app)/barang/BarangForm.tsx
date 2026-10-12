"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveItem, suggestItemCode } from "./actions";
import { Button, CurrencyInput, Input, Label, Select, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/itemCategories";
import { Plus, X, Wand2 } from "lucide-react";

export type ItemRow = {
  id?: number;
  kode: string;
  nama: string;
  kategori: ItemCategory;
  hargaBeli: number;
  hargaJual: number;
  stokAwal: number;
  minStok: number;
  aktif: boolean;
};

export function BarangForm({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
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
      router.refresh();
    }
  }, [state, router]);

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

  function closeForm() {
    setOpen(false);
    setEditing(null);
  }

  if (!canEdit) {
    return (
      <p className="rounded-md bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in" onClick={closeForm}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl anim-rise">
            {/* Header tetap */}
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-tight text-foreground">
                  {editing ? "Ubah Detail Barang" : "Tambah Barang Baru"}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted-2)]">
                  {editing ? "Perbarui informasi, harga, dan stok barang." : "Lengkapi informasi, harga, dan stok barang."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Tutup"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[var(--text-muted-2)] transition hover:bg-[var(--surface-hover)] hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form action={formAction} ref={formRef} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />

              <div className="scrollbar-thin min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                {/* Informasi barang */}
                <section className="space-y-4">
                  <SectionTitle>Informasi Barang</SectionTitle>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Label className="mb-0">Nama Barang</Label>
                      <CharCounter value={nama} max={FIELD_LIMITS.namaBarang} />
                    </div>
                    <Input
                      name="nama"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      onBlur={onNamaBlur}
                      maxLength={FIELD_LIMITS.namaBarang}
                      placeholder="mis. Plywood 18mm"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Kode Barang</Label>
                      <div className="flex gap-2">
                        <Input
                          name="kode"
                          value={kode}
                          onChange={(e) => setKode(e.target.value)}
                          maxLength={FIELD_LIMITS.kodeBarang}
                          placeholder="Auto dari nama"
                          className="min-w-0 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={autoCode}
                          disabled={suggesting || !nama.trim()}
                          title="Buat kode otomatis dari nama"
                          aria-label="Buat kode otomatis dari nama"
                          className="shrink-0 px-3"
                        >
                          <Wand2 size={16} />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Kategori Barang</Label>
                      <Select name="kategori" defaultValue={editing?.kategori ?? "MATERIAL"} required>
                        {ITEM_CATEGORIES.map((kategori) => (
                          <option key={kategori} value={kategori}>{kategori}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <p className="-mt-1 text-[11px] text-[var(--text-muted-2)]">
                    Kosongkan kode untuk dibuat otomatis (mis. PC-BBM-001).
                  </p>
                </section>

                {/* Harga */}
                <section className="space-y-4">
                  <SectionTitle>Harga</SectionTitle>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Harga Beli (Rp)</Label>
                      <CurrencyInput name="hargaBeli" defaultValue={editing?.hargaBeli ?? ""} placeholder="0" />
                    </div>
                    <div>
                      <Label>Harga Jual (Rp)</Label>
                      <CurrencyInput name="hargaJual" defaultValue={editing?.hargaJual ?? ""} placeholder="0" />
                    </div>
                  </div>
                </section>

                {/* Stok */}
                <section className="space-y-4">
                  <SectionTitle>Stok</SectionTitle>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Stok Awal</Label>
                      <Input name="stokAwal" type="number" min={0} defaultValue={editing?.stokAwal ?? ""} placeholder="0" />
                    </div>
                    <div>
                      <Label>Minimum Stok (Peringatan)</Label>
                      <Input name="minStok" type="number" min={0} defaultValue={editing?.minStok ?? ""} placeholder="10" />
                    </div>
                  </div>
                </section>

                {/* Status */}
                <label
                  htmlFor="aktif-checkbox"
                  className="flex cursor-pointer select-none items-start gap-3 rounded-xl border border-border bg-[var(--surface-hover)]/40 p-3.5 transition hover:bg-[var(--surface-hover)]"
                >
                  <input
                    type="checkbox"
                    id="aktif-checkbox"
                    name="aktif"
                    defaultChecked={editing ? editing.aktif : true}
                    value="true"
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">Barang aktif (dapat dijual)</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted-2)]">
                      Barang aktif tampil di kasir dan bisa dipakai pada transaksi.
                    </span>
                  </span>
                </label>

                {state?.error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    {state.error}
                  </div>
                )}
              </div>

              {/* Footer tetap */}
              <div className="flex flex-col-reverse gap-2.5 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button type="button" variant="outline" onClick={closeForm} className="w-full sm:w-auto">
                  Batal
                </Button>
                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">
      {children}
      <span className="h-px flex-1 bg-border" />
    </h4>
  );
}
