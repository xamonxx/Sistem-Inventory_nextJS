"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Printer, ArrowLeft, FileText } from "lucide-react";
import { printArea } from "@/lib/print";

export function PrintBar({ backHref }: { backHref: string }) {
  const router = useRouter();

  function printFormat(format: "thermal" | "a4") {
    if (format === "a4") {
      printArea({ className: "print-format-a4" });
    } else {
      printArea({ thermal: true });
    }
  }

  return (
    <div className="no-print flex flex-wrap gap-2 justify-between w-full">
      <Button variant="outline" onClick={() => router.push(backHref)}>
        <ArrowLeft size={16} /> Kembali
      </Button>
      <div className="flex gap-2">
        <Button onClick={() => printFormat("thermal")} variant="outline">
          <Printer size={16} /> Cetak Nota (Thermal)
        </Button>
        <Button onClick={() => printFormat("a4")}>
          <FileText size={16} /> Simpan PDF (A4)
        </Button>
      </div>
    </div>
  );
}
