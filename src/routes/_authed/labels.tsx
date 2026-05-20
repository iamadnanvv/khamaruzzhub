import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";
import JsBarcode from "jsbarcode";
import { Printer, Download } from "lucide-react";
import { inr, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/labels")({ component: LabelsPage });

// Pixel-accurate sizes (96 dpi for screen, scales 1:1 to inches at print)
// Safe margin (in inches) reserved on each edge so printers without true edge-to-edge
// don't clip the barcode or text. Content area = full size - 2 * SAFE_IN.
const SAFE_IN = 0.12;
const PX_PER_IN = 96;
const SAFE_PX = Math.round(SAFE_IN * PX_PER_IN); // ~12px

const SIZES = {
  "4x6":  { wPx: 384, hPx: 576, wPrint: "4in",   hPrint: "6in",   label: "4 × 6 inch (recommended)" },
  "3x4":  { wPx: 288, hPx: 384, wPrint: "3in",   hPrint: "4in",   label: "3 × 4 inch" },
  "2x3":  { wPx: 192, hPx: 288, wPrint: "2in",   hPrint: "3in",   label: "2 × 3 inch (small jar)" },
};

function defaultIngredientsFor(name?: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("mango")) return "Tender mango, gingelly oil, red chilli powder, salt, fenugreek, mustard, asafoetida, turmeric, garlic, curry leaves.";
  if (n.includes("chilli") || n.includes("chili")) return "Green chilli, gingelly oil, salt, mustard, fenugreek, asafoetida, turmeric, vinegar, curry leaves.";
  if (n.includes("garlic")) return "Garlic, gingelly oil, red chilli powder, salt, mustard, fenugreek, asafoetida, turmeric, vinegar, curry leaves.";
  if (n.includes("lemon") || n.includes("lime")) return "Lemon, gingelly oil, salt, red chilli powder, mustard, fenugreek, asafoetida, turmeric.";
  if (n.includes("ginger")) return "Ginger, gingelly oil, salt, tamarind, red chilli, mustard, fenugreek, asafoetida, turmeric, curry leaves.";
  if (n.includes("fish")) return "Fish, gingelly oil, red chilli powder, salt, ginger, garlic, mustard, fenugreek, vinegar, curry leaves.";
  if (n.includes("prawn")) return "Prawn, gingelly oil, red chilli powder, salt, ginger, garlic, mustard, vinegar, curry leaves.";
  if (n.includes("date")) return "Dates, tamarind, jaggery, gingelly oil, red chilli, salt, mustard, fenugreek, asafoetida.";
  return "Traditional Kerala spices, gingelly oil, salt — please refer to product details.";
}

function LabelsPage() {
  const [productId, setProductId] = useState("");
  const [size, setSize] = useState<keyof typeof SIZES>("4x6");
  const labelRef = useRef<HTMLDivElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products-labels"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });
  useEffect(() => { if (!productId && products.length) setProductId((products[0] as any).id); }, [products, productId]);

  const product: any = (products as any[]).find((p) => p.id === productId);
  const dim = SIZES[size];

  // Render barcode on every change
  useEffect(() => {
    if (!product) return;
    const svg = document.getElementById("label-barcode-svg") as SVGSVGElement | null;
    if (!svg) return;
    const code = product.barcode || product.upc_code || product.sku || "0000000000000";
    try {
      JsBarcode(svg, String(code), {
        format: "CODE128",
        displayValue: true,
        fontSize: Math.max(10, Math.round(dim.wPx * 0.035)),
        height: Math.round(dim.hPx * 0.09),
        width: Math.max(1, Math.round(dim.wPx / 220)),
        margin: 0,
        background: "transparent",
      });
    } catch (e) {
      console.error(e);
    }
  }, [product, size, dim]);

  function printLabel() {
    if (!labelRef.current) return;
    const html = labelRef.current.outerHTML;
    const w = window.open("", "", "width=700,height=900");
    if (!w) { toast.error("Pop-up blocked"); return; }
    w.document.write(`<!doctype html><html><head><title>${product?.name ?? "Label"}</title>
<style>
  @page { size: ${dim.wPrint} ${dim.hPrint}; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Inter, system-ui, -apple-system, sans-serif; }
  .pl-wrap { width: ${dim.wPrint}; height: ${dim.hPrint}; }
</style></head><body><div class="pl-wrap">${html}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 350);
  }

  async function downloadPng() {
    if (!labelRef.current || !product) return;
    try {
      const html2canvasMod = await import("html2canvas");
      const html2canvas = html2canvasMod.default ?? (html2canvasMod as any);
      const canvas = await html2canvas(labelRef.current, { scale: 3, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `${product.name.replace(/\s+/g, "_")}_label.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast.error("PNG export needs html2canvas — using print instead");
      printLabel();
    }
  }

  return (
    <div>
      <PageHeader
        title="Label Printing"
        subtitle="Brand-compliant labels with barcode, ingredients, MFG/EXP and FSSAI — on a single sheet."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadPng}><Download className="h-4 w-4 mr-1" /> PNG</Button>
            <Button onClick={printLabel}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Card className="border-brand">
          <CardContent className="p-5 space-y-4">
            <div>
              <Label>Product</Label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full border border-input rounded h-9 px-2 bg-background">
                {(products as any[]).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.variant}</option>)}
              </select>
            </div>
            <div>
              <Label>Label size</Label>
              <select value={size} onChange={(e) => setSize(e.target.value as any)} className="w-full border border-input rounded h-9 px-2 bg-background">
                {Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><b>Print tip:</b> set scale to 100%, no headers/footers.</p>
              <p>Barcode auto-uses product's barcode → UPC → SKU.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-brand p-6 grid place-items-center bg-[repeating-linear-gradient(45deg,_#fdf6e6_0_10px,_#f7eed8_10px_20px)]">
          {product && (
            <div
              ref={labelRef}
              style={{ width: `${dim.wPx}px`, height: `${dim.hPx}px` }}
              className="bg-[#fffaf0] border-2 border-[color:var(--brand-terracotta)] shadow-lg flex flex-col text-[color:var(--brand-terracotta)] relative"
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-[color:var(--brand-terracotta)]/30 shrink-0">
                <img src={logo} alt="" className="h-9 w-9 object-contain shrink-0" />
                <div className="leading-tight min-w-0 flex-1">
                  <div style={{ fontFamily: "Playfair Display, serif" }} className="text-[13px] font-bold truncate">Khamaruzz Naadan Achaar</div>
                  <div className="text-[7.5px] uppercase tracking-[0.18em] text-brand-leaf">Homemade · Kerala</div>
                </div>
              </div>

              {/* Product name + price */}
              <div className="text-center px-3 py-1.5 border-b border-dashed border-[color:var(--brand-terracotta)]/30 shrink-0">
                <div style={{ fontFamily: "Playfair Display, serif" }} className="text-[17px] font-bold leading-tight">{product.name}</div>
                <div className="text-[10px] mt-0.5">Net Wt: <b>{product.variant}</b> · MRP <b>{inr(product.selling_price)}</b> <span className="opacity-70">(incl. GST)</span></div>
              </div>

              {/* Ingredients */}
              <div className="flex-1 min-h-0 px-3 py-2 text-[9px] leading-[1.35] overflow-hidden">
                <div className="font-semibold uppercase tracking-wider text-[8px] mb-1">Ingredients</div>
                <div className="break-words">{product.ingredients || defaultIngredientsFor(product.name)}</div>
              </div>

              {/* Dates + FSSAI + Batch */}
              <div className="px-3 py-1.5 text-[9px] leading-tight border-t border-dashed border-[color:var(--brand-terracotta)]/30 shrink-0 space-y-0.5">
                <div className="grid grid-cols-2 gap-x-2">
                  <div><b>MFG Date:</b> {product.mfg_date ? formatDate(product.mfg_date) : formatDate(new Date())}</div>
                  <div className="text-right"><b>EXP Date:</b> {product.expiry_date ? formatDate(product.expiry_date) : formatDate(new Date(Date.now() + (product.shelf_life_days || 180) * 86400000))}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-2">
                  <div><b>Batch:</b> {(product.sku || "B") + "-" + new Date().toISOString().slice(2,10).replace(/-/g,"")}</div>
                  <div className="text-right"><b>Packed:</b> {formatDate(new Date())}</div>
                </div>
                <div><b>FSSAI Lic No:</b> {product.fssai_number || "—"}</div>
              </div>

              {/* Barcode */}
              <div className="grid place-items-center bg-white px-2 py-1.5 border-t border-[color:var(--brand-terracotta)]/30 shrink-0">
                <svg id="label-barcode-svg" style={{ maxWidth: "100%", height: "auto", display: "block" }} />
              </div>

              {/* Footer */}
              <div className="text-center px-2 py-1 text-[7.5px] uppercase tracking-widest bg-[color:var(--brand-terracotta)] text-[color:var(--brand-cream)] shrink-0">
                Made with love · khamaruzz.com
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
