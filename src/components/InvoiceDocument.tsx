import { formatRupiah, formatTanggal } from "@/lib/utils";
import type { InvoiceRow } from "@/app/(app)/invoice/InvoiceActions";
import { AppLogo } from "./AppLogo";

const COMPANY = {
  nama: "PUTRA CORPORATION",
  tagline: "Building Materials Supplier",
  alamat:
    process.env.NEXT_PUBLIC_COMPANY_ADDRESS ??
    "Jl. Nasional III, Cipatat, Bandung Barat, Jawa Barat (40554)",
  telepon: "0822-4035-2844",
  email: "info@menujukeindahan.id",
  website: "menujukeindahan.id",
};

// Gambar tanda tangan untuk kolom "Disetujui".
// Simpan file di: public/ttd/disetujui.png (disarankan PNG latar transparan).
// Bisa dioverride lewat env NEXT_PUBLIC_SIGNATURE_DISETUJUI.
const SIGNATURE_DISETUJUI =
  process.env.NEXT_PUBLIC_SIGNATURE_DISETUJUI ?? "/ttd/disetujui.png";

// Nama penanda tangan pada kolom "Disetujui" (di bawah garis tanda tangan).
const SIGNATURE_DISETUJUI_NAMA =
  process.env.NEXT_PUBLIC_SIGNATURE_DISETUJUI_NAMA ?? "Putri Nur Fitriani";

const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  PAID: { label: "LUNAS", fg: "#166534", bg: "#DCFCE7" },
  PARTIAL: { label: "DIBAYAR SEBAGIAN", fg: "#92400E", bg: "#FEF3C7" },
  PENDING: { label: "BELUM LUNAS", fg: "#991B1B", bg: "#FEE2E2" },
  DRAFT: { label: "DRAFT", fg: "#475569", bg: "#F1F5F9" },
};

function renderItemName(name: string) {
  if (name.startsWith("[RETUR]")) {
    return (
      <span className="leading-tight">
        <strong className="font-extrabold text-indigo-700 font-sans mr-1">[RETUR]</strong>
        <span>{name.slice(7).trim()}</span>
      </span>
    );
  }
  if (name.startsWith("[GANTI]")) {
    return (
      <span className="leading-tight">
        <strong className="font-extrabold text-primary-700 font-sans mr-1">[GANTI]</strong>
        <span>{name.slice(7).trim()}</span>
      </span>
    );
  }
  return <span className="leading-tight">{name}</span>;
}

export function InvoiceDocument({
  inv,
  qrDataUrl,
}: {
  inv: InvoiceRow;
  qrDataUrl?: string;
}) {
  const sisa = inv.total - inv.totalDibayar;
  const lunas = sisa <= 0;
  const totalQty = inv.items.reduce((a, it) => a + it.qty, 0);
  const stat = STATUS[inv.status] ?? STATUS.PENDING;

  const qrSrc = qrDataUrl;

  const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">{children}</p>
  );

  return (
    <div className="invoice-doc bg-white text-[#111827]">
      {/* Thin accent bar */}
      <div className="invoice-accent-bar h-1.5 w-full bg-[#0284c7]" />

      <div className="inv-body px-9 py-7">
        {/* ============ HEADER ============ */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#1E293B] text-white">
              <AppLogo className="h-7 w-7" />
            </div>
            <div className="leading-tight">
              <p className="whitespace-nowrap text-[14px] font-extrabold uppercase leading-[1.1] tracking-[0.02em] text-[#111827]">
                {COMPANY.nama}
              </p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#0284c7]">
                {COMPANY.tagline}
              </p>
              <div className="mt-1.5 space-y-px text-[10px] leading-snug text-[#64748B]">
                <p>{COMPANY.alamat}</p>
                <p>Telp: {COMPANY.telepon}</p>
                <p>{COMPANY.email} · {COMPANY.website}</p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[18px] font-bold leading-none tracking-tight text-[#1E293B]">INVOICE</p>
            <p className="mt-1 font-mono text-[16px] font-semibold text-[#0284c7]">{inv.noInvoice}</p>
            <dl className="mt-2.5 space-y-0.5 text-[10px]">
              <div className="flex justify-end gap-2">
                <dt className="text-[#94A3B8]">Tanggal</dt>
                <dd className="w-[78px] font-semibold tabular-nums text-[#111827]">{formatTanggal(inv.tanggal)}</dd>
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

        {/* ============ INFO BLOCKS (no cards — clean blocks) ============ */}
        <div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-8 border-t border-[#E5E7EB] pt-4">
          <div>
            <Label>Ditagihkan Kepada</Label>
            <p className="mt-1.5 text-[13px] font-bold text-[#111827]">{inv.namaClient}</p>
            {inv.namaWs && (
              <p className="mt-0.5 text-[10px] text-[#475569]">Bengkel / WS: <span className="font-semibold">{inv.namaWs}</span></p>
            )}
            {inv.alamat && <p className="mt-0.5 text-[10px] leading-snug text-[#64748B]">{inv.alamat}</p>}
          </div>

          <div>
            <Label>Informasi Invoice</Label>
            <dl className="mt-1.5 space-y-1 text-[10px]">
              {[
                ["Tanggal Invoice", formatTanggal(inv.tanggal)],
                ["Metode Pembayaran", "Tunai / Transfer"],
                ["Status", stat.label],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-[#94A3B8]">{k}</dt>
                  <dd className="font-semibold text-[#111827]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {qrSrc && (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="QR Verifikasi" className="h-[68px] w-[68px]" />
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
              {inv.items.map((it, i) => (
                <tr key={i} className="border-b border-[#E5E7EB]">
                  <td className="h-[28px] px-3 font-mono font-semibold text-[#0284c7]">{it.kode}</td>
                  <td className="h-[28px] px-3 font-medium text-[#111827]">{renderItemName(it.nama)}</td>
                  <td className="h-[28px] px-3 text-center font-semibold tabular-nums">{it.qty}</td>
                  <td className="h-[28px] px-3 text-center text-[#64748B]">{it.satuan ?? "Unit"}</td>
                  <td className="h-[28px] px-3 text-right tabular-nums text-[#334155]">{formatRupiah(it.harga)}</td>
                  <td className="h-[28px] px-3 text-right font-semibold tabular-nums text-[#111827]">{formatRupiah(it.subtotal)}</td>
                </tr>
              ))}
              {inv.items.length === 0 && (
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
              <Label>Catatan</Label>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[#64748B]">
                Terima kasih atas kepercayaan Anda. Penukaran barang maksimal 3 hari dengan nota asli.
                Mohon konfirmasi setelah melakukan pembayaran/transfer.
              </p>
            </div>
            {(inv.namaBank || inv.noRekening || inv.atasNama) && (
              <div>
                <Label>Pembayaran</Label>
                <div className="mt-1.5 space-y-0.5 text-[10px]">
                  {inv.namaBank && <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">Nama Bank</span><span className="font-semibold text-[#111827]">{inv.namaBank}</span></div>}
                  {inv.noRekening && <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">No. Rekening</span><span className="font-mono font-semibold tabular-nums text-[#111827]">{inv.noRekening}</span></div>}
                  {inv.atasNama && <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">Atas Nama</span><span className="font-semibold text-[#111827]">{inv.atasNama}</span></div>}
                </div>
              </div>
            )}
          </div>

          {/* Right: totals */}
          <div className="self-start">
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-[#475569]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatRupiah(inv.total)}</span>
              </div>
              {inv.totalDibayar > 0 && (
                <div className="flex justify-between text-[#475569]">
                  <span>Pembayaran Masuk</span>
                  <span className="tabular-nums">− {formatRupiah(inv.totalDibayar)}</span>
                </div>
              )}
            </div>
            <div className="mt-2.5 flex items-end justify-between border-t-2 border-[#111827] pt-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                {lunas ? "Total Lunas" : "Sisa Tagihan"}
              </span>
              <span className="text-[20px] font-bold leading-none tabular-nums text-[#111827]">
                {formatRupiah(lunas ? inv.total : Math.max(0, sisa))}
              </span>
            </div>
            <p className="mt-1 text-right text-[9px] text-[#94A3B8]">
              {inv.items.length} jenis barang · {totalQty} total unit
            </p>
          </div>
        </div>

        {/* ============ SIGNATURES ============ */}
        <div className="mt-14 mb-10 grid grid-cols-3 gap-8 text-center text-[10px]">
          {["Dibuat Oleh", "Disetujui", "Penerima"].map((role) => (
            <div key={role}>
              <p className="font-semibold text-[#475569]">{role}</p>
              {/* Area tanda tangan: garis + gambar TTD absolut (tidak menggeser
                  layout, jadi ketiga kolom tetap presisi sejajar). */}
              <div className="relative mt-16 border-t border-[#94A3B8]">
                {role === "Disetujui" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={SIGNATURE_DISETUJUI}
                    alt="Tanda tangan disetujui"
                    className="pointer-events-none absolute bottom-[4px] left-1/2 h-[56px] w-auto max-w-[90%] -translate-x-1/2 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                  />
                )}
              </div>
              {role === "Disetujui" ? (
                <p className="mt-1 text-[9px] font-semibold text-[#475569]">( {SIGNATURE_DISETUJUI_NAMA} )</p>
              ) : (
                <p className="mt-1 text-[8.5px] text-[#94A3B8]">( ........................... )</p>
              )}
            </div>
          ))}
        </div>

        {/* ============ FOOTER ============ */}
        <div className="mt-6 flex items-center justify-between border-t border-[#E5E7EB] pt-3 text-[9px] text-[#94A3B8]">
          <span>Invoice dibuat otomatis oleh sistem &amp; sah tanpa tanda tangan basah.</span>
          <span className="font-semibold text-[#0284c7]">{COMPANY.website}</span>
        </div>
      </div>
    </div>
  );
}
