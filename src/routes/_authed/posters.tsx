import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { inr } from "@/lib/format";
import { Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/_authed/posters")({ component: PostersPage });

function PostersPage() {
  const ref = useRef<HTMLDivElement>(null);
  const { data: products = [] } = useQuery({
    queryKey: ["products-poster"],
    queryFn: async () => (await supabase.from("products").select("*").order("name").order("selling_price")).data ?? [],
  });

  // group by name → variants
  const grouped: Record<string, any[]> = {};
  (products as any[]).forEach((p) => { (grouped[p.name] ||= []).push(p); });

  async function downloadPDF() {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: null });
    const imgData = canvas.toDataURL("image/png");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.addImage(imgData, "PNG", 0, 0, 210, 297);
    doc.save("khamaruzz-menu.pdf");
  }
  function printPoster() { window.print(); }

  return (
    <div>
      <PageHeader title="Poster / Menu" subtitle="Printable price menu poster for stalls and counters."
        actions={<>
          <Button variant="outline" onClick={printPoster}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          <Button onClick={downloadPDF}><Download className="h-4 w-4 mr-1" /> Download A4 PDF</Button>
        </>} />

      <div className="grid place-items-center">
        <div ref={ref} className="bg-[#fdf3df] w-[210mm] min-h-[297mm] p-12 shadow-2xl border border-brand text-[color:var(--brand-terracotta)] relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[color:var(--brand-clay)]/10" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-[color:var(--brand-leaf)]/10" />
          <header className="flex flex-col items-center text-center relative">
            <img src={logo} alt="" className="h-40 w-40 object-contain" />
            <h1 style={{ fontFamily: "Playfair Display, serif" }} className="text-5xl font-black mt-2">Khamaruzz</h1>
            <div style={{ fontFamily: "Playfair Display, serif" }} className="text-3xl text-brand-red font-bold -mt-1">Naadan Achaar</div>
            <div className="text-xs uppercase tracking-[0.4em] text-brand-leaf mt-2">— Made with love —</div>
          </header>

          <h2 style={{ fontFamily: "Playfair Display, serif" }} className="text-3xl text-center mt-10 mb-4 border-y-2 border-current py-2">Our Pickles · Price Menu</h2>

          <div className="grid grid-cols-4 text-sm font-semibold mb-2 px-3">
            <div>Product</div><div className="text-right">200 g</div><div className="text-right">400 g</div><div className="text-right">Premium Jar</div>
          </div>
          <div className="space-y-1">
            {Object.entries(grouped).map(([name, variants]) => {
              const get = (v: string) => variants.find((p) => p.variant === v)?.selling_price;
              return (
                <div key={name} className="grid grid-cols-4 px-3 py-2 rounded-md odd:bg-white/40">
                  <div style={{ fontFamily: "Playfair Display, serif" }} className="text-lg font-semibold">{name}</div>
                  <div className="text-right">{get("200g") ? inr(get("200g")) : "—"}</div>
                  <div className="text-right">{get("400g") ? inr(get("400g")) : "—"}</div>
                  <div className="text-right text-brand-red font-semibold">{get("Premium Glass Jar") ? inr(get("Premium Glass Jar")) : "—"}</div>
                </div>
              );
            })}
          </div>

          <footer className="absolute bottom-10 left-12 right-12 text-center text-sm border-t border-current pt-4">
            <div>Order on WhatsApp: <b>+91 96457 78508</b></div>
            <div className="text-brand-leaf text-xs mt-1">Authentic Homemade Kerala Pickles · @khamaruzz_naadan_achaar</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
