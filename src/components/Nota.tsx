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
  diskon?: number; // total diskon yang diberikan (Rp), opsional
  bayar?: number; // uang diterima (tunai), opsional
  kembali?: number; // uang kembalian, opsional
  judul?: string;
  catatan?: string;
};

const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "PUTRA CORPORATION HARDWARE";
const ADDRESS = process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "Jl. Raya Industri No. 12, Cikarang, Bekasi";
const PHONE = "021-8901234";
const EMAIL = "info@putracorporation.com";

export function Nota({ data }: { data: NotaData }) {
  return (
    <>
      {/* 1. THERMAL PRINT LAYOUT (Compact, default for POS receipt) */}
      <div className="thermal-print-layout bg-white p-6 text-sm text-black font-mono">
        <div className="border-b border-dashed border-slate-400 pb-3 text-center">
          <h2 className="text-base font-bold font-sans">{COMPANY}</h2>
          {ADDRESS && <p className="text-[10px] leading-tight mt-1">{ADDRESS}</p>}
          <p className="mt-2 font-bold font-sans text-xs tracking-wider">{data.judul ?? "NOTA TRANSAKSI"}</p>
        </div>

        <div className="space-y-0.5 border-b border-dashed border-slate-400 py-2.5 text-[11px]">
          {data.noTransaksi && <Row k="No. Transaksi" v={data.noTransaksi} />}
          {data.noReturn && <Row k="No. Retur" v={data.noReturn} />}
          {data.noInvoice && <Row k="No. Invoice" v={data.noInvoice} />}
          <Row k="Tanggal" v={formatTanggal(data.tanggal)} />
          {data.namaClient && <Row k="Pelanggan" v={data.namaClient} />}
          {data.alamat && <Row k="Alamat" v={data.alamat} />}
          {data.namaWs && <Row k="Bengkel (WS)" v={data.namaWs} />}
        </div>

        <table className="w-full py-2 text-[11px]">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="py-1 text-left font-semibold">Barang</th>
              <th className="py-1 text-center font-semibold">Qty</th>
              <th className="py-1 text-right font-semibold">Harga</th>
              <th className="py-1 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={i} className="align-top">
                <td className="py-1 max-w-[120px] truncate">{it.nama}</td>
                <td className="py-1 text-center">{it.qty}</td>
                <td className="py-1 text-right">{formatRupiah(it.harga)}</td>
                <td className="py-1 text-right">{formatRupiah(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-slate-400 pt-2 text-[11px]">
          {data.diskon != null && data.diskon > 0 && (
            <div className="flex justify-between">
              <span>Total Diskon</span>
              <span>-{formatRupiah(data.diskon)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs font-bold font-sans mt-1">
            <span>{data.total < 0 ? "REFUND" : "TOTAL AKHIR"}</span>
            <span>{formatRupiah(Math.abs(data.total))}</span>
          </div>
          {data.bayar != null && (
            <div className="mt-1 flex justify-between">
              <span>Tunai Diterima</span>
              <span>{formatRupiah(data.bayar)}</span>
            </div>
          )}
          {data.kembali != null && (
            <div className="flex justify-between font-bold">
              <span>Uang Kembalian</span>
              <span>{formatRupiah(data.kembali)}</span>
            </div>
          )}
          {data.catatan && <p className="mt-2.5 italic text-[10px] leading-normal">{data.catatan}</p>}
        </div>

        <p className="mt-5 text-center text-[10px] text-slate-500 font-sans">Terima kasih atas kepercayaan Anda 🙏</p>
      </div>

      {/* 2. PREMIUM A4 ENTERPRISE INVOICE LAYOUT (Elegant, spaced, professional corporate invoice) */}
      <div className="a4-print-layout bg-white p-10 text-slate-800 invoice-doc text-xs leading-relaxed hidden">
        {/* Header Grid */}
        <div className="flex justify-between items-start border-b-2 border-[var(--primary)] pb-6 mb-6">
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none tracking-tight">{COMPANY}</h1>
            <p className="text-[10px] text-slate-500 mt-2 max-w-xs">{ADDRESS}</p>
            <p className="text-[10px] text-slate-500 mt-1">Telp: {PHONE} | Email: {EMAIL}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-[var(--primary)] tracking-wide">{data.total < 0 ? "NOTA KREDIT (RETUR)" : "FAKTUR PENJUALAN"}</h2>
            <p className="text-[10px] text-slate-450 mt-1">INVOICE DOCUMENT</p>
            
            <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-0.5 text-left text-[10px] font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-slate-400">No. Transaksi</span>
              <span className="font-bold text-slate-800 text-right">{data.noTransaksi || "-"}</span>
              
              {data.noInvoice && (
                <>
                  <span className="text-slate-400">No. Invoice</span>
                  <span className="font-bold text-slate-800 text-right">{data.noInvoice}</span>
                </>
              )}
              
              {data.noReturn && (
                <>
                  <span className="text-slate-400">No. Retur</span>
                  <span className="font-bold text-slate-800 text-right">{data.noReturn}</span>
                </>
              )}
              
              <span className="text-slate-400">Tanggal</span>
              <span className="font-mono text-slate-800 text-right">{formatTanggal(data.tanggal)}</span>
            </div>
          </div>
        </div>

        {/* Client & Project Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-2 border-b border-slate-200 pb-1">Diterbitkan Kepada</h3>
            <p className="text-sm font-extrabold text-slate-900">{data.namaClient || "Umum / Eceran"}</p>
            {data.alamat && (
              <div className="mt-2 text-[10px] text-slate-500 leading-normal">
                <span className="font-bold text-slate-600">Alamat Pengiriman:</span>
                <p className="mt-0.5">{data.alamat}</p>
              </div>
            )}
          </div>
          
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-2 border-b border-slate-200 pb-1">Referensi Tambahan</h3>
            <div className="space-y-1 text-[10px] text-slate-600">
              {data.namaWs && (
                <div className="flex justify-between">
                  <span>Bengkel / Workshop:</span>
                  <span className="font-bold text-slate-800">{data.namaWs}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tipe Transaksi:</span>
                <span className="font-bold text-slate-800">{data.noInvoice || data.noReturn ? "PROYEK" : "RETAIL"}</span>
              </div>
              {data.catatan && (
                <div className="mt-2 pt-2 border-t border-slate-200/60 text-slate-500 italic leading-snug">
                  <span className="font-bold text-slate-600 not-italic block">Catatan Pembayaran:</span>
                  {data.catatan}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse mb-8">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-2.5 px-3 text-left w-8">#</th>
              <th className="py-2.5 px-3 text-left">Deskripsi Barang / Material</th>
              <th className="py-2.5 px-3 text-center w-20">Kuantitas</th>
              <th className="py-2.5 px-3 text-right w-32">Harga Satuan</th>
              <th className="py-2.5 px-3 text-right w-36">Total Harga</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.items.map((it, i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="py-3 px-3 text-slate-400 font-mono">{i + 1}</td>
                <td className="py-3 px-3 font-bold text-slate-800">{it.nama}</td>
                <td className="py-3 px-3 text-center font-semibold font-mono">{it.qty}</td>
                <td className="py-3 px-3 text-right font-mono">{formatRupiah(it.harga)}</td>
                <td className="py-3 px-3 text-right font-bold font-mono text-slate-900">{formatRupiah(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Calculations & Total Summary */}
        <div className="flex justify-between items-start gap-8">
          <div className="text-[10px] text-slate-450 max-w-xs">
            <h4 className="font-bold uppercase tracking-wider mb-1 text-slate-600">Pemberitahuan Penting:</h4>
            <p className="leading-relaxed">
              * Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan kecuali ada perjanjian tertulis sebelumnya.<br/>
              * Faktur ini merupakan bukti pembayaran sah untuk transaksi yang tercantum di atas.
            </p>
          </div>

          <div className="w-80 space-y-2 rounded-xl bg-slate-50 border border-slate-200 p-4">
            {data.diskon != null && data.diskon > 0 && (
              <div className="flex justify-between text-[11px] text-slate-600 select-none">
                <span>Total Potongan Diskon</span>
                <span className="font-bold font-mono text-rose-600">-{formatRupiah(data.diskon)}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center text-xs font-black text-slate-900 border-t border-slate-200 pt-2 select-none">
              <span>{data.total < 0 ? "JUMLAH REFUND" : "TOTAL PEMBAYARAN"}</span>
              <span className="text-base font-extrabold font-mono text-[var(--primary)]">{formatRupiah(Math.abs(data.total))}</span>
            </div>

            {data.bayar != null && (
              <div className="flex justify-between text-[10px] text-slate-500 border-t border-dashed border-slate-200 pt-2">
                <span>Pembayaran Tunai</span>
                <span className="font-mono">{formatRupiah(data.bayar)}</span>
              </div>
            )}
            
            {data.kembali != null && (
              <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                <span>Kembalian Tunai</span>
                <span className="font-mono text-emerald-600">{formatRupiah(data.kembali)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Signature Area */}
        <div className="mt-16 grid grid-cols-2 gap-8 text-center text-[10px] font-bold text-slate-600">
          <div>
            <p className="mb-14">Hormat Kami,</p>
            <div className="w-40 mx-auto border-b border-slate-400" />
            <p className="mt-1.5 text-slate-400">Kasir / Administrasi</p>
          </div>
          <div>
            <p className="mb-14">Penerima / Pelanggan,</p>
            <div className="w-40 mx-auto border-b border-slate-400" />
            <p className="mt-1.5 text-slate-400">Tanda Tangan &amp; Nama Terang</p>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}

