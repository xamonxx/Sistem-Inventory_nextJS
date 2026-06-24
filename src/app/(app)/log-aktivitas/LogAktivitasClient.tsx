"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, Th, Td, Badge, Input, Select, Button, Card, Label } from "@/components/ui";
import { Pagination, usePagination } from "@/components/Pagination";
import { formatTanggal } from "@/lib/utils";
import { Search, Eye, X, HelpCircle, History, Trash2 } from "lucide-react";
import { ModernDialog } from "@/components/ModernDialog";
import { toast } from "sonner";
import { clearActivityLogs } from "./actions";

type LogRow = {
  id: number;
  userId: number | null;
  userName: string;
  userRole: string;
  aksi: string;
  entitas: string;
  entitasId: string | null;
  detail: string | null;
  createdAt: string;
};

const AKSI_TONE: Record<string, "slate" | "green" | "red" | "amber" | "blue"> = {
  CREATE_BARANG: "green",
  UPDATE_BARANG: "blue",
  TOGGLE_BARANG: "amber",
  CREATE_TRANSAKSI: "green",
  BAYAR_INVOICE: "green",
  RETUR_BARANG: "red",
  TUKAR_BARANG: "red",
  STOCK_IN_BATCH: "green",
  CLEAR_LOGS: "red",
};

export function LogAktivitasClient({ initialLogs }: { initialLogs: LogRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null);

  const handleClearLogs = () => {
    startTransition(async () => {
      try {
        const res = await clearActivityLogs();
        if (res.ok) {
          toast.success("Log aktivitas berhasil dibersihkan.");
          router.refresh();
        } else if (res.error) {
          toast.error(res.error);
        }
      } catch (err) {
        toast.error("Terjadi kesalahan sistem.");
      }
    });
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return initialLogs.filter((log) => {
      const matchesSearch =
        log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.aksi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.entitasId && log.entitasId.includes(searchQuery));

      const matchesAction = actionFilter === "ALL" || log.aksi === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [initialLogs, searchQuery, actionFilter]);

  const logPg = usePagination(filteredLogs, 10);

  // Unique actions for filters
  const uniqueActions = useMemo(() => {
    const actions = new Set(initialLogs.map((l) => l.aksi));
    return Array.from(actions);
  }, [initialLogs]);

  // Parse details diff safely
  const parsedDetails = useMemo(() => {
    if (!selectedLog?.detail) return null;
    try {
      return JSON.parse(selectedLog.detail);
    } catch {
      return selectedLog.detail;
    }
  }, [selectedLog]);

  return (
    <div className="space-y-6">
      {/* Search and Filters bar */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center p-5">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-3.5 text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan operator / ID target..."
            className="pl-9 h-11"
          />
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="w-56">
            <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="ALL">Semua Jenis Aksi</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="danger"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isPending}
            className="flex items-center gap-2 shrink-0"
          >
            <Trash2 size={16} />
            Bersihkan Log
          </Button>
        </div>
      </Card>

      {/* Audit table grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <thead>
            <tr>
              <Th>Waktu</Th>
              <Th>Operator Staff</Th>
              <Th>Aksi</Th>
              <Th>Entitas Target</Th>
              <Th>ID Target</Th>
              <Th className="text-center">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {logPg.pageData.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/50">
                <Td className="text-slate-500 font-medium text-xs">
                  {formatTanggal(log.createdAt)}
                </Td>
                <Td>
                  <div className="font-semibold text-slate-800">{log.userName}</div>
                  <div className="text-[10px] text-muted">{log.userRole}</div>
                </Td>
                <Td>
                  <Badge tone={AKSI_TONE[log.aksi] ?? "slate"}>
                    {log.aksi}
                  </Badge>
                </Td>
                <Td className="font-medium text-xs text-slate-650">{log.entitas}</Td>
                <Td className="font-mono text-xs text-slate-500">
                  {log.entitasId ? `#${log.entitasId}` : "—"}
                </Td>
                <Td className="text-center">
                  {log.detail ? (
                    <Button size="sm" variant="outline" onClick={() => setSelectedLog(log)}>
                      <Eye size={12} /> Detail Perubahan
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </Td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <Td colSpan={6} className="py-12 text-center text-muted">
                  Tidak ada audit log yang cocok dengan filter saat ini.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <div className="px-4 pb-3">
          <Pagination page={logPg.page} perPage={logPg.perPage} total={logPg.total} onPage={logPg.setPage} onPerPage={logPg.setPerPage} />
        </div>
      </div>

      {/* JSON Inspector / Diff Dialog */}
      {selectedLog && parsedDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs" onClick={() => setSelectedLog(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl overflow-y-auto max-h-[85vh] p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <History size={16} className="text-primary" /> Detail Riwayat Audit
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Meta details */}
              <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-lg border border-border">
                <p><strong>Aksi:</strong> {selectedLog.aksi}</p>
                <p><strong>Operator:</strong> {selectedLog.userName} ({selectedLog.userRole})</p>
                <p><strong>Tanggal Log:</strong> {new Date(selectedLog.createdAt).toLocaleString("id-ID")}</p>
              </div>

              {/* Parsed Diff representation */}
              <div>
                <Label>Metadata Perubahan (Format JSON)</Label>
                <div className="rounded-lg bg-slate-900 p-4 overflow-x-auto text-[11px] font-mono text-emerald-400 max-h-72">
                  <pre>{JSON.stringify(parsedDetails, null, 2)}</pre>
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full" variant="outline" onClick={() => setSelectedLog(null)}>
                  Tutup Rincian
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ModernDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleClearLogs}
        title="Bersihkan Log Aktivitas?"
        description="Tindakan ini akan menghapus seluruh data riwayat audit/log aktivitas secara permanen dan tidak dapat dibatalkan. Apakah Anda yakin?"
        confirmText="Ya, Bersihkan"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
