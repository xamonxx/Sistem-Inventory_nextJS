import { formatRupiah, formatTanggal } from "@/lib/utils";
import type { InvoiceRow } from "@/app/(app)/invoice/InvoiceActions";

const COMPANY = {
  nama: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "PUTRA CORPORATION HARDWARE",
  tagline: "Hardware & Building Materials Supplier",
  alamat:
    process.env.NEXT_PUBLIC_COMPANY_ADDRESS ??
    "Jl. Nasional III, Cipatat, Bandung Barat, Jawa Barat (40554)",
  telepon: "0822-1234-5678",
  email: "info@putracorp.co.id",
  website: "www.putracorp.co.id",
};

const STATUS: Record<string, { label: string; fg: string; bg: string; bd: string }> = {
  PAID: { label: "LUNAS", fg: "#047857", bg: "#ECFDF5", bd: "#A7F3D0" },
  PARTIAL: { label: "DIBAYAR SEBAGIAN", fg: "#1E293B", bg: "#F1F5F9", bd: "#CBD5E1" },
  PENDING: { label: "BELUM LUNAS", fg: "#9A3412", bg: "#FFF7ED", bd: "#FED7AA" },
  OVERDUE: { label: "JATUH TEMPO", fg: "#B91C1C", bg: "#FEF2F2", bd: "#FECACA" },
  DRAFT: { label: "DRAFT", fg: "#475569", bg: "#F8FAFC", bd: "#E2E8F0" },
};

export function InvoiceDocument({
  inv,
  qrDataUrl,
  verifyUrl,
}: {
  inv: InvoiceRow;
  qrDataUrl?: string;
  verifyUrl?: string;
}) {
  const sisa = inv.total - inv.totalDibayar;
  const lunas = sisa <= 0;
  const dueDate = new Date(inv.tanggal);
  dueDate.setDate(dueDate.getDate() + 30);
  const totalQty = inv.items.reduce((a, it) => a + it.qty, 0);
  const stat = STATUS[inv.status] ?? STATUS.PENDING;

  return (
    <div className="invoice-doc bg-white text-[#0F172A]">
      {/* Accent bar */}
      <div className="invoice-accent-bar h-2 w-full bg-[#EA580C]" />

      <div className="inv-body px-8 py-5 sm:px-10">
        {/* ============ HEADER ============ */}
        <div className="flex flex-col gap-6 border-b border-[#E2E8F0] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#1E293B] text-lg font-extrabold text-white">
              PC
            </div>
            <div className="leading-snug">
              <h1 className="text-lg font-bold tracking-tight text-[#0F172A]">{COMPANY.nama}</h1>
              <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-[#EA580C]">
                {COMPANY.tagline}
              </p>
              <div className="mt-1.5 space-y-0.5 text-[0.72rem] text-[#64748B]">
                <p>{COMPANY.alamat}</p>
                <p>Telp: {COMPANY.telepon} · {COMPANY.email}</p>
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#1E293B]">INVOICE</h2>
            <p className="mt-1 font-mono text-sm font-bold text-[#EA580C]">{inv.noInvoice}</p>
            <div className="mt-2 space-y-0.5 text-[0.72rem] text-[#64748B]">
              <p>Tanggal: <span className="font-semibold text-[#0F172A]">{formatTanggal(inv.tanggal)}</span></p>
              <p>Jatuh Tempo: <span className="font-semibold text-[#0F172A]">{formatTanggal(dueDate.toISOString())}</span></p>
            </div>
            <span
              className="mt-2 inline-flex items-center rounded-md border px-2.5 py-1 text-[0.66rem] font-bold uppercase tracking-wider"
              style={{ color: stat.fg, background: stat.bg, borderColor: stat.bd }}
            >
              {stat.label}
            </span>
          </div>
        </div>

        {/* ============ CUSTOMER SECTION ============ */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              Ditagihkan Kepada
            </p>
            <p className="mt-1.5 text-sm font-bold text-[#0F172A]">{inv.namaClient}</p>
            {inv.namaWs && <p className="text-xs text-[#475569]">Bengkel / WS: <span className="font-semibold">{inv.namaWs}</span></p>}
            {inv.alamat && <p className="mt-0.5 text-xs text-[#64748B]">{inv.alamat}</p>}
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              Informasi Invoice
            </p>
            <dl className="mt-1.5 space-y-1 text-xs">
              {[
                ["Tanggal Invoice", formatTanggal(inv.tanggal)],
                ["Jatuh Tempo", formatTanggal(dueDate.toISOString())],
                ["Metode Pembayaran", "Tunai / Transfer"],
                ["Status", stat.label],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-[#64748B]">{k}</dt>
                  <dd className="font-semibold text-[#0F172A]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* ============ ITEM TABLE ============ */}
        <div className="inv-table-wrap mt-6 overflow-x-auto rounded-xl border border-[#E2E8F0]">
          <table className="inv-table w-full min-w-[640px] text-xs">
            <thead>
              <tr className="bg-[#1E293B] text-white">
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Kode</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Nama Barang</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Kategori</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide">Qty</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Satuan</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide">Harga</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide">Diskon</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} className={`border-t border-[#E2E8F0] ${i % 2 ? "bg-[#F8FAFC]" : "bg-white"} hover:bg-[#FFF7ED]`}>
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#EA580C]">{it.kode}</td>
                  <td className="px-3 py-2.5 font-medium text-[#0F172A]">{it.nama}</td>
                  <td className="px-3 py-2.5 text-[#64748B]">{it.kategori ?? "Material"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{it.qty}</td>
                  <td className="px-3 py-2.5 text-[#64748B]">{it.satuan ?? "Unit"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#334155]">{formatRupiah(it.harga)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#64748B]">{it.diskon ? formatRupiah(it.diskon) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#0F172A]">{formatRupiah(it.subtotal)}</td>
                </tr>
              ))}
              {inv.items.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-[#94A3B8]">Tidak ada rincian item.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          Total <span className="font-semibold text-[#0F172A]">{inv.items.length}</span> jenis barang ·
          Grand Total Item: <span className="font-semibold text-[#0F172A]">{totalQty}</span> Barang
        </p>

        {/* ============ PAYMENT INFO + SUMMARY ============ */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Left: bank + terms (mengisi ruang kosong) */}
          <div className="space-y-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
                Informasi Pembayaran
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-[#64748B]">Bank BCA</span><span className="font-mono font-semibold text-[#0F172A]">7720 118 234</span></div>
                <div className="flex justify-between"><span className="text-[#64748B]">Bank Mandiri</span><span className="font-mono font-semibold text-[#0F172A]">130 0098 7654</span></div>
                <div className="flex justify-between border-t border-[#E2E8F0] pt-1"><span className="text-[#64748B]">Atas Nama</span><span className="font-semibold text-[#0F172A]">PT Putra Corporation</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] p-4">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
                Catatan &amp; Ketentuan
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[0.72rem] leading-snug text-[#64748B]">
                <li>Pembayaran dapat dicicil sesuai kesepakatan.</li>
                <li>Penukaran barang maksimal 3 hari dengan nota asli.</li>
                <li>Mohon konfirmasi setelah melakukan transfer.</li>
              </ul>
            </div>
          </div>

          {/* Right: totals */}
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.06)] self-start">
            <div className="space-y-1.5 p-4 text-sm">
              {[
                ["Subtotal", formatRupiah(inv.total)],
                ["Diskon", "—"],
                ["Pajak (PPN)", formatRupiah(0)],
                ["Ongkos Kirim", formatRupiah(0)],
                ["Pembayaran Masuk", inv.totalDibayar > 0 ? `− ${formatRupiah(inv.totalDibayar)}` : formatRupiah(0)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[#475569]">
                  <span>{k}</span>
                  <span className="tabular-nums">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between bg-[#1E293B] px-4 py-3 text-white">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
                {lunas ? "Total Lunas" : "Grand Total (Sisa)"}
              </span>
              <span className="text-xl font-extrabold tabular-nums">{formatRupiah(lunas ? inv.total : Math.max(0, sisa))}</span>
            </div>
            {lunas && (
              <div className="flex items-center justify-center gap-2 bg-[#ECFDF5] py-2 text-sm font-bold text-[#047857]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#10B981] text-[0.7rem] text-white">✓</span>
                LUNAS
              </div>
            )}
          </div>
        </div>

        {/* ============ SIGNATURES ============ */}
        <div className="mt-7 grid grid-cols-3 gap-6 text-center text-xs">
          {["Penerima", "Checker Gudang", "Admin Gudang"].map((role) => (
            <div key={role}>
              <p className="font-semibold text-[#475569]">{role}</p>
              <div className="mx-auto mt-9 w-full border-t border-[#CBD5E1]" />
              <p className="mt-1.5 text-[0.65rem] text-[#94A3B8]">( ........................... )</p>
            </div>
          ))}
        </div>

        {/* ============ FOOTER + QR ============ */}
        <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-[#E2E8F0] pt-4 sm:flex-row">
          <div className="max-w-md text-xs text-[#64748B]">
            <p className="font-semibold text-[#0F172A]">Terima kasih atas kepercayaan Anda.</p>
            <p className="mt-1">
              Invoice ini dibuat secara otomatis oleh sistem dan sah tanpa tanda tangan basah.
            </p>
            <p className="mt-1.5 font-medium text-[#EA580C]">{COMPANY.website}</p>
          </div>
          <div className="flex items-center gap-3">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR Verifikasi Invoice" className="h-20 w-20 rounded-md border border-[#E2E8F0]" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-[#CBD5E1] text-[0.55rem] text-[#94A3B8]">
                QR
              </div>
            )}
            <div className="text-[0.62rem] leading-tight text-[#94A3B8]">
              <p className="font-semibold text-[#475569]">Verifikasi Invoice</p>
              <p>Scan QR untuk</p>
              <p>memvalidasi keaslian.</p>
              {verifyUrl && <p className="mt-0.5 break-all font-mono text-[#64748B]">{verifyUrl}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
