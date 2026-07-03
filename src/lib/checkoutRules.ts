export type CheckoutPayment = {
  tipe: "CASH" | "TRANSFER" | "CREDIT";
  jumlah: number;
};

export type CheckoutLine = {
  itemId: number;
  hargaJual: number;
  qty: number;
};

export type CheckoutValidationResult =
  | {
      ok: true;
      grandTotal: number;
      totalPaid: number;
      hasCredit: boolean;
    }
  | { ok: false; error: string };

function rupiah(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validateCheckoutTotals(input: {
  lines: CheckoutLine[];
  payments: CheckoutPayment[];
  buatInvoice: boolean;
}): CheckoutValidationResult {
  const seen = new Set<number>();
  let grandTotal = 0;

  for (const line of input.lines) {
    if (seen.has(line.itemId)) {
      return { ok: false, error: "Barang duplikat di keranjang. Gabungkan kuantitas dalam satu baris." };
    }
    seen.add(line.itemId);

    const baseSubtotal = rupiah(line.hargaJual * line.qty);
    grandTotal = rupiah(grandTotal + baseSubtotal);
  }

  if (grandTotal < 0) {
    return { ok: false, error: "Total transaksi tidak valid." };
  }

  const totalPaid = rupiah(input.payments.reduce((sum, p) => sum + p.jumlah, 0));
  const hasCredit = input.payments.some((p) => p.tipe === "CREDIT");

  if (totalPaid > grandTotal) {
    return { ok: false, error: "Total pembayaran tidak boleh melebihi total transaksi." };
  }

  if (input.payments.length > 0 && !hasCredit && !input.buatInvoice && totalPaid < grandTotal) {
    return { ok: false, error: "Pembayaran tunai/transfer harus lunas bila tidak membuat invoice." };
  }

  return { ok: true, grandTotal, totalPaid, hasCredit };
}
