"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { barangMasuk, koreksiStok } from "./actions";
import { Button, Card, Input, Label, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { toast } from "sonner";
import { X, ArrowDownCircle, RefreshCcw, Check } from "lucide-react";

type Item = { id: number; kode: string; nama: string };

function findMatchingItems(items: Item[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => `${item.kode} ${item.nama}`.toLowerCase().includes(normalized));
}

export function StokForm({ items }: { items: Item[] }) {
  const router = useRouter();

  // ===== Stock action modal (Barang Masuk / Koreksi) =====
  const [isStokOpen, setIsStokOpen] = useState(false);
  const [stokTab, setStokTab] = useState<"MASUK" | "KOREKSI">("MASUK");
  const [itemSearch, setItemSearch] = useState("");
  const [formItemId, setFormItemId] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [qtyMasuk, setQtyMasuk] = useState("1");
  const [stokSeharusnya, setStokSeharusnya] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [stokError, setStokError] = useState<string | null>(null);
  const [isSavingStok, startStokTransition] = useTransition();
  const suggestRef = useRef<HTMLDivElement>(null);

  const openStokModal = (tab: "MASUK" | "KOREKSI") => {
    setStokTab(tab);
    setItemSearch("");
    setFormItemId("");
    setShowSuggestions(false);
    setQtyMasuk("1");
    setStokSeharusnya("");
    setKeterangan("");
    setStokError(null);
    setIsStokOpen(true);
  };

  const filteredItems = useMemo(() => findMatchingItems(items, itemSearch), [items, itemSearch]);

  const selectedItem = useMemo(
    () => items.find((item) => String(item.id) === formItemId) ?? null,
    [items, formItemId]
  );

  const handleItemSearchChange = (value: string) => {
    setItemSearch(value);
    setFormItemId("");
    setShowSuggestions(true);
  };

  const handleItemSelect = (item: Item) => {
    setFormItemId(String(item.id));
    setItemSearch(`${item.kode} · ${item.nama}`);
    setShowSuggestions(false);
  };

  const handleStokSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStokError(null);
    if (!formItemId) {
      setStokError("Pilih barang terlebih dahulu.");
      return;
    }

    startStokTransition(async () => {
      const formData = new FormData();
      formData.append("itemId", formItemId);
      formData.append("keterangan", keterangan.trim());

      try {
        let res;
        if (stokTab === "MASUK") {
          if (Number(qtyMasuk) <= 0) {
            setStokError("Qty masuk harus lebih besar dari 0.");
            return;
          }
          formData.append("qty", qtyMasuk);
          res = await barangMasuk(null, formData);
        } else {
          if (stokSeharusnya === "") {
            setStokError("Stok seharusnya wajib diisi.");
            return;
          }
          formData.append("stokSeharusnya", stokSeharusnya);
          res = await koreksiStok(null, formData);
        }

        if (res && res.ok) {
          toast.success(stokTab === "MASUK" ? "Stok berhasil ditambah!" : "Stok berhasil dikoreksi!");
          setIsStokOpen(false);
          router.refresh();
        } else if (res && res.error) {
          setStokError(res.error);
        }
      } catch {
        setStokError("Terjadi kesalahan sistem saat memperbarui stok.");
      }
    });
  };

  return (
    <>
      {/* Action bar — hanya tombol, form muncul di modal */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Manajemen Persediaan</h2>
          <p className="text-xs text-muted">Catat barang masuk/restock atau lakukan koreksi penyesuaian stok.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="success" onClick={() => openStokModal("MASUK")}>
            <ArrowDownCircle size={16} /> Barang Masuk
          </Button>
          <Button onClick={() => openStokModal("KOREKSI")}>
            <RefreshCcw size={16} /> Koreksi Stok
          </Button>
        </div>
      </Card>

      {/* Modal Aksi Stok (tabbed: Masuk / Koreksi) */}
      {isStokOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsStokOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] anim-rise"
          >
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {stokTab === "MASUK" ? "Barang Masuk / Restock" : "Koreksi / Penyesuaian Stok"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {stokTab === "MASUK"
                    ? "Tambahkan jumlah stok dari pembelian / supplier."
                    : "Sesuaikan stok sistem agar sama dengan stok fisik (opname)."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStokOpen(false)}
                className="text-slate-400 transition hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab selector */}
            <div className="mb-4 flex rounded-xl border border-border bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => { setStokTab("MASUK"); setStokError(null); }}
                className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all cursor-pointer ${
                  stokTab === "MASUK"
                    ? "border border-border/50 bg-card text-primary-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Restock (Tambah)
              </button>
              <button
                type="button"
                onClick={() => { setStokTab("KOREKSI"); setStokError(null); }}
                className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all cursor-pointer ${
                  stokTab === "KOREKSI"
                    ? "border border-border/50 bg-card text-amber-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Koreksi (Opname)
              </button>
            </div>

            <form onSubmit={handleStokSubmit} className="space-y-4">
              <div className="relative" ref={suggestRef}>
                <Label>Barang</Label>
                <Input
                  value={itemSearch}
                  onChange={(e) => handleItemSearchChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (filteredItems[0]) handleItemSelect(filteredItems[0]);
                    }
                    if (e.key === "Escape") setShowSuggestions(false);
                  }}
                  maxLength={FIELD_LIMITS.search}
                  placeholder="Ketik kode SKU atau nama barang..."
                  autoComplete="off"
                />

                {/* Auto-suggestion dropdown */}
                {showSuggestions && filteredItems.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      {filteredItems.slice(0, 30).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={() => handleItemSelect(item)}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--row-hover)] ${
                            String(item.id) === formItemId ? "bg-[var(--row-hover)]" : ""
                          }`}
                        >
                          {String(item.id) === formItemId && (
                            <Check size={13} className="shrink-0 text-primary-600" />
                          )}
                          <span className="font-mono text-[11px] text-slate-500 shrink-0 w-20 truncate">{item.kode}</span>
                          <span className="truncate text-foreground font-medium text-xs">{item.nama}</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-border px-3 py-1.5 text-[10px] text-slate-400">
                      {filteredItems.length} barang cocok{filteredItems.length > 30 ? " · scroll untuk lihat lebih" : ""}
                    </div>
                  </div>
                )}

                {/* Selected item indicator */}
                {selectedItem && (
                  <p className="mt-1.5 text-[11px] font-medium text-primary-600 flex items-center gap-1">
                    <Check size={11} /> Dipilih: <span className="font-mono">{selectedItem.kode}</span> · {selectedItem.nama}
                  </p>
                )}
              </div>

              {stokTab === "MASUK" ? (
                <div>
                  <Label>Qty Masuk</Label>
                  <Input type="number" min={1} max={FIELD_LIMITS.maxQty} value={qtyMasuk} onChange={(e) => setQtyMasuk(e.target.value)} required />
                </div>
              ) : (
                <div>
                  <Label>Stok Seharusnya (hasil opname)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={FIELD_LIMITS.maxQty}
                    value={stokSeharusnya}
                    onChange={(e) => setStokSeharusnya(e.target.value)}
                    placeholder="Masukkan stok fisik riil"
                    required
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Keterangan {stokTab === "MASUK" && "(opsional)"}</Label>
                  <CharCounter value={keterangan} max={FIELD_LIMITS.keterangan} />
                </div>
                <Input
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  maxLength={FIELD_LIMITS.keterangan}
                  placeholder={stokTab === "MASUK" ? "mis. dari supplier X" : "mis. stok opname Juni"}
                  required={stokTab === "KOREKSI"}
                />
              </div>

              {stokError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{stokError}</div>
              )}

              <div className="mt-5 flex justify-end gap-2.5 border-t border-border pt-3">
                <Button type="button" variant="outline" onClick={() => setIsStokOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant={stokTab === "MASUK" ? "success" : "primary"} disabled={isSavingStok}>
                  {isSavingStok ? "Menyimpan…" : stokTab === "MASUK" ? "Tambah Stok" : "Koreksi Stok"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
