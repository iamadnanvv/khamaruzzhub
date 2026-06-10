import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, FileArchive } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authed/backup")({
  component: BackupPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

const TABLES = [
  "products", "inventory", "raw_materials", "materials_purchased",
  "production_batches", "raw_material_consumption", "recipes",
  "orders", "order_items", "customers", "suppliers",
  "purchase_orders", "purchase_order_items", "alerts", "audit_log",
] as const;

async function fetchAll() {
  const out: Record<string, any[]> = {};
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t as any).select("*");
    if (error) {
      console.warn(`[backup] ${t}:`, error.message);
      out[t] = [];
    } else {
      out[t] = data ?? [];
    }
  }
  return out;
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map(r => keys.map(k => esc(r[k])).join(","))].join("\n");
}

function BackupPage() {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: "csv" | "xlsx" | "pdf", fn: (snap: Record<string, any[]>) => Promise<void>) {
    setBusy(kind);
    try {
      const snap = await fetchAll();
      await fn(snap);
      await logAudit({
        action: "backup.export",
        entity: "database",
        details: { format: kind, tables: TABLES.length, total_rows: Object.values(snap).reduce((a, b) => a + b.length, 0) },
      });
      toast.success(`Backup downloaded (${kind.toUpperCase()})`);
    } catch (e: any) {
      toast.error(e.message ?? "Backup failed");
    } finally {
      setBusy(null);
    }
  }

  const csv = () => run("csv", async (snap) => {
    const zip = new JSZip();
    for (const [name, rows] of Object.entries(snap)) zip.file(`${name}.csv`, toCSV(rows));
    zip.file("manifest.json", JSON.stringify({ generated_at: new Date().toISOString(), tables: Object.fromEntries(Object.entries(snap).map(([k, v]) => [k, v.length])) }, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    download(blob, `khamaruzz-backup-${ts()}.zip`);
  });

  const xlsx = () => run("xlsx", async (snap) => {
    const wb = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(snap)) {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: "empty" }]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    }
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `khamaruzz-backup-${ts()}.xlsx`);
  });

  const pdf = () => run("pdf", async (snap) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Khamaruzz Achaar — Database Snapshot", 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);
    let y = 28;
    for (const [name, rows] of Object.entries(snap)) {
      if (y > 180) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.text(`${name} (${rows.length})`, 14, y);
      y += 4;
      if (rows.length) {
        const keys = Object.keys(rows[0]).slice(0, 6);
        autoTable(doc, {
          startY: y,
          head: [keys],
          body: rows.slice(0, 25).map(r => keys.map(k => {
            const v = r[k]; if (v == null) return "";
            const s = typeof v === "object" ? JSON.stringify(v) : String(v);
            return s.length > 30 ? s.slice(0, 27) + "…" : s;
          })),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [120, 53, 15] },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      } else {
        doc.setFontSize(8); doc.text("(empty)", 14, y + 4); y += 10;
      }
    }
    doc.save(`khamaruzz-backup-${ts()}.pdf`);
  });

  return (
    <>
      <PageHeader title="Backup & Export" subtitle="Download a full snapshot of your database" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2"><FileArchive className="h-5 w-5 text-primary" /><h3 className="font-display text-lg">CSV (zip)</h3></div>
          <p className="text-sm text-muted-foreground">All tables as separate .csv files inside a zip archive.</p>
          <Button onClick={csv} disabled={!!busy} className="w-full">
            <Download className="h-4 w-4 mr-2" />{busy === "csv" ? "Preparing…" : "Download CSV.zip"}
          </Button>
        </Card>
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /><h3 className="font-display text-lg">Excel (.xlsx)</h3></div>
          <p className="text-sm text-muted-foreground">Single workbook, one worksheet per table.</p>
          <Button onClick={xlsx} disabled={!!busy} className="w-full">
            <Download className="h-4 w-4 mr-2" />{busy === "xlsx" ? "Preparing…" : "Download .xlsx"}
          </Button>
        </Card>
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h3 className="font-display text-lg">PDF Report</h3></div>
          <p className="text-sm text-muted-foreground">Printable snapshot summary (first 25 rows per table).</p>
          <Button onClick={pdf} disabled={!!busy} className="w-full">
            <Download className="h-4 w-4 mr-2" />{busy === "pdf" ? "Preparing…" : "Download .pdf"}
          </Button>
        </Card>
      </div>
      <Card className="mt-6 p-5 text-sm text-muted-foreground">
        <p>Snapshots include {TABLES.length} tables. Each export is timestamped and logged in the Audit Log.</p>
      </Card>
    </>
  );
}
