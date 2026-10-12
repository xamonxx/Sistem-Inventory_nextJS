export type StockDemandLine = {
  nama: string;
  aktif: boolean;
  stokAwal: number;
  ledgerQty: number;
  requestedQty: number;
  currentReservedQty?: number;
  incomingQty?: number;
};

export type StockDemandResult =
  | { ok: true }
  | { ok: false; error: string };

export class InventoryRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryRuleError";
  }
}

/**
 * Validasi stok untuk operasi yang akan mengeluarkan barang.
 * `currentReservedQty` dipakai saat mengedit transaksi lama: stok yang dahulu
 * dipotong transaksi tersebut tersedia kembali sebelum qty baru diterapkan.
 * `incomingQty` dipakai pada tukar barang ketika retur dan penggantian terjadi
 * dalam transaksi database yang sama.
 */
export function validateStockDemand(lines: StockDemandLine[]): StockDemandResult {
  for (const line of lines) {
    const currentReservedQty = line.currentReservedQty ?? 0;
    const requestedIncrease = line.requestedQty > currentReservedQty;

    if (!line.aktif && requestedIncrease) {
      return { ok: false, error: `Barang "${line.nama}" sudah nonaktif dan tidak dapat dikeluarkan.` };
    }

    const available =
      line.stokAwal +
      line.ledgerQty +
      currentReservedQty +
      (line.incomingQty ?? 0);

    if (line.requestedQty > available) {
      return {
        ok: false,
        error: `Stok "${line.nama}" tidak cukup (tersedia ${available}, diminta ${line.requestedQty}).`,
      };
    }
  }

  return { ok: true };
}
