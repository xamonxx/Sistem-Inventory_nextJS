"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveNgKonsumen } from "./actions";
import { Button, Input, Label, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";

export type NgKonsumenRow = {
  id?: number;
  namaGrup: string | null;
  nama: string;
  alamat: string | null;
  namaWorkshop: string | null;
};

export function NgKonsumenForm({ triggerClassName }: { triggerClassName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NgKonsumenRow | null>(null);
  const [nama, setNama] = useState("");
  const [namaGrup, setNamaGrup] = useState("");
  const [mounted, setMounted] = useState(false);
  const [state, formAction, pending] = useActionState(saveNgKonsumen, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setNama(editing?.nama ?? "");
    setNamaGrup(editing?.namaGrup ?? "");
  }, [editing, open]);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      setOpen(false);
      setEditing(null);
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    function onEdit(e: Event) {
      const detail = (e as CustomEvent<NgKonsumenRow>).detail;
      setEditing(detail);
      setOpen(true);
    }
    window.addEventListener("edit-ng-konsumen", onEdit);
    return () => window.removeEventListener("edit-ng-konsumen", onEdit);
  }, []);

  return (
    <>
      <Button
        onClick={() => { setEditing(null); setOpen(true); }}
        className={cn("flex items-center gap-1.5 font-semibold shadow-sm", triggerClassName)}
      >
        <Plus size={16} /> Tambah Konsumen
      </Button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in" style={{ zIndex: 2147483050 }} onClick={() => { setOpen(false); setEditing(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="scrollbar-none w-full max-w-lg bg-card rounded-2xl overflow-y-auto max-h-[90vh] p-5 shadow-2xl border border-border anim-rise sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-3.5 mb-4">
              <h3 className="font-bold text-foreground text-lg">
                {editing ? "Ubah Konsumen" : "Tambah Konsumen"}
              </h3>
              <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="text-muted hover:text-foreground transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form action={formAction} ref={formRef} className="space-y-4">
              <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Nama Konsumen</Label>
                  <CharCounter value={nama} max={FIELD_LIMITS.namaClient} />
                </div>
                <Input
                  name="nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  maxLength={FIELD_LIMITS.namaClient}
                  placeholder="mis. Bpk. Andi / CV Sumber Jaya"
                  required
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Nama Grup / Proyek</Label>
                  <CharCounter value={namaGrup} max={FIELD_LIMITS.projectGroupNama} />
                </div>
                <Input
                  name="namaGrup"
                  value={namaGrup}
                  onChange={(e) => setNamaGrup(e.target.value)}
                  maxLength={FIELD_LIMITS.projectGroupNama}
                  placeholder="mis. Proyek Perumahan Griya Asri (opsional)"
                />
              </div>

              <div>
                <Label>Alamat</Label>
                <textarea
                  name="alamat"
                  defaultValue={editing?.alamat ?? ""}
                  maxLength={FIELD_LIMITS.alamat}
                  rows={2}
                  placeholder="Alamat konsumen (opsional)"
                  className="w-full resize-none rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10"
                />
              </div>

              <div>
                <Label>Nama Workshop</Label>
                <Input name="namaWorkshop" defaultValue={editing?.namaWorkshop ?? ""} maxLength={FIELD_LIMITS.namaWs} placeholder="mis. WS Bengkel Las (opsional)" />
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
                  {pending ? "Menyimpan…" : "Simpan Konsumen"}
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
