export type NgCartLineInput = {
  produkId?: number;
  nama: string;
  namaToko: string;
  kategori?: string | null;
  satuan?: string | null;
  hargaBeli: number;
  hargaJual: number;
  qty: number;
};

export type NgComputedCartLine = NgCartLineInput & {
  subtotalModal: number;
  subtotalPenjualan: number;
  subtotalProfit: number;
  margin: number;
  markup: number;
};

export type NgComputedCart = {
  lines: NgComputedCartLine[];
  totalModal: number;
  totalPenjualan: number;
  totalProfit: number;
  margin: number;
  markup: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toPercent(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return round2((numerator / denominator) * 100);
}

export function computeNgCart(lines: NgCartLineInput[]): NgComputedCart {
  const computedLines = lines.map((line) => {
    const qty = Math.max(1, Math.trunc(line.qty || 0));
    const subtotalModal = Math.round(line.hargaBeli * qty);
    const subtotalPenjualan = Math.round(line.hargaJual * qty);
    const subtotalProfit = subtotalPenjualan - subtotalModal;

    return {
      ...line,
      qty,
      subtotalModal,
      subtotalPenjualan,
      subtotalProfit,
      margin: toPercent(subtotalProfit, subtotalPenjualan),
      markup: toPercent(subtotalProfit, subtotalModal),
    };
  });

  const totalModal = computedLines.reduce((sum, line) => sum + line.subtotalModal, 0);
  const totalPenjualan = computedLines.reduce((sum, line) => sum + line.subtotalPenjualan, 0);
  const totalProfit = totalPenjualan - totalModal;

  return {
    lines: computedLines,
    totalModal,
    totalPenjualan,
    totalProfit,
    margin: toPercent(totalProfit, totalPenjualan),
    markup: toPercent(totalProfit, totalModal),
  };
}
