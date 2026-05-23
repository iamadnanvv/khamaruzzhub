import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { inr } from "@/lib/format";
import { Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/_authed/posters")({ component: PostersPage });

type Product = {
  id: string;
  name: string;
  variant: string;
  selling_price: number;
};

// Sort variants intelligently: weight-based first (ascending), then named/premium last
function sortVariants(variants: string[]): string[] {
  const weight = (v: string): number | null => {
    const m = v.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b/i);
    if (!m) return null;
    let n = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === "kg" || unit === "l") n *= 1000;
    return n;
  };
  return [...variants].sort((a, b) => {
    const wa = weight(a), wb = weight(b);
    if (wa != null && wb != null) return wa - wb;
    if (wa != null) return -1;
    if (wb != null) return 1;
    return a.localeCompare(b);
  });
}

function PostersPage() {
  const ref = useRef<HTMLDivElement>(null);
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products-poster"],
    queryFn: async () =>
      ((await supabase.from("products").select("*").order("name").order("selling_price")).data ?? []) as Product[],
  });

  const { grouped, variants } = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    const variantSet = new Set<string>();
    products.forEach((p) => {
      if (!p.variant) return;
      variantSet.add(p.variant);
      (grouped[p.name] ||= {})[p.variant] = p.selling_price;
    });
    return { grouped, variants: sortVariants([...variantSet]) };
  }, [products]);

  async function downloadPDF() {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: null });
    const imgData = canvas.toDataURL("image/png");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.addImage(imgData, "PNG", 0, 0, 210, 297);
    doc.save("khamaruzz-menu.pdf");
  }
  function printPoster() {
    window.print();
  }

  const productNames = Object.keys(grouped).sort();
  const colCount = variants.length;
  // Tighter font when many variants
  const priceTextClass = colCount > 5 ? "text-xs" : colCount > 3 ? "text-sm" : "text-base";

  return (
    <div>
      <PageHeader
        title="Poster / Menu"
        subtitle="Printable price menu poster — auto-includes every Net Weight variant."
        actions={
          <>
            <Button variant="outline" onClick={printPoster}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button onClick={downloadPDF}>
              <Download className="h-4 w-4 mr-1" /> Download A4 PDF
            </Button>
          </>
        }
      />

      <div className="grid place-items-center">
        <div
          ref={ref}
          className="bg-[#fdf3df] w-[210mm] min-h-[297mm] p-12 shadow-2xl border border-brand text-[color:var(--brand-terracotta)] relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[color:var(--brand-clay)]/10" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-[color:var(--brand-leaf)]/10" />

          <header className="flex flex-col items-center text-center relative">
            <img src={logo} alt="" className="h-32 w-32 object-contain" />
            <h1 style={{ fontFamily: "Playfair Display, serif" }} className="text-5xl font-black mt-2">
              Khamaruzz
            </h1>
            <div
              style={{ fontFamily: "Playfair Display, serif" }}
              className="text-3xl text-brand-red font-bold -mt-1"
            >
              Naadan Achaar
            </div>
            <div className="text-xs uppercase tracking-[0.4em] text-brand-leaf mt-2">— Made with love —</div>
          </header>

          <h2
            style={{ fontFamily: "Playfair Display, serif" }}
            className="text-3xl text-center mt-8 mb-4 border-y-2 border-current py-2"
          >
            Our Pickles · Price Menu
          </h2>

          {colCount === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No products to display.</div>
          ) : (
            <div className="relative">
              <div
                className="grid text-sm font-semibold mb-2 px-3 gap-2"
                style={{ gridTemplateColumns: `minmax(0, 1.6fr) repeat(${colCount}, minmax(0, 1fr))` }}
              >
                <div>Product</div>
                {variants.map((v) => (
                  <div key={v} className="text-right">
                    {v}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {productNames.map((name) => (
                  <div
                    key={name}
                    className="grid px-3 py-2 rounded-md odd:bg-white/40 gap-2 items-baseline"
                    style={{ gridTemplateColumns: `minmax(0, 1.6fr) repeat(${colCount}, minmax(0, 1fr))` }}
                  >
                    <div
                      style={{ fontFamily: "Playfair Display, serif" }}
                      className="text-lg font-semibold truncate"
                    >
                      {name}
                    </div>
                    {variants.map((v) => {
                      const price = grouped[name][v];
                      return (
                        <div
                          key={v}
                          className={`text-right ${priceTextClass} ${
                            price ? "font-semibold text-brand-red" : "text-muted-foreground"
                          }`}
                        >
                          {price ? inr(price) : "—"}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <footer className="absolute bottom-10 left-12 right-12 text-center text-sm border-t border-current pt-4">
            <div>
              Order on WhatsApp: <b>+91 96457 78508</b>
            </div>
            <div className="text-brand-leaf text-xs mt-1">
              Authentic Homemade Kerala Pickles · @khamaruzz_naadan_achaar
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
