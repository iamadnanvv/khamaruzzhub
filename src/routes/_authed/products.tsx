import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/products")({
  component: ProductsPage,
});

type Product = {
  id: string; name: string; sku: string; category: string | null; variant: string;
  cost_price: number; selling_price: number; gst_rate: number;
  ingredients: string | null; fssai_number: string | null; barcode: string | null;
  upc_code: string | null; mfg_date: string | null; expiry_date: string | null;
  shelf_life_days: number | null; description: string | null;
};

function ProductsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name").order("selling_price");
      if (error) throw error;
      return data as Product[];
    },
  });

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  async function save(form: Partial<Product>) {
    const payload = {
      ...form,
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      gst_rate: Number(form.gst_rate) || 5,
      shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : null,
    };
    if (form.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
      toast.success("Product updated");
    } else {
      const { error } = await supabase.from("products").insert(payload as any);
      if (error) return toast.error(error.message);
      toast.success("Product created");
    }
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage all pickle products and variants."
        actions={
          <div className="flex gap-2">
            <Input placeholder="Search name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
            <Button onClick={() => { setEditing({ variant: "200g", gst_rate: 5 }); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New Product
            </Button>
          </div>
        }
      />

      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground text-left">
            <tr>
              <th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3">Variant</th>
              <th className="p-3 text-right">Cost</th><th className="p-3 text-right">Price</th>
              <th className="p-3">GST</th><th className="p-3">FSSAI</th><th className="p-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border/60 hover:bg-secondary/40">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 font-mono text-xs">{p.sku}</td>
                <td className="p-3">{p.variant}</td>
                <td className="p-3 text-right text-muted-foreground">{inr(p.cost_price)}</td>
                <td className="p-3 text-right font-semibold text-primary">{inr(p.selling_price)}</td>
                <td className="p-3">{p.gst_rate}%</td>
                <td className="p-3 text-xs text-muted-foreground">{p.fssai_number ?? "—"}</td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No products.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          <ProductForm initial={editing ?? {}} onSubmit={save} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ initial, onSubmit }: { initial: Partial<Product>; onSubmit: (p: Partial<Product>) => void }) {
  const [f, setF] = useState<Partial<Product>>(initial);
  const upd = (k: keyof Product) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}
      className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1"
    >
      <Field label="Name"><Input value={f.name ?? ""} onChange={upd("name")} required /></Field>
      <Field label="SKU"><Input value={f.sku ?? ""} onChange={upd("sku")} required /></Field>
      <Field label="Category"><Input value={f.category ?? "Pickle"} onChange={upd("category")} /></Field>
      <Field label="Variant / Net Weight">
        <select className="border-input border rounded-md h-9 px-2 bg-background" value={f.variant ?? "200g"} onChange={upd("variant")}>
          <option>200g</option><option>400g</option><option>Premium Glass Jar</option>
        </select>
      </Field>
      <Field label="Cost Price (₹)"><Input type="number" step="0.01" value={f.cost_price ?? 0} onChange={upd("cost_price")} /></Field>
      <Field label="Selling Price (₹)"><Input type="number" step="0.01" value={f.selling_price ?? 0} onChange={upd("selling_price")} required /></Field>
      <Field label="GST %"><Input type="number" step="0.01" value={f.gst_rate ?? 5} onChange={upd("gst_rate")} /></Field>
      <Field label="Shelf life (days)"><Input type="number" value={f.shelf_life_days ?? ""} onChange={upd("shelf_life_days")} /></Field>
      <Field label="Mfg date"><Input type="date" value={f.mfg_date ?? ""} onChange={upd("mfg_date")} /></Field>
      <Field label="Expiry date"><Input type="date" value={f.expiry_date ?? ""} onChange={upd("expiry_date")} /></Field>
      <Field label="FSSAI"><Input value={f.fssai_number ?? ""} onChange={upd("fssai_number")} /></Field>
      <Field label="Barcode"><Input value={f.barcode ?? ""} onChange={upd("barcode")} /></Field>
      <Field label="UPC / EAN"><Input value={f.upc_code ?? ""} onChange={upd("upc_code")} /></Field>
      <Field label="Image URL"><Input value={(f as any).image_url ?? ""} onChange={(e) => setF({ ...f, image_url: e.target.value } as any)} /></Field>
      <div className="col-span-2"><Label>Ingredients</Label><Textarea value={f.ingredients ?? ""} onChange={upd("ingredients")} rows={2} /></div>
      <div className="col-span-2"><Label>Description</Label><Textarea value={f.description ?? ""} onChange={upd("description")} rows={2} /></div>
      <DialogFooter className="col-span-2 mt-2">
        <Button type="submit">Save product</Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
