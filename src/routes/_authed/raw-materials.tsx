import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authed/raw-materials")({ component: RawMaterialsPage });

const UNITS = ["kg", "g", "litre", "ml", "pcs"];

function RawMaterialsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["raw_materials"],
    queryFn: async () => (await (supabase as any).from("raw_materials").select("*").order("name")).data ?? [],
  });

  const lowCount = (rows as any[]).filter(r => Number(r.current_stock) <= Number(r.low_stock_threshold)).length;
  const totalValue = (rows as any[]).reduce((s, r) => s + Number(r.current_stock) * Number(r.last_unit_cost || 0), 0);

  async function save(form: any) {
    const payload = {
      name: form.name,
      current_stock: Number(form.current_stock || 0),
      unit: form.unit || "kg",
      low_stock_threshold: Number(form.low_stock_threshold || 0),
      last_unit_cost: Number(form.last_unit_cost || 0),
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };
    const op = form.id
      ? (supabase as any).from("raw_materials").update(payload).eq("id", form.id)
      : (supabase as any).from("raw_materials").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["raw_materials"] });
  }
  async function adjust(id: string, delta: number) {
    const row: any = (rows as any[]).find(r => r.id === id);
    if (!row) return;
    const next = Math.max(0, Number(row.current_stock) + delta);
    await (supabase as any).from("raw_materials").update({ current_stock: next, updated_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["raw_materials"] });
  }
  async function del(id: string) {
    if (!confirm("Delete this raw material?")) return;
    await (supabase as any).from("raw_materials").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["raw_materials"] });
  }

  return (
    <div>
      <PageHeader
        title="Raw Materials"
        subtitle="Live stock ledger for ingredients used in production."
        actions={<Button onClick={() => { setEditing({}); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add material</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-brand"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Materials tracked</div>
          <div className="font-display text-2xl text-primary">{rows.length}</div>
        </CardContent></Card>
        <Card className="border-brand"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Low stock</div>
          <div className={`font-display text-2xl ${lowCount > 0 ? "text-accent" : "text-primary"}`}>{lowCount}</div>
        </CardContent></Card>
        <Card className="border-brand"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Inventory value</div>
          <div className="font-display text-2xl text-primary">{inr(totalValue)}</div>
        </CardContent></Card>
      </div>

      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            <th className="p-3">Material</th><th className="p-3">Stock</th>
            <th className="p-3">Low at</th><th className="p-3 text-right">Last unit cost</th>
            <th className="p-3 text-right">Stock value</th><th className="p-3 w-32"></th>
          </tr></thead>
          <tbody>
            {(rows as any[]).map(r => {
              const low = Number(r.current_stock) <= Number(r.low_stock_threshold);
              return (
                <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/40 cursor-pointer" onClick={() => { setEditing(r); setOpen(true); }}>
                  <td className="p-3 font-medium flex items-center gap-2">
                    {low && <AlertTriangle className="h-3.5 w-3.5 text-accent" />}
                    {r.name}
                  </td>
                  <td className="p-3">
                    <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => adjust(r.id, -1)}>−</Button>
                      <span className={`w-20 text-center font-mono ${low ? "text-accent font-bold" : ""}`}>{r.current_stock} {r.unit}</span>
                      <Button size="sm" variant="outline" onClick={() => adjust(r.id, 1)}>+</Button>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.low_stock_threshold} {r.unit}</td>
                  <td className="p-3 text-right">{inr(Number(r.last_unit_cost))}</td>
                  <td className="p-3 text-right font-semibold">{inr(Number(r.current_stock) * Number(r.last_unit_cost))}</td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No raw materials yet. Add your first ingredient.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit material" : "New material"}</DialogTitle></DialogHeader>
          {open && <Form initial={editing ?? {}} onSubmit={save} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Form({ initial, onSubmit }: { initial: any; onSubmit: (f: any) => void }) {
  const [f, setF] = useState<any>({
    name: initial.name ?? "",
    current_stock: initial.current_stock ?? 0,
    unit: initial.unit ?? "kg",
    low_stock_threshold: initial.low_stock_threshold ?? 5,
    last_unit_cost: initial.last_unit_cost ?? 0,
    notes: initial.notes ?? "",
    id: initial.id,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
      <div><Label>Material name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="Raw mango, chilli powder, mustard oil…" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Current stock</Label><Input type="number" step="0.01" value={f.current_stock} onChange={(e) => setF({ ...f, current_stock: e.target.value })} /></div>
        <div><Label>Unit</Label>
          <select className="w-full border border-input rounded h-9 px-2 bg-background" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div><Label>Low-stock at</Label><Input type="number" step="0.01" value={f.low_stock_threshold} onChange={(e) => setF({ ...f, low_stock_threshold: e.target.value })} /></div>
      </div>
      <div><Label>Last unit cost (₹)</Label><Input type="number" step="0.01" value={f.last_unit_cost} onChange={(e) => setF({ ...f, last_unit_cost: e.target.value })} /></div>
      <DialogFooter><Button type="submit">Save</Button></DialogFooter>
    </form>
  );
}
