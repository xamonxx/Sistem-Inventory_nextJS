import { formatRupiah, formatTanggal } from "@/lib/utils";

export type NotaItem = { kode?: string; nama: string; harga: number; qty: number; subtotal: number };
export type NotaData = {
  noTransaksi?: string | null;
  noReturn?: string | null;
  noInvoice?: string | null;
  tanggal: string;
  namaClient?: string | null;
  alamat?: string | null;
  namaWs?: string | null;
  namaBank?: string | null; // opsional, untuk transfer/kredit
  noRekening?: string | null; // opsional, untuk transfer/kredit
  atasNama?: string | null; // opsional, untuk transfer/kredit
  items: NotaItem[];
  total: number;
  diskon?: number; // total diskon yang diberikan (Rp), opsional
  bayar?: number; // uang diterima (tunai), opsional
  kembali?: number; // uang kembalian, opsional
  judul?: string;
  catatan?: string;
};

const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "PUTRA CORPORATION HARDWARE";
const ADDRESS = process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "Jl. Nasional III, Cipatat, Bandung Barat, Jawa Barat (40554)";
const PHONE = "0822-1234-5678";
const EMAIL = "info@putracorp.co.id";

function renderItemName(name: string, isThermal: boolean = false) {
  if (name.startsWith("[RETUR]")) {
    return (
      <span className="leading-tight">
        <strong className={`font-extrabold font-sans mr-1 ${isThermal ? "text-[#3730A3]" : "text-indigo-700"}`}>[RETUR]</strong>
        <span>{name.slice(7).trim()}</span>
      </span>
    );
  }
  if (name.startsWith("[GANTI]")) {
    return (
      <span className="leading-tight">
        <strong className={`font-extrabold font-sans mr-1 ${isThermal ? "text-[#166534]" : "text-emerald-700"}`}>[GANTI]</strong>
        <span>{name.slice(7).trim()}</span>
      </span>
    );
  }
  return <span className="leading-tight">{name}</span>;
}

export function Nota({ data }: { data: NotaData }) {
  // Calculate due date (30 days from transaction date)
  const dueDate = new Date(data.tanggal);
  dueDate.setDate(dueDate.getDate() + 30);

  // Status mapping
  const isCredit = data.catatan?.toLowerCase().includes("credit") || data.catatan?.toLowerCase().includes("tempo");
  const isReturn = data.total < 0;
  const stat = isReturn 
    ? { label: "RETUR", fg: "#3730A3", bg: "#E0E7FF" }
    : isCredit 
    ? { label: "TEMPO", fg: "#991B1B", bg: "#FEE2E2" } 
    : { label: "LUNAS", fg: "#166534", bg: "#DCFCE7" };

  const lunas = stat.label === "LUNAS";
  const totalQty = data.items.reduce((a, it) => a + it.qty, 0);

  // Verification URL & QR code
  const verifyUrl = typeof window !== "undefined"
    ? `${window.location.origin}/verify?code=${data.noInvoice ?? data.noTransaksi ?? ""}`
    : "";
  const qrDataUrl = verifyUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`
    : "";

  return (
    <>
      {/* 1. THERMAL PRINT LAYOUT (Compact, default for POS receipt) */}
      <div className="thermal-print-layout bg-white p-6 text-sm text-black font-mono">
        <div className="border-b border-dashed border-slate-400 pb-3 text-center">
          <h2 className="text-base font-bold font-sans">{COMPANY}</h2>
          {ADDRESS && <p className="text-[10px] leading-tight mt-1">{ADDRESS}</p>}
          <p className="mt-2 font-bold font-sans text-xs tracking-wider">{data.judul ?? "NOTA TRANSAKSI"}</p>
        </div>

        <div className="space-y-1.5 border-b border-dashed border-slate-400 py-3 text-[11px]">
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
                <td className="py-1 max-w-[140px] break-words whitespace-normal leading-tight">
                  {renderItemName(it.nama, true)}
                </td>
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
          {(data.namaBank || data.noRekening || data.atasNama) && (
            <div className="mt-2 border-t border-dashed border-slate-300 pt-2 space-y-1">
              {data.namaBank && <Row k="Bank" v={data.namaBank} />}
              {data.noRekening && <Row k="No. Rekening" v={data.noRekening} />}
              {data.atasNama && <Row k="Atas Nama" v={data.atasNama} />}
            </div>
          )}
          {data.catatan && <p className="mt-2.5 italic text-[10px] leading-normal">{data.catatan}</p>}
        </div>

        <p className="mt-5 text-center text-[9px] text-[#64748B] font-sans leading-relaxed">Nota ini dibuat otomatis oleh sistem.</p>
      </div>

      {/* 2. PREMIUM A4 ENTERPRISE INVOICE LAYOUT (Elegant, spaced, professional corporate invoice) */}
      <div className="a4-print-layout bg-white text-[#111827] invoice-doc hidden">
        {/* Thin accent bar */}
        <div className="invoice-accent-bar h-1.5 w-full bg-[#EA580C]" />

        <div className="inv-body px-9 py-7">
          {/* ============ HEADER ============ */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#1E293B] text-base font-extrabold text-white">
                PC
              </div>
              <div className="leading-tight">
                <h1 className="max-w-[280px] text-[22px] font-bold leading-[1.1] tracking-tight text-[#111827]">
                  {COMPANY}
                </h1>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#EA580C]">
                  HARDWARE &amp; BUILDING MATERIALS SUPPLIER
                </p>
                <div className="mt-1.5 space-y-px text-[10px] leading-snug text-[#64748B]">
                  <p>{ADDRESS}</p>
                  <p>Telp: {PHONE}</p>
                  <p>{EMAIL} · www.putracorp.co.id</p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-[18px] font-bold leading-none tracking-tight text-[#1E293B]">INVOICE</h2>
              <p className="mt-1 font-mono text-[16px] font-semibold text-[#EA580C]">{data.noInvoice ?? data.noTransaksi ?? "-"}</p>
              <dl className="mt-2.5 space-y-0.5 text-[10px]">
                <div className="flex justify-end gap-2">
                  <dt className="text-[#94A3B8]">Tanggal</dt>
                  <dd className="w-[78px] font-semibold tabular-nums text-[#111827] text-right">{formatTanggal(data.tanggal)}</dd>
                </div>
              </dl>
              <span
                className="mt-2.5 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
                style={{ color: stat.fg, background: stat.bg }}
              >
                {stat.label}
              </span>
            </div>
          </div>

          {/* ============ INFO BLOCKS ============ */}
          <div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-8 border-t border-[#E5E7EB] pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Ditagihkan Kepada</p>
              <p className="mt-1.5 text-[13px] font-bold text-[#111827]">{data.namaClient || "Umum / Eceran"}</p>
              {data.namaWs && (
                <p className="mt-0.5 text-[10px] text-[#475569]">Bengkel / WS: <span className="font-semibold">{data.namaWs}</span></p>
              )}
              {data.alamat && <p className="mt-0.5 text-[10px] leading-snug text-[#64748B]">{data.alamat}</p>}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Informasi Invoice</p>
              <dl className="mt-1.5 space-y-1 text-[10px]">
                {[
                  ["Tanggal Invoice", formatTanggal(data.tanggal)],
                  ["Metode Pembayaran", data.catatan?.includes("Split") ? "Split Payment" : data.catatan?.includes("Kredit") ? "Kredit / Tempo" : "Tunai / Transfer"],
                  ["Status", stat.label],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-[#94A3B8]">{k}</dt>
                    <dd className="font-semibold text-[#111827]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {qrDataUrl && (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR Verifikasi" className="h-[68px] w-[68px]" />
                <p className="mt-1 text-[7.5px] uppercase tracking-wide text-[#94A3B8]">Scan untuk verifikasi</p>
              </div>
            )}
          </div>

          {/* ============ ITEM TABLE ============ */}
          <div className="inv-table-wrap mt-6">
            <table className="inv-table w-full border-collapse text-[10px]">
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "37%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "16.5%" }} />
                <col style={{ width: "16.5%" }} />
              </colgroup>
              <thead>
                <tr className="bg-[#1E293B] text-white">
                  <th className="h-[34px] px-3 text-left text-[10px] font-semibold uppercase tracking-wide">Kode</th>
                  <th className="px-3 text-left text-[10px] font-semibold uppercase tracking-wide">Nama Barang</th>
                  <th className="px-3 text-center text-[10px] font-semibold uppercase tracking-wide">Qty</th>
                  <th className="px-3 text-center text-[10px] font-semibold uppercase tracking-wide">Satuan</th>
                  <th className="px-3 text-right text-[10px] font-semibold uppercase tracking-wide">Harga</th>
                  <th className="px-3 text-right text-[10px] font-semibold uppercase tracking-wide">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it, i) => (
                  <tr key={i} className="border-b border-[#E5E7EB]">
                    <td className="h-[28px] px-3 font-mono font-semibold text-[#EA580C]">{it.kode ?? "-"}</td>
                    <td className="h-[28px] px-3 font-medium text-[#111827]">{renderItemName(it.nama)}</td>
                    <td className="h-[28px] px-3 text-center font-semibold tabular-nums">{it.qty}</td>
                    <td className="h-[28px] px-3 text-center text-[#64748B]">Unit</td>
                    <td className="h-[28px] px-3 text-right tabular-nums text-[#334155]">{formatRupiah(it.harga)}</td>
                    <td className="h-[28px] px-3 text-right font-semibold tabular-nums text-[#111827]">{formatRupiah(it.subtotal)}</td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-[#94A3B8]">Tidak ada rincian item.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ============ NOTES + SUMMARY ============ */}
          <div className="mt-5 grid grid-cols-[1fr_minmax(220px,260px)] gap-8">
            {/* Left: notes + bank */}
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Catatan</p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-[#64748B]">
                  Terima kasih atas kepercayaan Anda. Penukaran barang maksimal 3 hari dengan nota asli.
                  Mohon konfirmasi setelah melakukan pembayaran/transfer.
                </p>
              </div>
              {(data.namaBank || data.noRekening || data.atasNama) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Pembayaran</p>
                  <div className="mt-1.5 space-y-0.5 text-[10px]">
                    {data.namaBank && <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">Nama Bank</span><span className="font-semibold text-[#111827]">{data.namaBank}</span></div>}
                    {data.noRekening && <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">No. Rekening</span><span className="font-mono font-semibold tabular-nums text-[#111827]">{data.noRekening}</span></div>}
                    {data.atasNama && <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">Atas Nama</span><span className="font-semibold text-[#111827]">{data.atasNama}</span></div>}
                  </div>
                </div>
              )}
            </div>

            {/* Right: totals */}
            <div className="self-start">
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between text-[#475569]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatRupiah(Math.abs(data.total))}</span>
                </div>
                {lunas && (
                  <div className="flex justify-between text-[#475569]">
                    <span>Pembayaran Masuk</span>
                    <span className="tabular-nums">− {formatRupiah(Math.abs(data.total))}</span>
                  </div>
                )}
              </div>
              <div className="mt-2.5 flex items-end justify-between border-t-2 border-[#111827] pt-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                  {lunas ? "Total Lunas" : "Sisa Tagihan"}
                </span>
                <span className="text-[20px] font-bold leading-none tabular-nums text-[#111827]">
                  {formatRupiah(Math.abs(data.total))}
                </span>
              </div>
              <p className="mt-1 text-right text-[9px] text-[#94A3B8]">
                {data.items.length} jenis barang · {totalQty} total unit
              </p>
            </div>
          </div>

          {/* ============ SIGNATURES ============ */}
          <div className="mt-7 grid grid-cols-3 gap-8 text-center text-[10px]">
            {["Dibuat Oleh", "Disetujui", "Penerima"].map((role) => (
              <div key={role}>
                <p className="font-semibold text-[#475569]">{role}</p>
                <div className="mt-10 border-t border-[#94A3B8]" />
                <p className="mt-1 text-[8.5px] text-[#94A3B8]">( ........................... )</p>
              </div>
            ))}
          </div>

          {/* ============ FOOTER ============ */}
          <div className="mt-6 flex items-center justify-between border-t border-[#E5E7EB] pt-3 text-[9px] text-[#94A3B8]">
            <span>Invoice dibuat otomatis oleh sistem.</span>
            <span className="font-semibold text-[#EA580C]">www.putracorp.co.id</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 items-start">
      <span className="text-slate-500 shrink-0">{k}</span>
      <span className="font-semibold text-right break-words max-w-[70%]">{v}</span>
    </div>
  );
}
