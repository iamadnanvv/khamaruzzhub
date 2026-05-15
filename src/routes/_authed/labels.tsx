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
import { Printer } from "lucide-react";
import { inr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/labels")({ component: LabelsPage });

const SIZES = {
  "2x1":  { w: "2in", h: "1in", label: "2 × 1 inch" },
  "4x6":  { w: "4in", h: "6in", label: "4 × 6 inch" },
  "a4":   { w: "190mm", h: "277mm", label: "A4 sticker sheet" },
};

function LabelsPage() {
  const [productId, setProductId] = useState("");
  const [size, setSize] = useState<keyof typeof SIZES>("4x6");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products-labels"],
    queryFn: async () => (await supabase.from("products").select("*")).data ?? [],
  });
  useEffect(() => { if (!productId && products.length) setProductId((products[0] as any).id); }, [products, productId]);

  const product: any = (products as any[]).find((p) => p.id === productId);

  useEffect(() => {
    const svg = document.getElementById("label-barcode-svg") as SVGSVGElement | null;
    if (svg && product) {
      try { JsBarcode(svg, product.barcode || product.upc_code || product.sku, { format: "CODE128", displayValue: true, fontSize: 12, height: 40, margin: 0 }); } catch {}
    }
  }, [product, size]);

  function printLabel() {
    if (!printRef.current) return;
    const w = window.open("", "", "width=600,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>Label</title>
      <style>
        @page { size: ${SIZES[size].w} ${SIZES[size].h}; margin: 0; }
        body { margin: 0; font-family: 'Inter', sans-serif; }
      </style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 300);
  }

  return (
    <div>
      <PageHeader title="Label Printing" subtitle="Brand-compliant product labels with barcode, ingredients, FSSAI."
        actions={<Button onClick={printLabel}><Printer className="h-4 w-4 mr-1" /> Print</Button>} />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-brand lg:col-span-1">
          <CardContent className="p-5 space-y-4">
            <div><Label>Product</Label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full border border-input rounded h-9 px-2 bg-background">
                {(products as any[]).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.variant}</option>)}
              </select>
            </div>
            <div><Label>Label size</Label>
              <select value={size} onChange={(e) => setSize(e.target.value as any)} className="w-full border border-input rounded h-9 px-2 bg-background">
                {Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Tip: in print dialog, set scale to 100% and disable browser headers/footers.</p>
          </CardContent>
        </Card>

        <Card className="border-brand lg:col-span-2 grid place-items-center p-6 bg-[repeating-linear-gradient(45deg,_#fdf6e6_0_10px,_#f7eed8_10px_20px)]">
          {product && (
            <div ref={printRef}>
              <div style={{ width: SIZES[size].w, height: SIZES[size].h }}
                   className="bg-[#fffaf0] border border-[color:var(--brand-terracotta)] p-3 flex flex-col justify-between text-[color:var(--brand-terracotta)]">
                <div className="flex items-start gap-2">
                  <img src={logo} alt="" className="h-10 w-10 object-contain" />
                  <div className="leading-tight">
                    <div style={{ fontFamily: "Playfair Display, serif" }} className="text-sm font-bold">Khamaruzz Naadan Achaar</div>
                    <div className="text-[8px] uppercase tracking-widest text-brand-leaf">Made with love</div>
                  </div>
                </div>
                <div className="text-center my-1">
                  <div style={{ fontFamily: "Playfair Display, serif" }} className="text-base font-bold">{product.name}</div>
                  <div className="text-[10px]">Net wt: {product.variant}  ·  MRP: {inr(product.selling_price)} (incl. GST)</div>
                </div>
                <div className="text-[8px] leading-tight">
                  <div><b>Ingredients:</b> {product.ingredients}</div>
                  <div className="flex justify-between mt-1">
                    <span>Mfg: {formatDate(product.mfg_date) ?? "—"}</span>
                    <span>Best before: {product.shelf_life_days ? `${product.shelf_life_days}d` : "—"}</span>
                  </div>
                  <div>FSSAI: {product.fssai_number}</div>
                </div>
                <div className="grid place-items-center mt-1">
                  <svg id="label-barcode-svg" />
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
