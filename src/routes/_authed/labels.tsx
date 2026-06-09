import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import logo from "@/assets/logo.png";
import JsBarcode from "jsbarcode";
import { Printer, Download, Save, Trash2 } from "lucide-react";
import { inr, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/labels")({ component: LabelsPage });

const SAFE_IN = 0.12;
const PX_PER_IN = 96;
const SAFE_PX = Math.round(SAFE_IN * PX_PER_IN);

const SIZES = {
  "4x6":  { wPx: 384, hPx: 576, wPrint: "4in",   hPrint: "6in",   label: "4 × 6 inch (recommended)" },
  "3x4":  { wPx: 288, hPx: 384, wPrint: "3in",   hPrint: "4in",   label: "3 × 4 inch" },
  "2x3":  { wPx: 192, hPx: 288, wPrint: "2in",   hPrint: "3in",   label: "2 × 3 inch (small jar)" },
};

const THEMES = {
  ornate:   "Ornate (Kerala heritage)",
  classic:  "Classic (clean serif)",
  minimal:  "Minimal (one-page sticker)",
} as const;
type ThemeKey = keyof typeof THEMES;

const TEMPLATE_KEY = "khamaruzz.label.templates.v1";
type Template = { name: string; size: keyof typeof SIZES; theme: ThemeKey; createdAt: string };

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

function loadTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "[]"); } catch { return []; }
}
function saveTemplates(t: Template[]) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(t));
}

function LabelsPage() {
  const [productId, setProductId] = useState("");
  const [size, setSize] = useState<keyof typeof SIZES>("4x6");
  const [theme, setTheme] = useState<ThemeKey>("ornate");
  const [showSafeOverlay, setShowSafeOverlay] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTemplates(loadTemplates()); }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["products-labels"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });
  useEffect(() => { if (!productId && products.length) setProductId((products[0] as any).id); }, [products, productId]);

  const product: any = (products as any[]).find((p) => p.id === productId);
  const dim = SIZES[size];

  // Render barcode — sized to safe content width
  useEffect(() => {
    if (!product) return;
    const svg = document.getElementById("label-barcode-svg") as SVGSVGElement | null;
    if (!svg) return;
    const code = product.barcode || product.upc_code || product.sku || "0000000000000";
    const innerW = dim.wPx - SAFE_PX * 2;
    try {
      JsBarcode(svg, String(code), {
        format: "CODE128",
        displayValue: true,
        fontSize: Math.max(10, Math.round(innerW * 0.04)),
        height: Math.round(dim.hPx * (theme === "minimal" ? 0.11 : 0.09)),
        width: Math.max(1, Math.min(2, innerW / 180)),
        margin: 0,
        background: "transparent",
      });
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.style.maxWidth = `${innerW - 8}px`;
      svg.style.width = "100%";
      svg.style.height = "auto";
    } catch (e) {
      console.error(e);
    }
  }, [product, size, dim, theme]);

  function printLabel() {
    if (!labelRef.current) return;
    // Strip the on-screen safe-margin overlay from the print copy.
    const clone = labelRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-safe-overlay]").forEach((n) => n.remove());
    const html = clone.outerHTML;
    const w = window.open("", "", "width=700,height=900");
    if (!w) { toast.error("Pop-up blocked"); return; }
    w.document.write(`<!doctype html><html><head><title>${product?.name ?? "Label"}</title>
<style>
  @page { size: ${dim.wPrint} ${dim.hPrint}; margin: ${SAFE_IN}in; }
  html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Inter, system-ui, -apple-system, sans-serif; }
  .pl-wrap {
    width: calc(${dim.wPrint} - ${SAFE_IN * 2}in);
    height: calc(${dim.hPrint} - ${SAFE_IN * 2}in);
    overflow: hidden;
    box-sizing: border-box;
  }
  .pl-wrap > * { width: 100% !important; height: 100% !important; box-sizing: border-box; }
  img, svg { max-width: 100%; }
</style></head><body><div class="pl-wrap">${html}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 350);
  }

  async function downloadPng() {
    if (!labelRef.current || !product) return;
    try {
      // Hide overlay during capture
      const overlays = labelRef.current.querySelectorAll<HTMLElement>("[data-safe-overlay]");
      overlays.forEach((o) => (o.style.display = "none"));
      const html2canvasMod = await import("html2canvas");
      const html2canvas = html2canvasMod.default ?? (html2canvasMod as any);
      const canvas = await html2canvas(labelRef.current, { scale: 3, backgroundColor: "#ffffff" });
      overlays.forEach((o) => (o.style.display = ""));
      const link = document.createElement("a");
      link.download = `${product.name.replace(/\s+/g, "_")}_label.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast.error("PNG export needs html2canvas — using print instead");
      printLabel();
    }
  }

  function saveTemplate() {
    const name = window.prompt("Template name?", `${THEMES[theme].split(" ")[0]} ${size}`);
    if (!name) return;
    const next = [...templates.filter((t) => t.name !== name), { name, size, theme, createdAt: new Date().toISOString() }];
    saveTemplates(next);
    setTemplates(next);
    toast.success(`Template "${name}" saved`);
  }
  function applyTemplate(name: string) {
    const t = templates.find((x) => x.name === name);
    if (!t) return;
    setSize(t.size); setTheme(t.theme);
    toast.success(`Applied "${name}"`);
  }
  function deleteTemplate(name: string) {
    const next = templates.filter((t) => t.name !== name);
    saveTemplates(next); setTemplates(next);
  }

  return (
    <div>
      <PageHeader
        title="Label Printing"
        subtitle="Brand-compliant labels with barcode, ingredients, MFG/EXP and FSSAI — on a single sheet."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveTemplate}><Save className="h-4 w-4 mr-1" /> Save template</Button>
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
            <div>
              <Label>Design theme</Label>
              <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey)} className="w-full border border-input rounded h-9 px-2 bg-background">
                {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between rounded border border-input px-3 py-2">
              <div>
                <Label className="block">Safe-margin overlay</Label>
                <p className="text-[11px] text-muted-foreground">Dashed guide shows printable area.</p>
              </div>
              <Switch checked={showSafeOverlay} onCheckedChange={setShowSafeOverlay} />
            </div>

            <div>
              <Label>Saved templates</Label>
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">No templates yet. Customize and click "Save template".</p>
              ) : (
                <ul className="mt-1 space-y-1 max-h-44 overflow-auto">
                  {templates.map((t) => (
                    <li key={t.name} className="flex items-center gap-2 text-xs border border-input rounded px-2 py-1">
                      <button className="flex-1 text-left truncate hover:underline" onClick={() => applyTemplate(t.name)}>
                        <b>{t.name}</b>
                        <span className="opacity-60"> · {t.size} · {t.theme}</span>
                      </button>
                      <button className="opacity-60 hover:text-destructive" onClick={() => deleteTemplate(t.name)} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><b>Print tip:</b> set scale to 100%, no headers/footers.</p>
              <p>Barcode auto-uses product's barcode → UPC → SKU.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-brand p-6 grid place-items-center bg-[repeating-linear-gradient(45deg,_#fdf6e6_0_10px,_#f7eed8_10px_20px)]">
          {product && (
            <div className="relative">
              {/* Print preview safe-margin overlay (sits OUTSIDE the label so it's never captured) */}
              {showSafeOverlay && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-emerald-500/80 rounded-sm z-10"
                  style={{
                    top: SAFE_PX, left: SAFE_PX,
                    width: dim.wPx - SAFE_PX * 2,
                    height: dim.hPx - SAFE_PX * 2,
                  }}
                >
                  <span className="absolute -top-5 left-0 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-white/90 px-1.5 rounded">
                    Safe area · {(dim.wPx - SAFE_PX * 2)}×{(dim.hPx - SAFE_PX * 2)}px
                  </span>
                </div>
              )}
              <LabelRenderer ref={labelRef} product={product} dim={dim} theme={theme} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---- Label themes -----------------------------------------------------------

type RendererProps = {
  product: any;
  dim: typeof SIZES[keyof typeof SIZES];
  theme: ThemeKey;
};

const LabelRenderer = ({ ref, ...rest }: RendererProps & { ref?: React.Ref<HTMLDivElement> }) =>
  rest.theme === "minimal" ? <MinimalLabel innerRef={ref} {...rest} />
  : rest.theme === "classic" ? <ClassicLabel innerRef={ref} {...rest} />
  : <OrnateLabel innerRef={ref} {...rest} />;

// Workaround: forwardRef-free wrapper above so we can assign ref consistently.
function withCommonBox(dim: RendererProps["dim"]) {
  return {
    width: `${dim.wPx}px`,
    height: `${dim.hPx}px`,
  } as React.CSSProperties;
}

function DateBlock({ product }: { product: any }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-x-3">
        <div><b>MFG Date:</b> {product.mfg_date ? formatDate(product.mfg_date) : formatDate(new Date())}</div>
        <div className="text-right"><b>EXP Date:</b> {product.expiry_date ? formatDate(product.expiry_date) : formatDate(new Date(Date.now() + (product.shelf_life_days || 180) * 86400000))}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-3">
        <div><b>Batch:</b> {(product.sku || "B") + "-" + new Date().toISOString().slice(2,10).replace(/-/g,"")}</div>
        <div className="text-right"><b>Packed:</b> {formatDate(new Date())}</div>
      </div>
    </>
  );
}

function Barcode() {
  return <svg id="label-barcode-svg" style={{ maxWidth: "100%", height: "auto", display: "block" }} />;
}

// ---- Ornate (existing Kerala heritage) -------------------------------------

function OrnateLabel({ product, dim, innerRef }: RendererProps & { innerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={innerRef}
      style={{
        ...withCommonBox(dim),
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
      <div className="pointer-events-none absolute inset-1.5 border border-[color:var(--brand-terracotta)]/40 rounded-[2px]" />
      <CornerOrnament className="top-2 left-2" />
      <CornerOrnament className="top-2 right-2" rotate={90} />
      <CornerOrnament className="bottom-2 right-2" rotate={180} />
      <CornerOrnament className="bottom-2 left-2" rotate={270} />

      <div className="relative flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
        <img src={logo} alt="" className="h-10 w-10 object-contain shrink-0 drop-shadow-sm" />
        <div className="leading-tight min-w-0 flex-1 text-center">
          <div style={{ fontFamily: "Playfair Display, serif" }} className="text-[14px] font-bold tracking-wide">Khamaruzz Naadan Achaar</div>
          <div className="text-[7.5px] uppercase tracking-[0.22em] text-brand-leaf mt-0.5">Homemade · Authentic Kerala</div>
        </div>
      </div>

      <OrnateDivider />

      <div className="relative text-center px-3 py-1.5 shrink-0">
        <div style={{ fontFamily: "Playfair Display, serif" }} className="text-[18px] font-bold leading-tight italic">{product.name}</div>
        <div className="text-[10px] mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--brand-terracotta)]/10 border border-[color:var(--brand-terracotta)]/30">
          <span>Net Wt: <b>{product.variant}</b></span>
          <span className="opacity-50">•</span>
          <span>MRP <b>{inr(product.selling_price)}</b></span>
        </div>
        <div className="text-[7.5px] mt-0.5 opacity-70 uppercase tracking-widest">Inclusive of all taxes</div>
      </div>

      <OrnateDivider />

      <div className="relative flex-1 min-h-0 px-4 py-2 text-[9px] leading-[1.4] overflow-hidden">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="h-px flex-1 bg-[color:var(--brand-terracotta)]/30" />
          <span className="font-bold uppercase tracking-[0.2em] text-[8px]">Ingredients</span>
          <span className="h-px flex-1 bg-[color:var(--brand-terracotta)]/30" />
        </div>
        <div className="break-words text-center italic">{product.ingredients || defaultIngredientsFor(product.name)}</div>
      </div>

      <div className="relative px-4 py-2 text-[9px] leading-tight shrink-0 space-y-1 bg-[color:var(--brand-terracotta)]/5 border-y border-[color:var(--brand-terracotta)]/30">
        <DateBlock product={product} />
        <div className="text-center pt-0.5"><b>FSSAI Lic No:</b> {product.fssai_number || "—"}</div>
      </div>

      <div className="relative grid place-items-center bg-white px-3 py-2 shrink-0">
        <Barcode />
        <div className="text-center mt-1 text-[7px] uppercase tracking-[0.2em] text-[color:var(--brand-terracotta)]/80 font-medium leading-tight">
          <div>Authentic Homemade Kerala Pickles</div>
          <div className="normal-case tracking-[0.12em]">khamaruzzachaar.page.gd</div>
        </div>
      </div>

      <div className="relative text-center px-2 py-1 text-[7.5px] uppercase tracking-[0.25em] bg-[color:var(--brand-terracotta)] text-[color:var(--brand-cream)] shrink-0 font-semibold leading-tight">
        <div>✦ Authentic Homemade Kerala Pickles ✦</div>
        <div className="opacity-90 normal-case tracking-[0.15em] mt-0.5">khamaruzzachaar.page.gd</div>
      </div>
    </div>
  );
}

// ---- Classic ---------------------------------------------------------------

function ClassicLabel({ product, dim, innerRef }: RendererProps & { innerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={innerRef}
      style={withCommonBox(dim)}
      className="bg-white border border-[color:var(--brand-terracotta)] shadow flex flex-col text-[color:var(--brand-terracotta)] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-[color:var(--brand-terracotta)]/30 shrink-0">
        <img src={logo} alt="" className="h-9 w-9 object-contain shrink-0" />
        <div className="leading-tight flex-1">
          <div style={{ fontFamily: "Playfair Display, serif" }} className="text-[14px] font-bold">Khamaruzz Naadan Achaar</div>
          <div className="text-[8px] uppercase tracking-[0.18em] text-brand-leaf">Authentic Kerala · Homemade</div>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-[color:var(--brand-terracotta)]/20 shrink-0">
        <div style={{ fontFamily: "Playfair Display, serif" }} className="text-[17px] font-bold leading-tight">{product.name}</div>
        <div className="flex justify-between text-[10px] mt-1">
          <span>Net Wt: <b>{product.variant}</b></span>
          <span>MRP: <b>{inr(product.selling_price)}</b></span>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-3 py-2 text-[9px] leading-[1.45] overflow-hidden">
        <div className="font-bold uppercase tracking-wider text-[8px] mb-0.5">Ingredients</div>
        <div className="break-words">{product.ingredients || defaultIngredientsFor(product.name)}</div>
      </div>

      <div className="px-3 py-1.5 text-[9px] leading-tight shrink-0 space-y-0.5 border-t border-[color:var(--brand-terracotta)]/30">
        <DateBlock product={product} />
        <div><b>FSSAI Lic No:</b> {product.fssai_number || "—"}</div>
      </div>

      <div className="grid place-items-center bg-white px-3 py-1.5 border-t border-[color:var(--brand-terracotta)]/30 shrink-0">
        <Barcode />
        <div className="text-center mt-1 text-[7px] uppercase tracking-[0.18em] text-[color:var(--brand-terracotta)]/80 font-medium leading-tight">
          <div>Authentic Homemade Kerala Pickles</div>
          <div className="normal-case tracking-[0.1em]">khamaruzzachaar.page.gd</div>
        </div>
      </div>

      <div className="text-center px-2 py-1 text-[7.5px] border-t border-[color:var(--brand-terracotta)]/30 shrink-0 leading-tight">
        <div className="uppercase tracking-[0.2em] font-semibold">Authentic Homemade Kerala Pickles</div>
        <div className="opacity-80 tracking-[0.1em] mt-0.5">khamaruzzachaar.page.gd</div>
      </div>
    </div>
  );
}

// ---- Minimal one-page sticker ----------------------------------------------

function MinimalLabel({ product, dim, innerRef }: RendererProps & { innerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={innerRef}
      style={withCommonBox(dim)}
      className="bg-white border border-neutral-300 flex flex-col text-neutral-900 overflow-hidden"
    >
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="text-[9px] uppercase tracking-[0.3em] text-neutral-500">Khamaruzz</div>
        <div style={{ fontFamily: "Inter, system-ui, sans-serif" }} className="text-[18px] font-semibold leading-tight mt-0.5">
          {product.name}
        </div>
        <div className="text-[10px] text-neutral-600 mt-1">{product.variant} · {inr(product.selling_price)}</div>
      </div>

      <div className="flex-1 min-h-0 px-3 text-[9px] leading-[1.45] text-neutral-700 overflow-hidden">
        <span className="font-semibold">Ingredients: </span>
        <span className="break-words">{product.ingredients || defaultIngredientsFor(product.name)}</span>
      </div>

      <div className="px-3 py-1.5 text-[9px] leading-tight shrink-0 space-y-0.5 text-neutral-700 border-t border-neutral-200">
        <DateBlock product={product} />
        <div><b>FSSAI:</b> {product.fssai_number || "—"}</div>
      </div>

      <div className="grid place-items-center px-3 py-1.5 border-t border-neutral-200 shrink-0">
        <Barcode />
        <div className="text-center mt-1 text-[7px] uppercase tracking-[0.18em] text-neutral-500 font-medium leading-tight">
          <div>Authentic Homemade Kerala Pickles</div>
          <div className="normal-case tracking-[0.1em]">khamaruzzachaar.page.gd</div>
        </div>
      </div>

      <div className="text-center px-2 py-1 text-[7.5px] border-t border-neutral-200 shrink-0 leading-tight text-neutral-700">
        <div className="uppercase tracking-[0.18em] font-semibold">Authentic Homemade Kerala Pickles</div>
        <div className="opacity-80 tracking-[0.08em] mt-0.5">khamaruzzachaar.page.gd</div>
      </div>
    </div>
  );
}

// ---- Ornaments -------------------------------------------------------------

function CornerOrnament({ className = "", rotate = 0 }: { className?: string; rotate?: number }) {
  return (
    <svg
      className={`absolute h-4 w-4 text-[color:var(--brand-terracotta)] opacity-70 pointer-events-none ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"
    >
      <path d="M2 12 C 2 6, 6 2, 12 2" />
      <circle cx="3.5" cy="3.5" r="1.2" fill="currentColor" />
      <path d="M6 6 L 9 6 M6 6 L 6 9" />
    </svg>
  );
}

function OrnateDivider() {
  return (
    <div className="relative flex items-center gap-1.5 px-4 py-0.5 shrink-0">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[color:var(--brand-terracotta)]/50 to-transparent" />
      <svg className="h-2.5 w-2.5 text-[color:var(--brand-terracotta)]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[color:var(--brand-terracotta)]/50 to-transparent" />
    </div>
  );
}
