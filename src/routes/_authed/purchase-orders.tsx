import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { inr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/purchase-orders")({ component: POPage });

const STATUSES = ["draft", "sent", "partially_received", "received", "cancelled"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/15 text-primary",
  partially_received: "bg-accent/15 text-accent",
  received: "bg-brand-leaf/15 text-brand-leaf",
  cancelled: "bg-destructive/15 text-destructive",
};
const UNITS = ["kg", "g", "litre", "ml", "pcs"];

function POPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => (await (supabase as any)
      .from("purchase_orders")
      .select("*, purchase_order_items(*)")
      .order("created_at", { ascending: false })).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name")).data ?? [],
  });

  const totals = {
    count: pos.length,
    open: (pos as any[]).filter((p: any) => !["received", "cancelled"].includes(p.status)).length,
    value: (pos as any[]).reduce((s, p: any) => s + Number(p.total || 0), 0),
  };

  async function del(id: string) {
    if (!confirm("Delete this purchase order?")) return;
    await (supabase as any).from("purchase_order_items").delete().eq("po_id", id);
    await (supabase as any).from("purchase_orders").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  }

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Track POs to suppliers — draft, send, receive, and auto-log materials."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New PO</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-brand"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total POs</div>
          <div className="font-display text-2xl text-primary">{totals.count}</div>
        </CardContent></Card>
        <Card className="border-brand"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Open POs</div>
          <div className="font-display text-2xl text-accent">{totals.open}</div>
        </CardContent></Card>
        <Card className="border-brand"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total value</div>
          <div className="font-display text-2xl text-primary">{inr(totals.value)}</div>
        </CardContent></Card>
      </div>

      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            <th className="p-3">PO #</th><th className="p-3">Supplier</th><th className="p-3">Items</th>
            <th className="p-3 text-right">Total</th><th className="p-3">Expected</th>
            <th className="p-3">Status</th><th className="p-3 w-32"></th>
          </tr></thead>
          <tbody>
            {(pos as any[]).map(p => (
              <tr key={p.id} className="border-t border-border/60 hover:bg-secondary/40 cursor-pointer" onClick={() => { setEditing(p); setOpen(true); }}>
                <td className="p-3 font-mono text-xs text-primary">{p.po_no}</td>
                <td className="p-3">{p.supplier_name || "—"}</td>
                <td className="p-3 text-muted-foreground">{(p.purchase_order_items || []).length} items</td>
                <td className="p-3 text-right font-semibold">{inr(p.total)}</td>
                <td className="p-3 text-muted-foreground">{p.expected_delivery ? formatDate(p.expected_delivery) : "—"}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{p.status.replace("_", " ")}</span>
                </td>
                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {pos.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No purchase orders yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editing?.id ? `Edit ${editing.po_no}` : "New Purchase Order"}</DialogTitle></DialogHeader>
          {open && <POForm
            initial={editing}
            suppliers={suppliers as any[]}
            onSaved={() => {
              setOpen(false); setEditing(null);
              qc.invalidateQueries({ queryKey: ["purchase_orders"] });
              qc.invalidateQueries({ queryKey: ["materials_purchased"] });
              qc.invalidateQueries({ queryKey: ["raw_materials"] });
            }}
          />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function POForm({ initial, suppliers, onSaved }: { initial: any | null; suppliers: any[]; onSaved: () => void }) {
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  const [supplierName, setSupplierName] = useState(initial?.supplier_name ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [expected, setExpected] = useState(initial?.expected_delivery ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<any[]>(
    initial?.purchase_order_items?.length
      ? initial.purchase_order_items
      : [{ material_name: "", quantity: "", received_qty: 0, unit: "kg", unit_cost: "" }]
  );

  function updateRow(i: number, patch: any) { setItems(items.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }
  function addRow() { setItems([...items, { material_name: "", quantity: "", received_qty: 0, unit: "kg", unit_cost: "" }]); }
  function removeRow(i: number) { setItems(items.filter((_, idx) => idx !== i)); }

  const total = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_cost || 0), 0);

  async function save() {
    const sup = suppliers.find(s => s.id === supplierId);
    const payload: any = {
      supplier_id: supplierId || null,
      supplier_name: sup?.name ?? supplierName ?? null,
      status,
      expected_delivery: expected || null,
      notes: notes || null,
      total,
      updated_at: new Date().toISOString(),
    };

    let poId = initial?.id;
    if (initial?.id) {
      const { error } = await (supabase as any).from("purchase_orders").update(payload).eq("id", initial.id);
      if (error) return toast.error(error.message);
      await (supabase as any).from("purchase_order_items").delete().eq("po_id", initial.id);
    } else {
      const { data, error } = await (supabase as any).from("purchase_orders").insert(payload).select().single();
      if (error) return toast.error(error.message);
      poId = data.id;
    }

    const validItems = items.filter(it => it.material_name && Number(it.quantity) > 0);
    if (validItems.length) {
      const itemPayload = validItems.map(it => ({
        po_id: poId,
        material_name: it.material_name,
        quantity: Number(it.quantity),
        received_qty: Number(it.received_qty || 0),
        unit: it.unit || "kg",
        unit_cost: Number(it.unit_cost || 0),
        line_total: Number(it.quantity) * Number(it.unit_cost || 0),
      }));
      await (supabase as any).from("purchase_order_items").insert(itemPayload);
    }

    // On full receipt: log to materials_purchased & update raw stock
    if (status === "received") {
      for (const it of validItems) {
        const qty = Number(it.received_qty || it.quantity);
        await (supabase as any).from("materials_purchased").insert({
          purchase_date: new Date().toISOString().slice(0, 10),
          material: it.material_name,
          supplier_id: supplierId || null,
          supplier_name: payload.supplier_name,
          quantity: qty,
          unit: it.unit,
          unit_cost: Number(it.unit_cost || 0),
          total_cost: qty * Number(it.unit_cost || 0),
          payment_status: "unpaid",
        });
        // Add to raw_materials stock
        const { data: existing } = await (supabase as any).from("raw_materials")
          .select("*").eq("name", it.material_name).maybeSingle();
        if (existing) {
          await (supabase as any).from("raw_materials").update({
            current_stock: Number(existing.current_stock) + qty,
            last_unit_cost: Number(it.unit_cost || existing.last_unit_cost),
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await (supabase as any).from("raw_materials").insert({
            name: it.material_name,
            current_stock: qty,
            unit: it.unit,
            last_unit_cost: Number(it.unit_cost || 0),
          });
        }
      }
      toast.success("PO received — materials added to raw stock");
    } else {
      toast.success("PO saved");
    }
    onSaved();
  }

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Label>Supplier</Label>
          <select className="w-full border border-input rounded h-9 px-2 bg-background" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— External / type below —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {!supplierId && <Input className="mt-2" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier name" />}
        </div>
        <div><Label>Status</Label>
          <select className="w-full border border-input rounded h-9 px-2 bg-background" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>
      <div><Label>Expected delivery</Label><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>

      <div className="border-t pt-3">
        <Label>Items</Label>
        <div className="space-y-2 mt-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_80px_70px_90px_36px] gap-2 items-center">
              <Input value={it.material_name} onChange={(e) => updateRow(i, { material_name: e.target.value })} placeholder="Material" />
              <Input type="number" step="0.01" value={it.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })} placeholder="Qty" />
              <Input type="number" step="0.01" value={it.received_qty} onChange={(e) => updateRow(i, { received_qty: e.target.value })} placeholder="Recv" />
              <select className="border border-input rounded h-9 px-2 bg-background" value={it.unit} onChange={(e) => updateRow(i, { unit: e.target.value })}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
              <Input type="number" step="0.01" value={it.unit_cost} onChange={(e) => updateRow(i, { unit_cost: e.target.value })} placeholder="₹/unit" />
              <Button size="icon" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="mt-2" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add line</Button>
        <div className="text-right mt-3 font-semibold text-primary">Total: {inr(total)}</div>
      </div>

      <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

      {status === "received" && (
        <div className="bg-brand-leaf/10 border border-brand-leaf/30 rounded-md p-3 text-xs flex gap-2">
          <PackageCheck className="h-4 w-4 text-brand-leaf shrink-0 mt-0.5" />
          <div>On save, items will be logged to Materials Purchased and added to Raw Materials stock automatically.</div>
        </div>
      )}

      <DialogFooter><Button onClick={save}>Save PO</Button></DialogFooter>
    </div>
  );
}
