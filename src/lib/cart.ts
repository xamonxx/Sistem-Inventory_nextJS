// Sumber kebenaran tunggal perhitungan keranjang kasir.
// Semua dalam Rupiah bulat (integer).

export interface ComputableLine {
  harga: number;
  qty: number;
}

export interface ComputedLine {
  base: number; // harga * qty
  finalSubtotal: number; // harga * qty
}

export interface ComputedCart {
  lines: ComputedLine[];
  subtotal: number;
  grandTotal: number; // total akhir yang dibayar
}

export function computeCart(cart: ComputableLine[]): ComputedCart {
  const bases = cart.map((l) => Math.max(0, Math.round(l.harga * l.qty)));
  const subtotal = bases.reduce((a, b) => a + b, 0);

  const lines: ComputedLine[] = cart.map((_, i) => ({
    base: bases[i],
    finalSubtotal: bases[i],
  }));

  return {
    lines,
    subtotal,
    grandTotal: subtotal,
  };
}
