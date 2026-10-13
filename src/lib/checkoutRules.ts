export type CheckoutPayment = {
  tipe: "CASH" | "TRANSFER" | "CREDIT";
  jumlah: number;
};

export type CheckoutLine = {
  itemId: number;
  hargaJual: number;
  qty: number;
};

/**
 * CREDIT adalah piutang tempo yang BELUM dibayar, bukan uang masuk.
 * `totalPaid` hanya berisi CASH + TRANSFER; porsi CREDIT menjadi sisa tagihan
 * invoice (total - totalDibayar) dan tidak disimpan sebagai Payment.
 */
export type CheckoutValidationResult =
  | {
      ok: true;
      grandTotal: number;
      totalPaid: number;
      creditAmount: number;
      hasCredit: boolean;
    }
  | { ok: false; error: string };

export function isReceivedPayment(p: CheckoutPayment): boolean {
  return p.tipe !== "CREDIT" && p.jumlah > 0;
}

export function invoiceStatusFor(total: number, totalDibayar: number): "LUNAS" | "PARTIAL" | "PENDING" {
  if (totalDibayar >= total) return "LUNAS";
  return totalDibayar > 0 ? "PARTIAL" : "PENDING";
}

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

  const totalPaid = rupiah(
    input.payments.filter(isReceivedPayment).reduce((sum, p) => sum + p.jumlah, 0)
  );
  const creditAmount = rupiah(
    input.payments.filter((p) => p.tipe === "CREDIT").reduce((sum, p) => sum + p.jumlah, 0)
  );
  const hasCredit = input.payments.some((p) => p.tipe === "CREDIT");

  if (rupiah(totalPaid + creditAmount) > grandTotal) {
    return { ok: false, error: "Total pembayaran tidak boleh melebihi total transaksi." };
  }

  if (input.payments.length > 0 && !hasCredit && !input.buatInvoice && totalPaid < grandTotal) {
    return { ok: false, error: "Pembayaran tunai/transfer harus lunas bila tidak membuat invoice." };
  }

  return { ok: true, grandTotal, totalPaid, creditAmount, hasCredit };
}
