import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { ean13CheckDigit, generateEAN13 } from "@/lib/barcode";
import { toast } from "sonner";
import { Download, Printer, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authed/barcodes")({ component: BarcodesPage });

function BarcodesPage() {
  const qc = useQueryClient();
  const [format, setFormat] = useState<"CODE128" | "EAN13" | "UPC">("CODE128");
  const [value, setValue] = useState("KH-MNG-200");
  const [qrUrl, setQrUrl] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products-bc"],
    queryFn: async () => (await supabase.from("products").select("id, name, sku, variant, barcode, upc_code")).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("products").select("id").limit(1)).data,
  });

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value || " ", { format, displayValue: true, fontSize: 16, height: 80, margin: 10, background: "#fffaf0" });
      } catch (e: any) {
        // invalid input
      }
    }
    QRCode.toDataURL(value || " ", { margin: 1, width: 200 }).then(setQrUrl).catch(() => {});
  }, [value, format]);

  function downloadPNG() {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const a = document.createElement("a"); a.download = `${value}.png`; a.href = canvas.toDataURL("image/png"); a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  }
  function downloadSVG() {
    if (!svgRef.current) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svgRef.current)], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.download = `${value}.svg`; a.href = URL.createObjectURL(blob); a.click();
  }
  function downloadPDF() {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      const doc = new jsPDF({ unit: "mm", format: [60, 30] });
      doc.addImage(c.toDataURL("image/png"), "PNG", 2, 2, 56, 26);
      doc.save(`${value}.pdf`);
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  }

  async function autoAssign() {
    let serial = 1;
    for (const p of products as any[]) {
      if (p.upc_code) continue;
      const ean = generateEAN13("890", serial++);
      await supabase.from("products").update({ upc_code: ean, barcode: ean }).eq("id", p.id);
    }
    toast.success("Auto-assigned EAN-13 codes");
    qc.invalidateQueries({ queryKey: ["products-bc"] });
  }

  function bulkPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const cols = 3, rows = 8, w = 65, h = 33;
    let i = 0;
    (products as any[]).forEach((p) => {
      const code = p.upc_code || p.barcode || p.sku;
      const tmp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      try { JsBarcode(tmp, code, { format: "CODE128", displayValue: true, fontSize: 12, height: 40, margin: 4 }); } catch { return; }
      const c = document.createElement("canvas"); c.width = 400; c.height = 200;
      const img = new Image();
      const svgStr = new XMLSerializer().serializeToString(tmp);
      img.src = "data:image/svg+xml;base64," + btoa(svgStr);
      // sync-ish: fall back to drawing all later. Simpler: build async.
    });
    // Simpler bulk: call below
    (async () => {
      let idx = 0;
      for (const p of products as any[]) {
        const code = p.upc_code || p.barcode || p.sku;
        const tmp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        try { JsBarcode(tmp, code, { format: "CODE128", displayValue: true, fontSize: 12, height: 40, margin: 4 }); } catch { continue; }
        const dataUrl = await svgToPng(tmp);
        const col = idx % cols, row = Math.floor(idx / cols) % rows;
        if (idx > 0 && idx % (cols * rows) === 0) doc.addPage();
        const x = 8 + col * (w + 5), y = 10 + row * h;
        doc.setFontSize(8); doc.text(`${p.name} (${p.variant})`, x, y - 1);
        doc.addImage(dataUrl, "PNG", x, y, w, h - 6);
        idx++;
      }
      doc.save("khamaruzz-barcodes.pdf");
    })();
  }

  return (
    <div>
      <PageHeader title="Barcodes & UPC" subtitle="Generate Code128, EAN-13, UPC-A, and QR codes."
        actions={<>
          <Button variant="outline" onClick={autoAssign}><Wand2 className="h-4 w-4 mr-1" /> Auto-assign EAN-13</Button>
          <Button onClick={bulkPDF}><Printer className="h-4 w-4 mr-1" /> Bulk Print PDF</Button>
        </>} />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-brand">
          <CardHeader><CardTitle className="text-base">Generator</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="w-full border border-input rounded h-9 px-2 bg-background">
                  <option>CODE128</option><option>EAN13</option><option>UPC</option>
                </select>
              </div>
              <div><Label>Value</Label><Input value={value} onChange={(e) => setValue(e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted-foreground">EAN-13 needs 12 digits (auto-checksum). UPC-A needs 11 digits.</p>
            <div className="bg-[#fffaf0] rounded-md p-4 border border-brand grid place-items-center min-h-[140px]">
              <svg ref={svgRef} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={downloadPNG}><Download className="h-3 w-3 mr-1" /> PNG</Button>
              <Button size="sm" variant="outline" onClick={downloadSVG}><Download className="h-3 w-3 mr-1" /> SVG</Button>
              <Button size="sm" variant="outline" onClick={downloadPDF}><Download className="h-3 w-3 mr-1" /> PDF</Button>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(value)}>Copy value</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardHeader><CardTitle className="text-base">QR Code</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Encodes the same value above. Useful for traceability and storefront links.</p>
            {qrUrl && <img src={qrUrl} alt="QR" className="border border-brand rounded p-2 bg-[#fffaf0]" />}
          </CardContent>
        </Card>
      </div>

      <Card className="border-brand mt-6">
        <CardHeader><CardTitle className="text-base">Product code mapping</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th>Product</th><th>Variant</th><th>SKU</th><th>EAN/UPC</th><th></th></tr></thead>
            <tbody>
              {(products as any[]).map((p) => (
                <tr key={p.id} className="border-t border-border/50">
                  <td className="py-2">{p.name}</td><td>{p.variant}</td>
                  <td className="font-mono text-xs">{p.sku}</td>
                  <td className="font-mono text-xs">{p.upc_code ?? "—"}</td>
                  <td><Button size="sm" variant="ghost" onClick={() => setValue(p.upc_code || p.sku)}>Preview</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function svgToPng(svg: SVGSVGElement): Promise<string> {
  return new Promise((res) => {
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      res(c.toDataURL("image/png"));
    };
    img.src = "data:image/svg+xml;base64," + btoa(data);
  });
}
