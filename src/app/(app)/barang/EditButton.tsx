"use client";

import { Pencil } from "lucide-react";
import type { ItemRow } from "./BarangForm";

export function EditButton({ item }: { item: ItemRow }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("edit-barang", { detail: item }))}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-slate-50"
    >
      <Pencil size={13} /> Ubah
    </button>
  );
}
