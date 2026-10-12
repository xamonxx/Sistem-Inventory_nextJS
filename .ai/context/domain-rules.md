# Domain Rules Context

## Gudang
- Stock: `stokAwal + ledger sum`; outgoing demand cannot exceed available stock in current checkout/return logic.
- Item codes unique; inactive item cannot receive stock increase.
- POS snapshots item, price, client/project/workshop names; writes KELUAR ledger.
- Return quantity is cumulative against original TransactionItem.
- Exchange requires one-to-one indexed pairs; returned item enters stock, replacement leaves stock.
- Positive exchange difference can create invoice; no refund write was found for negative difference.
- Payment cannot exceed outstanding balance; invoice status derives from paid vs total.
- Invoice line edit cannot conflict with returned qty or paid total.

## Non-gudang
- One store per invoice; no warehouse stock write.
- Items snapshot cost/sale/profit/margin/markup.
- TEMPO creates due date +7 days; LUNAS creates full payment.
- Edit cannot reduce sales total below paid total.

## Access
- Kasir: POS/return/invoice payment.
- Gudang: item/stock plus operational access encoded in actions.
- NonGudang: isolated `/non-gudang` domain.

Verify detailed flows in `docs/obsidian-vault/06-BUSINESS-FLOWS` before changing rules.
