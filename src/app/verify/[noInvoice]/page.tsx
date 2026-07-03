import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { readInvoiceVerifyToken } from "@/lib/invoiceVerify";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { CheckCircle, FileText, Clock, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

function isLocalIP(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.20.") ||
    ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") ||
    ip.startsWith("172.23.") ||
    ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") ||
    ip.startsWith("172.26.") ||
    ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") ||
    ip.startsWith("172.29.") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.")
  );
}

export default async function VerifyInvoicePage({
  params,
}: {
  params: Promise<{ noInvoice: string }>;
}) {
  const { noInvoice: rawToken } = await params;
  const token = String(rawToken ?? "").trim();
  const noInvoice = token ? await readInvoiceVerifyToken(token) : null;
  if (!noInvoice) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { noInvoice },
    include: {
      client: true,
      project: true,
    },
  });

  if (!invoice) notFound();

  const headersList = await headers();
  const ip = (headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? "127.0.0.1").slice(0, 64);
  const userAgent = (headersList.get("user-agent") ?? "").slice(0, 300);
  const localNetwork = isLocalIP(ip);

  const sisa = Number(invoice.total) - Number(invoice.totalDibayar);
  const lunas = sisa <= 0;

  const prevVerifs = await prisma.activityLog.count({
    where: { aksi: "VERIFIKASI_INVOICE", entitasId: String(invoice.id) },
  });

  const isAlreadyVerified = prevVerifs > 0;

  if (!isAlreadyVerified) {
    await logActivity({
      aksi: "VERIFIKASI_INVOICE",
      entitas: "Invoice",
      entitasId: invoice.id,
      detail: {
        noInvoice: invoice.noInvoice,
        ip,
        userAgent,
        localNetwork,
        waktu: new Date().toISOString(),
      },
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="bg-card dark:bg-card rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.2)] border border-border dark:border-border overflow-hidden">
          <div className={`h-2 w-full ${isAlreadyVerified ? "bg-slate-450 dark:bg-slate-600" : localNetwork ? "bg-primary-500" : "bg-amber-400"}`} />

          <div className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              {isAlreadyVerified ? (
                <div className="h-20 w-20 rounded-full bg-slate-55 dark:bg-slate-900 border-2 border-border dark:border-slate-800 flex items-center justify-center">
                  <CheckCircle size={44} className="text-slate-400" />
                </div>
              ) : localNetwork ? (
                <div className="h-20 w-20 rounded-full bg-primary-50 dark:bg-primary-950/20 border-2 border-primary-200 dark:border-primary-800/40 flex items-center justify-center">
                  <CheckCircle size={44} className="text-primary-600" />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-full bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800/40 flex items-center justify-center">
                  <Zap size={44} className="text-amber-500" />
                </div>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-foreground dark:text-white">
                {isAlreadyVerified
                  ? "TERVERIFIKASI"
                  : localNetwork
                  ? "TERVERIFIKASI"
                  : "VERIFIKASI TERCATAT"}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
                {isAlreadyVerified
                  ? "Invoice ini sudah pernah diverifikasi sebelumnya. Verifikasi hanya dapat dilakukan 1 kali."
                  : localNetwork
                  ? "Invoice ini telah diverifikasi dari jaringan lokal toko."
                  : "Verifikasi tercatat dari jaringan eksternal."}
              </p>
            </div>

            <div className={`rounded-2xl border p-5 space-y-3 text-left ${isAlreadyVerified ? "bg-slate-50/50 dark:bg-slate-900/20 border-border dark:border-border" : localNetwork ? "bg-primary-50/50 dark:bg-primary-950/10 border-primary-200 dark:border-primary-800/40" : "bg-slate-50 dark:bg-slate-900/50 border-border dark:border-border"}`}>
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">No. Invoice</p>
                  <p className="font-mono text-sm font-bold text-foreground dark:text-slate-200">{invoice.noInvoice}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock size={18} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Waktu Verifikasi</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                    {new Date().toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {isAlreadyVerified ? (
                    <div className="h-[18px] w-[18px] rounded-full bg-slate-300 dark:bg-slate-650 flex items-center justify-center">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                  ) : localNetwork ? (
                    <div className="h-[18px] w-[18px] rounded-full bg-primary-500 flex items-center justify-center">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                  ) : (
                    <Zap size={18} className="text-amber-400" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Status Jaringan</p>
                  <p className={`text-sm font-semibold ${isAlreadyVerified ? "text-slate-650 dark:text-slate-400" : localNetwork ? "text-primary-700 dark:text-primary-400" : "text-amber-700 dark:text-amber-450"}`}>
                    {isAlreadyVerified ? "Terverifikasi (Jaringan Tersimpan)" : localNetwork ? "Lokal (Toko) — Terpercaya" : "Eksternal"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-[18px] w-[18px] rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">#</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Status Validasi</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                    {isAlreadyVerified ? "Sudah Terverifikasi (Max 1x)" : "Verifikasi Sukses"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Klien</span>
                <span className="font-bold text-foreground dark:text-slate-200">{invoice.namaClient ?? invoice.client?.nama ?? "-"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Total Tagihan</span>
                <span className="font-bold text-foreground dark:text-slate-250">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    minimumFractionDigits: 0,
                  }).format(Number(invoice.total))}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Status</span>
                <span className={`font-bold ${lunas ? "text-primary-600 dark:text-primary-400" : "text-amber-600 dark:text-amber-450"}`}>
                  {lunas ? "LUNAS" : "BELUM LUNAS"}
                </span>
              </div>
              {invoice.project && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Proyek</span>
                  <span className="font-bold text-foreground dark:text-slate-200">{invoice.project.nama}</span>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400">
              PUTRA CORPORATION &mdash; Sistem Verifikasi Invoice Otomatis
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
