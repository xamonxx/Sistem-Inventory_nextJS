"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { barangMasuk, koreksiStok } from "./actions";
import { Button, Card, Input, Label, Select, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { saveItem } from "../barang/actions";
import { toast } from "sonner";
import { X, ArrowDownCircle, RefreshCcw, PackagePlus } from "lucide-react";

type Item = { id: number; kode: string; nama: string };

export function StokForm({ items }: { items: Item[] }) {
  const router = useRouter();

  // ===== Stock action modal (Barang Masuk / Koreksi) =====
  const [isStokOpen, setIsStokOpen] = useState(false);
  const [stokTab, setStokTab] = useState<"MASUK" | "KOREKSI">("MASUK");
  const [formItemId, setFormItemId] = useState<string>("");
  const [qtyMasuk, setQtyMasuk] = useState("1");
  const [stokSeharusnya, setStokSeharusnya] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [stokError, setStokError] = useState<string | null>(null);
  const [isSavingStok, startStokTransition] = useTransition();

  // ===== Quick create product modal =====
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKode, setNewKode] = useState("");
  const [nama, setNama] = useState("");
  const [hargaBeli, setHargaBeli] = useState("0");
  const [hargaJual, setHargaJual] = useState("0");
  const [stokAwal, setStokAwal] = useState("0");
  const [minStok, setMinStok] = useState("10");
  const [aktif, setAktif] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, startSavingTransition] = useTransition();

  const openStokModal = (tab: "MASUK" | "KOREKSI") => {
    setStokTab(tab);
    setFormItemId("");
    setQtyMasuk("1");
    setStokSeharusnya("");
    setKeterangan("");
    setStokError(null);
    setIsStokOpen(true);
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

  const openAddProductModal = () => {
    // Generate code PC-XXXXX
    const codes = items
      .map((item) => {
        const match = item.kode.match(/PC-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(Boolean);
    const max = codes.length > 0 ? Math.max(...codes) : 0;
    const code = `PC-${String(max + 1).padStart(5, "0")}`;

    setNewKode(code);
    setNama("");
    setHargaBeli("0");
    setHargaJual("0");
    setStokAwal("0");
    setMinStok("10");
    setAktif(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!nama.trim()) {
      setModalError("Nama barang wajib diisi");
      return;
    }

    startSavingTransition(async () => {
      const formData = new FormData();
      formData.append("kode", newKode);
      formData.append("nama", nama.trim());
      formData.append("hargaBeli", hargaBeli);
      formData.append("hargaJual", hargaJual);
      formData.append("stokAwal", stokAwal);
      formData.append("minStok", minStok);
      formData.append("aktif", String(aktif));

      try {
        const res = await saveItem(null, formData);
        if (res.ok) {
          toast.success("Barang baru berhasil ditambahkan!");
          setIsModalOpen(false);
          router.refresh();
        } else if (res.error) {
          setModalError(res.error);
        }
      } catch {
        setModalError("Terjadi kesalahan sistem saat menyimpan barang.");
      }
    });
  };

  return (
    <>
      {/* Action bar — hanya tombol, form muncul di modal */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Manajemen Persediaan</h2>
          <p className="text-xs text-muted">Catat barang masuk/restock atau lakukan koreksi penyesuaian stok.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="success" onClick={() => openStokModal("MASUK")}>
            <ArrowDownCircle size={16} /> Barang Masuk
          </Button>
          <Button onClick={() => openStokModal("KOREKSI")}>
            <RefreshCcw size={16} /> Koreksi Stok
          </Button>
          <Button variant="outline" onClick={openAddProductModal}>
            <PackagePlus size={16} /> Katalog Barang
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
            className="w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl max-h-[90vh] anim-rise"
          >
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
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
            <div className="mb-4 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => { setStokTab("MASUK"); setStokError(null); }}
                className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all cursor-pointer ${
                  stokTab === "MASUK"
                    ? "border border-slate-200/50 bg-white text-emerald-700 shadow-sm"
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
                    ? "border border-slate-200/50 bg-white text-amber-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Koreksi (Opname)
              </button>
            </div>

            <form onSubmit={handleStokSubmit} className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="mb-0">Barang</Label>
                  <button
                    type="button"
                    onClick={() => { setIsStokOpen(false); openAddProductModal(); }}
                    className="text-xs font-semibold text-[var(--primary)] outline-none hover:underline cursor-pointer"
                  >
                    + Tambah Katalog Barang
                  </button>
                </div>
                <Select value={formItemId} onChange={(e) => setFormItemId(e.target.value)} required>
                  <option value="">— pilih barang —</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.kode} · {i.nama}
                    </option>
                  ))}
                </Select>
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

      {/* Modal Tambah Barang Baru */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl max-h-[90vh] anim-rise"
          >
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3.5">
              <h3 className="text-lg font-bold text-slate-900">Tambah Barang Baru</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 transition hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Kode Barang (Auto)</Label>
                  <Input value={newKode} disabled className="bg-slate-50 font-mono text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Nama Barang</Label>
                    <CharCounter value={nama} max={FIELD_LIMITS.namaBarang} />
                  </div>
                  <Input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={FIELD_LIMITS.namaBarang} placeholder="Nama barang baru" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Harga Beli (Rp)</Label>
                  <Input type="number" min={0} max={FIELD_LIMITS.maxMoney} value={hargaBeli} onChange={(e) => setHargaBeli(e.target.value)} required />
                </div>
                <div>
                  <Label>Harga Jual (Rp)</Label>
                  <Input type="number" min={0} max={FIELD_LIMITS.maxMoney} value={hargaJual} onChange={(e) => setHargaJual(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stok Awal</Label>
                  <Input type="number" min={0} max={FIELD_LIMITS.maxQty} value={stokAwal} onChange={(e) => setStokAwal(e.target.value)} required />
                </div>
                <div>
                  <Label>Min. Stok (Peringatan)</Label>
                  <Input type="number" min={0} max={FIELD_LIMITS.maxQty} value={minStok} onChange={(e) => setMinStok(e.target.value)} required />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="aktif-checkbox"
                  checked={aktif}
                  onChange={(e) => setAktif(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                />
                <label htmlFor="aktif-checkbox" className="select-none text-sm font-semibold text-slate-700 cursor-pointer">
                  Barang aktif (dapat dijual)
                </label>
              </div>

              {modalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{modalError}</div>
              )}

              <div className="mt-5 flex justify-end gap-2.5 border-t border-border pt-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Menyimpan…" : "Simpan Barang"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
