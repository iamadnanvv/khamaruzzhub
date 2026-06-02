import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Factory, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { inr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/production")({ component: ProductionPage });

const UNITS = ["kg", "g", "litre", "ml", "pcs"];

function ProductionPage() {
  return (
    <div>
      <PageHeader title="Production" subtitle="Recipes (BOM), costing, and production batch tracking." />
      <Tabs defaultValue="recipes">
        <TabsList>
          <TabsTrigger value="recipes"><ChefHat className="h-4 w-4 mr-1.5" /> Recipes & Costing</TabsTrigger>
          <TabsTrigger value="batches"><Factory className="h-4 w-4 mr-1.5" /> Production Batches</TabsTrigger>
        </TabsList>
        <TabsContent value="recipes" className="mt-4"><RecipesTab /></TabsContent>
        <TabsContent value="batches" className="mt-4"><BatchesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------- RECIPES ----------------- */

function RecipesTab() {
  const qc = useQueryClient();
  const [openProduct, setOpenProduct] = useState<any>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id, name, variant, selling_price, cost_price").order("name")).data ?? [],
  });
  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => (await (supabase as any).from("recipes").select("*")).data ?? [],
  });
  const { data: rawMats = [] } = useQuery({
    queryKey: ["raw_materials"],
    queryFn: async () => (await (supabase as any).from("raw_materials").select("*").order("name")).data ?? [],
  });

  const recipeMap = useMemo(() => {
    const m: Record<string, any[]> = {};
    (recipes as any[]).forEach(r => { (m[r.product_id] ||= []).push(r); });
    return m;
  }, [recipes]);

  function costFor(productId: string) {
    const items = recipeMap[productId] || [];
    return items.reduce((s: number, it: any) => {
      const mat = (rawMats as any[]).find(m => m.id === it.raw_material_id || m.name === it.material_name);
      const unitCost = mat ? Number(mat.last_unit_cost) : 0;
      return s + Number(it.quantity_required) * unitCost;
    }, 0);
  }

  return (
    <>
      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            <th className="p-3">Product</th><th className="p-3">Variant</th>
            <th className="p-3 text-right">Selling price</th>
            <th className="p-3 text-right">Recipe cost</th>
            <th className="p-3 text-right">Margin</th>
            <th className="p-3">Ingredients</th>
            <th className="p-3 w-24"></th>
          </tr></thead>
          <tbody>
            {(products as any[]).map(p => {
              const cost = costFor(p.id);
              const margin = Number(p.selling_price) - cost;
              const marginPct = cost > 0 ? (margin / Number(p.selling_price)) * 100 : 0;
              const items = recipeMap[p.id] || [];
              return (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">{p.variant}</td>
                  <td className="p-3 text-right">{inr(p.selling_price)}</td>
                  <td className="p-3 text-right text-muted-foreground">{cost > 0 ? inr(cost) : "—"}</td>
                  <td className={`p-3 text-right font-semibold ${margin < 0 ? "text-destructive" : "text-brand-leaf"}`}>
                    {cost > 0 ? `${inr(margin)} (${marginPct.toFixed(0)}%)` : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{items.length} items</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setOpenProduct(p)}>Edit recipe</Button>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Add products first.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!openProduct} onOpenChange={(o) => { if (!o) setOpenProduct(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Recipe — {openProduct?.name} ({openProduct?.variant})</DialogTitle></DialogHeader>
          {openProduct && (
            <RecipeEditor
              productId={openProduct.id}
              items={recipeMap[openProduct.id] || []}
              rawMats={rawMats as any[]}
              onSaved={() => { qc.invalidateQueries({ queryKey: ["recipes"] }); setOpenProduct(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecipeEditor({ productId, items, rawMats, onSaved }: { productId: string; items: any[]; rawMats: any[]; onSaved: () => void }) {
  const [rows, setRows] = useState<any[]>(items.length ? items : [{ material_name: "", quantity_required: "", unit: "kg" }]);

  function update(i: number, patch: any) {
    setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function remove(i: number) { setRows(rows.filter((_, idx) => idx !== i)); }
  function add() { setRows([...rows, { material_name: "", quantity_required: "", unit: "kg" }]); }

  async function save() {
    await (supabase as any).from("recipes").delete().eq("product_id", productId);
    const valid = rows.filter(r => r.material_name && Number(r.quantity_required) > 0);
    if (valid.length) {
      const payload = valid.map(r => {
        const matched = rawMats.find(m => m.id === r.raw_material_id || m.name === r.material_name);
        return {
          product_id: productId,
          raw_material_id: matched?.id ?? null,
          material_name: r.material_name,
          quantity_required: Number(r.quantity_required),
          unit: r.unit || "kg",
        };
      });
      const { error } = await (supabase as any).from("recipes").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Recipe saved");
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_100px_90px_40px] gap-2 items-end">
            <div>
              <Input list="rm-list" value={r.material_name} placeholder="Raw mango" onChange={(e) => {
                const matched = rawMats.find(m => m.name === e.target.value);
                update(i, { material_name: e.target.value, raw_material_id: matched?.id ?? null, unit: matched?.unit ?? r.unit });
              }} />
            </div>
            <Input type="number" step="0.01" placeholder="Qty" value={r.quantity_required} onChange={(e) => update(i, { quantity_required: e.target.value })} />
            <select className="border border-input rounded h-9 px-2 bg-background" value={r.unit} onChange={(e) => update(i, { unit: e.target.value })}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
            <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <datalist id="rm-list">{rawMats.map(m => <option key={m.id} value={m.name} />)}</datalist>
      </div>
      <Button variant="outline" size="sm" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" /> Add ingredient</Button>
      <DialogFooter><Button onClick={save}>Save recipe</Button></DialogFooter>
    </div>
  );
}

/* ----------------- BATCHES ----------------- */

function BatchesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: batches = [] } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await (supabase as any)
      .from("production_batches")
      .select("*, products(name, variant)")
      .order("production_date", { ascending: false })).data ?? [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id, name, variant").order("name")).data ?? [],
  });
  const { data: rawMats = [] } = useQuery({
    queryKey: ["raw_materials"],
    queryFn: async () => (await (supabase as any).from("raw_materials").select("*").order("name")).data ?? [],
  });
  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => (await (supabase as any).from("recipes").select("*")).data ?? [],
  });

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Record batch</Button>
      </div>
      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            <th className="p-3">Batch</th><th className="p-3">Date</th><th className="p-3">Product</th>
            <th className="p-3 text-right">Produced</th><th className="p-3 text-right">Total cost</th>
            <th className="p-3 text-right">Cost / unit</th><th className="p-3">Notes</th>
          </tr></thead>
          <tbody>
            {(batches as any[]).map(b => (
              <tr key={b.id} className="border-t border-border/60">
                <td className="p-3 font-mono text-xs">{b.batch_no}</td>
                <td className="p-3">{formatDate(b.production_date)}</td>
                <td className="p-3">{b.products?.name} <span className="text-muted-foreground text-xs">({b.products?.variant})</span></td>
                <td className="p-3 text-right">{b.quantity_produced}</td>
                <td className="p-3 text-right font-semibold">{inr(Number(b.total_cost))}</td>
                <td className="p-3 text-right text-muted-foreground">{b.quantity_produced ? inr(Number(b.total_cost) / b.quantity_produced) : "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{b.yield_notes || "—"}</td>
              </tr>
            ))}
            {batches.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No production batches recorded.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New production batch</DialogTitle></DialogHeader>
          {open && <BatchForm
            products={products as any[]}
            rawMats={rawMats as any[]}
            recipes={recipes as any[]}
            onSaved={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["batches"] });
              qc.invalidateQueries({ queryKey: ["raw_materials"] });
              qc.invalidateQueries({ queryKey: ["inventory"] });
            }}
          />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BatchForm({ products, rawMats, recipes, onSaved }: { products: any[]; rawMats: any[]; recipes: any[]; onSaved: () => void }) {
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState<number | string>("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [consumption, setConsumption] = useState<any[]>([]);

  function loadFromRecipe(pid: string) {
    setProductId(pid);
    const recipeItems = recipes.filter(r => r.product_id === pid);
    setConsumption(recipeItems.map(r => {
      const mat = rawMats.find(m => m.id === r.raw_material_id || m.name === r.material_name);
      return {
        raw_material_id: mat?.id ?? null,
        material_name: r.material_name,
        quantity: r.quantity_required,
        unit: r.unit,
        unit_cost: mat?.last_unit_cost ?? 0,
      };
    }));
  }

  const totalCost = consumption.reduce((s, c) => s + Number(c.quantity || 0) * Number(c.unit_cost || 0), 0);

  function updateRow(i: number, patch: any) {
    setConsumption(consumption.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function removeRow(i: number) { setConsumption(consumption.filter((_, idx) => idx !== i)); }
  function addRow() { setConsumption([...consumption, { material_name: "", quantity: "", unit: "kg", unit_cost: 0 }]); }

  async function save() {
    if (!productId || !Number(qty)) return toast.error("Pick product and quantity");
    const { data: batch, error } = await (supabase as any).from("production_batches").insert({
      product_id: productId,
      production_date: date,
      quantity_produced: Number(qty),
      total_cost: totalCost,
      yield_notes: notes || null,
    }).select().single();
    if (error) return toast.error(error.message);

    if (consumption.length) {
      const payload = consumption.filter(c => c.material_name && Number(c.quantity) > 0).map(c => ({
        batch_id: batch.id,
        raw_material_id: c.raw_material_id ?? null,
        material_name: c.material_name,
        quantity: Number(c.quantity),
        unit: c.unit,
        unit_cost: Number(c.unit_cost),
      }));
      if (payload.length) await (supabase as any).from("raw_material_consumption").insert(payload);

      // Deduct raw material stock
      for (const c of payload) {
        if (c.raw_material_id) {
          const mat = rawMats.find(m => m.id === c.raw_material_id);
          if (mat) {
            const next = Math.max(0, Number(mat.current_stock) - Number(c.quantity));
            await (supabase as any).from("raw_materials").update({
              current_stock: next, updated_at: new Date().toISOString()
            }).eq("id", c.raw_material_id);
          }
        }
      }
    }

    // Add to finished-goods inventory
    await (supabase as any).from("inventory").insert({
      product_id: productId,
      batch_no: batch.batch_no,
      quantity: Number(qty),
    });

    toast.success(`Batch ${batch.batch_no} recorded — ${qty} units added to inventory`);
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Label>Product</Label>
          <select className="w-full border border-input rounded h-9 px-2 bg-background" value={productId} onChange={(e) => loadFromRecipe(e.target.value)}>
            <option value="">— Pick product —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.variant})</option>)}
          </select>
        </div>
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Quantity produced</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div className="flex flex-col justify-end"><Label>Total cost</Label><div className="h-9 grid items-center font-semibold text-primary">{inr(totalCost)}</div></div>
      </div>

      <div className="border-t pt-3">
        <Label>Raw materials consumed</Label>
        <p className="text-xs text-muted-foreground mb-2">Loaded from recipe; edit as needed. Stock will be deducted on save.</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {consumption.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_70px_90px_36px] gap-2 items-center">
              <Input value={c.material_name} onChange={(e) => updateRow(i, { material_name: e.target.value })} />
              <Input type="number" step="0.01" value={c.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })} placeholder="Qty" />
              <select className="border border-input rounded h-9 px-2 bg-background" value={c.unit} onChange={(e) => updateRow(i, { unit: e.target.value })}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
              <Input type="number" step="0.01" value={c.unit_cost} onChange={(e) => updateRow(i, { unit_cost: e.target.value })} placeholder="₹/unit" />
              <Button size="icon" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="mt-2" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add material</Button>
      </div>

      <div><Label>Yield notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 10kg raw mango → 24 jars" /></div>
      <DialogFooter><Button onClick={save}>Save batch</Button></DialogFooter>
    </div>
  );
}
