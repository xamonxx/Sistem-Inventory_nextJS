"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { submitStockIn } from "./actions";
import { Button, Card, Input, Label, Select, Table, Th, Td, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { formatRupiah } from "@/lib/utils";
import { Plus, Trash2, ArrowLeft, Save, Printer } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type ItemOption = { id: number; kode: string; nama: string; hargaBeli: number };
type StockInLine = {
  itemId: number;
  qty: number;
  unitCost: number;
};

export function StockInClient({ items }: { items: ItemOption[] }) {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<StockInLine[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [receipt, setReceipt] = useState<any | null>(null);

  // Map to get item details
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function addRow() {
    setLines((prev) => [
      ...prev,
      {
        itemId: items[0]?.id ?? 0,
        qty: 1,
        unitCost: items[0]?.hargaBeli ?? 0,
      },
    ]);
  }

  function removeRow(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: keyof StockInLine, value: number) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const updated = { ...l, [field]: value };
        // If item changes, pre-populate default unit cost
        if (field === "itemId") {
          const matched = itemMap.get(value);
          updated.unitCost = matched?.hargaBeli ?? 0;
        }
        return updated;
      })
    );
  }

  const grandTotal = lines.reduce((acc, l) => acc + l.unitCost * l.qty, 0);

  function handleSubmit() {
    setError("");
    if (lines.length === 0) {
      toast.error("Batch restok masih kosong.");
      return setError("Batch restok masih kosong.");
    }

    start(async () => {
      const res = await submitStockIn({
        supplierName,
        referenceNo,
        notes,
        items: lines,
      });

      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return setError(res.error);
      }

      if (res && "ok" in res) {
        toast.success("Batch restok berhasil disimpan!");
        setReceipt({
          supplierName,
          referenceNo,
          notes,
          grandTotal: res.totalAmount,
          items: lines.map((l) => {
            const it = itemMap.get(l.itemId)!;
            return {
              nama: it.nama,
              qty: l.qty,
              unitCost: l.unitCost,
              subtotal: l.qty * l.unitCost,
            };
          }),
        });
        setLines([]);
        setSupplierName("");
        setReferenceNo("");
        setNotes("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/stok" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Kembali ke Kartu Stok
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Input Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Detail Penerimaan / Supplier</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Nama Supplier</Label>
                  <CharCounter value={supplierName} max={FIELD_LIMITS.supplierName} />
                </div>
                <Input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  maxLength={FIELD_LIMITS.supplierName}
                  placeholder="mis. PT Indo Plywood"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">No. Referensi / Nota Uang</Label>
                  <CharCounter value={referenceNo} max={FIELD_LIMITS.referenceNo} />
                </div>
                <Input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  maxLength={FIELD_LIMITS.referenceNo}
                  placeholder="mis. SJ-10294"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Catatan Tambahan</Label>
                  <CharCounter value={notes} max={FIELD_LIMITS.notes} />
                </div>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={FIELD_LIMITS.notes}
                  placeholder="mis. Plywood 18mm premium"
                />
              </div>
            </div>
          </Card>

          {/* Batch table grid */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <Table className="border-none shadow-none bg-transparent rounded-none">
              <thead>
                <tr>
                  <Th>Pilih Barang</Th>
                  <Th className="text-center w-24">Kuantitas</Th>
                  <Th className="text-right w-44">Harga Beli Unit (Rp)</Th>
                  <Th className="text-right w-40">Subtotal</Th>
                  <Th className="w-12 text-center"></Th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, index) => {
                  const itemSubtotal = l.unitCost * l.qty;
                  return (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <Td>
                        <Select
                          value={l.itemId}
                          onChange={(e) => updateRow(index, "itemId", Number(e.target.value))}
                        >
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.kode} &middot; {it.nama}
                            </option>
                          ))}
                        </Select>
                      </Td>
                      <Td>
                        <Input
                          type="number"
                          min={1}
                          max={FIELD_LIMITS.maxQty}
                          value={l.qty}
                          onChange={(e) => updateRow(index, "qty", parseInt(e.target.value) || 1)}
                          className="text-center font-mono font-semibold"
                        />
                      </Td>
                      <Td>
                        <Input
                          type="number"
                          min={0}
                          max={FIELD_LIMITS.maxMoney}
                          value={l.unitCost}
                          onChange={(e) => updateRow(index, "unitCost", parseInt(e.target.value) || 0)}
                          className="text-right font-mono"
                        />
                      </Td>
                      <Td className="text-right font-bold font-mono text-foreground">
                        {formatRupiah(itemSubtotal)}
                      </Td>
                      <Td className="text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="text-red-500 hover:text-red-700 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <Td colSpan={5} className="py-12 text-center text-muted">
                      Batch restok kosong. Klik &quot;Tambah Baris Barang&quot; di bawah untuk memulai.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
            <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-900 flex justify-between">
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus size={14} /> Tambah Baris Barang
              </Button>
            </div>
          </div>
        </div>

        {/* Right total summary block */}
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">Ringkasan Nilai Restok</h2>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted text-xs">Total Macam Material</span>
              <span className="font-semibold text-sm">{lines.length} items</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted text-xs">Total Kuantitas Fisik</span>
              <span className="font-semibold text-sm">
                {lines.reduce((acc, l) => acc + l.qty, 0)} unit
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-border pt-4">
              <span className="text-sm font-medium text-slate-500">Nilai Pembelian</span>
              <span className="text-xl font-bold text-primary-600 font-mono">
                {formatRupiah(grandTotal)}
              </span>
            </div>

            {error && (
              <p className="rounded bg-red-50 p-2 text-xs text-red-700 font-medium">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={pending || lines.length === 0}
              className="w-full h-11 text-sm font-semibold mt-4"
              variant="success"
            >
              {pending ? "Menyimpan Batch..." : "Simpan Penerimaan Barang"}
            </Button>
          </Card>
        </div>
      </div>

      {/* Dynamic Printing Dialog */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl border border-border">
            <div className="border-b border-border pb-3 text-center">
              <p className="text-base font-bold text-foreground">PUTRA CORPORATION SOFTWARE</p>
              <p className="text-xs text-slate-500">Penerimaan &amp; Restok Barang Batch</p>
            </div>
            <div className="py-3 text-xs space-y-1">
              {receipt.supplierName && <p><strong>Supplier:</strong> {receipt.supplierName}</p>}
              {receipt.referenceNo && <p><strong>Ref Nota:</strong> {receipt.referenceNo}</p>}
              {receipt.notes && <p><strong>Catatan:</strong> {receipt.notes}</p>}
              <p><strong>Tanggal Input:</strong> {new Date().toLocaleString("id-ID")}</p>
            </div>

            <Table className="text-xs mb-4">
              <thead>
                <tr>
                  <Th className="py-1">Material</Th>
                  <Th className="py-1 text-center">Qty</Th>
                  <Th className="py-1 text-right">Unit Cost</Th>
                  <Th className="py-1 text-right">Subtotal</Th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((it: any, i: number) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <Td className="py-1">{it.nama}</Td>
                    <Td className="py-1 text-center font-bold">{it.qty}</Td>
                    <Td className="py-1 text-right">{formatRupiah(it.unitCost)}</Td>
                    <Td className="py-1 text-right font-semibold">{formatRupiah(it.subtotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="flex justify-between items-center font-bold text-sm border-t border-border pt-3">
              <span>Total Nilai Restok</span>
              <span className="text-primary-600">{formatRupiah(receipt.grandTotal)}</span>
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t border-border">
              <Button onClick={() => window.print()} className="flex-1">
                <Printer size={14} /> Cetak Bukti Penerimaan
              </Button>
              <Button variant="outline" onClick={() => setReceipt(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
