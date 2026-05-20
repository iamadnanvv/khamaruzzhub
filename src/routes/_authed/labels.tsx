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

  // Render barcode on every change — sized to fit within the safe content width
  useEffect(() => {
    if (!product) return;
    const svg = document.getElementById("label-barcode-svg") as SVGSVGElement | null;
    if (!svg) return;
    const code = product.barcode || product.upc_code || product.sku || "0000000000000";
    const innerW = dim.wPx - SAFE_PX * 2; // safe content width
    try {
      JsBarcode(svg, String(code), {
        format: "CODE128",
        displayValue: true,
        fontSize: Math.max(10, Math.round(innerW * 0.04)),
        height: Math.round(dim.hPx * 0.09),
        width: Math.max(1, Math.min(2, innerW / 180)),
        margin: 0,
        background: "transparent",
      });
      // Force the rendered SVG to never exceed the safe content width
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.style.maxWidth = `${innerW - 8}px`;
      svg.style.width = "100%";
      svg.style.height = "auto";
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
  /* Tell the printer the physical media size but keep a small printable inset
     so the barcode + text stay inside the label even on printers that can't
     print fully edge-to-edge. */
  @page { size: ${dim.wPrint} ${dim.hPrint}; margin: ${SAFE_IN}in; }
  html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Inter, system-ui, -apple-system, sans-serif; }
  .pl-wrap {
    /* Inner safe area = label size minus 2 * safe margin on each axis */
    width: calc(${dim.wPrint} - ${SAFE_IN * 2}in);
    height: calc(${dim.hPrint} - ${SAFE_IN * 2}in);
    overflow: hidden;
    box-sizing: border-box;
  }
  /* Force the label div to fill the safe area exactly */
  .pl-wrap > * {
    width: 100% !important;
    height: 100% !important;
    box-sizing: border-box;
  }
  img, svg { max-width: 100%; }
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
              style={{
                width: `${dim.wPx}px`,
                height: `${dim.hPx}px`,
                backgroundImage: `
                  radial-gradient(circle at 0% 0%, rgba(168,77,52,0.08) 0 18px, transparent 19px),
                  radial-gradient(circle at 100% 0%, rgba(168,77,52,0.08) 0 18px, transparent 19px),
                  radial-gradient(circle at 0% 100%, rgba(168,77,52,0.08) 0 18px, transparent 19px),
                  radial-gradient(circle at 100% 100%, rgba(168,77,52,0.08) 0 18px, transparent 19px),
                  linear-gradient(180deg, #fffaf0 0%, #fdf3df 100%)
                `,
              }}
              className="border-2 border-[color:var(--brand-terracotta)] shadow-lg flex flex-col text-[color:var(--brand-terracotta)] relative overflow-hidden"
            >
              {/* Decorative inner double border */}
              <div className="pointer-events-none absolute inset-1.5 border border-[color:var(--brand-terracotta)]/40 rounded-[2px]" />
              {/* Corner ornaments */}
              <CornerOrnament className="top-2 left-2" />
              <CornerOrnament className="top-2 right-2" rotate={90} />
              <CornerOrnament className="bottom-2 right-2" rotate={180} />
              <CornerOrnament className="bottom-2 left-2" rotate={270} />

              {/* Header */}
              <div className="relative flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
                <img src={logo} alt="" className="h-10 w-10 object-contain shrink-0 drop-shadow-sm" />
                <div className="leading-tight min-w-0 flex-1 text-center">
                  <div style={{ fontFamily: "Playfair Display, serif" }} className="text-[14px] font-bold tracking-wide">Khamaruzz Naadan Achaar</div>
                  <div className="text-[7.5px] uppercase tracking-[0.22em] text-brand-leaf mt-0.5">Homemade · Authentic Kerala</div>
                </div>
              </div>

              <OrnateDivider />

              {/* Product name + price */}
              <div className="relative text-center px-3 py-1.5 shrink-0">
                <div style={{ fontFamily: "Playfair Display, serif" }} className="text-[18px] font-bold leading-tight italic">
                  {product.name}
                </div>
                <div className="text-[10px] mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--brand-terracotta)]/10 border border-[color:var(--brand-terracotta)]/30">
                  <span>Net Wt: <b>{product.variant}</b></span>
                  <span className="opacity-50">•</span>
                  <span>MRP <b>{inr(product.selling_price)}</b></span>
                </div>
                <div className="text-[7.5px] mt-0.5 opacity-70 uppercase tracking-widest">Inclusive of all taxes</div>
              </div>

              <OrnateDivider />

              {/* Ingredients */}
              <div className="relative flex-1 min-h-0 px-4 py-2 text-[9px] leading-[1.4] overflow-hidden">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-px flex-1 bg-[color:var(--brand-terracotta)]/30" />
                  <span className="font-bold uppercase tracking-[0.2em] text-[8px]">Ingredients</span>
                  <span className="h-px flex-1 bg-[color:var(--brand-terracotta)]/30" />
                </div>
                <div className="break-words text-center italic">
                  {product.ingredients || defaultIngredientsFor(product.name)}
                </div>
              </div>

              {/* Dates + FSSAI + Batch */}
              <div className="relative px-4 py-2 text-[9px] leading-tight shrink-0 space-y-1 bg-[color:var(--brand-terracotta)]/5 border-y border-[color:var(--brand-terracotta)]/30">
                <div className="grid grid-cols-2 gap-x-3">
                  <div><b>MFG Date:</b> {product.mfg_date ? formatDate(product.mfg_date) : formatDate(new Date())}</div>
                  <div className="text-right"><b>EXP Date:</b> {product.expiry_date ? formatDate(product.expiry_date) : formatDate(new Date(Date.now() + (product.shelf_life_days || 180) * 86400000))}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-3">
                  <div><b>Batch:</b> {(product.sku || "B") + "-" + new Date().toISOString().slice(2,10).replace(/-/g,"")}</div>
                  <div className="text-right"><b>Packed:</b> {formatDate(new Date())}</div>
                </div>
                <div className="text-center pt-0.5"><b>FSSAI Lic No:</b> {product.fssai_number || "—"}</div>
              </div>

              {/* Barcode */}
              <div className="relative grid place-items-center bg-white px-3 py-2 shrink-0">
                <svg id="label-barcode-svg" style={{ maxWidth: "100%", height: "auto", display: "block" }} />
              </div>

              {/* Footer */}
              <div className="relative text-center px-2 py-1.5 text-[7.5px] uppercase tracking-[0.25em] bg-[color:var(--brand-terracotta)] text-[color:var(--brand-cream)] shrink-0 font-semibold">
                ✦ Made with Love · khamaruzz.com ✦
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
