import { formatRupiah, formatTanggal } from "@/lib/utils";

export type NotaItem = { nama: string; harga: number; qty: number; subtotal: number };
export type NotaData = {
  noTransaksi?: string | null;
  noReturn?: string | null;
  noInvoice?: string | null;
  tanggal: string;
  namaClient?: string | null;
  alamat?: string | null;
  namaWs?: string | null;
  items: NotaItem[];
  total: number;
  judul?: string;
  catatan?: string;
};

const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "PUTRA CORPORATION HARDWARE";
const ADDRESS = process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "";

export function Nota({ data }: { data: NotaData }) {
  return (
    <div className="bg-white p-6 text-sm text-black">
      <div className="border-b border-dashed border-slate-400 pb-3 text-center">
        <h2 className="text-base font-bold">{COMPANY}</h2>
        {ADDRESS && <p className="text-xs">{ADDRESS}</p>}
        <p className="mt-1 font-semibold">{data.judul ?? "NOTA"}</p>
      </div>

      <div className="space-y-0.5 border-b border-dashed border-slate-400 py-2 text-xs">
        {data.noTransaksi && <Row k="No. Transaksi" v={data.noTransaksi} />}
        {data.noReturn && <Row k="No. Retur" v={data.noReturn} />}
        {data.noInvoice && <Row k="No. Invoice" v={data.noInvoice} />}
        <Row k="Tanggal" v={formatTanggal(data.tanggal)} />
        {data.namaClient && <Row k="Pelanggan" v={data.namaClient} />}
        {data.alamat && <Row k="Alamat" v={data.alamat} />}
        {data.namaWs && <Row k="Bengkel (WS)" v={data.namaWs} />}
      </div>

      <table className="w-full py-2 text-xs">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="py-1 text-left font-semibold">Barang</th>
            <th className="py-1 text-center font-semibold">Qty</th>
            <th className="py-1 text-right font-semibold">Harga</th>
            <th className="py-1 text-right font-semibold">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i} className="align-top">
              <td className="py-1">{it.nama}</td>
              <td className="py-1 text-center">{it.qty}</td>
              <td className="py-1 text-right">{formatRupiah(it.harga)}</td>
              <td className="py-1 text-right">{formatRupiah(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-slate-400 pt-2">
        <div className="flex justify-between text-base font-bold">
          <span>{data.total < 0 ? "Refund" : "Total"}</span>
          <span>{formatRupiah(Math.abs(data.total))}</span>
        </div>
        {data.catatan && <p className="mt-2 text-xs italic">{data.catatan}</p>}
      </div>

      <p className="mt-4 text-center text-xs text-slate-500">Terima kasih atas kepercayaan Anda 🙏</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
