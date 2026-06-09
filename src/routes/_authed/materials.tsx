import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { inr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/materials")({ component: MaterialsPage });

const UNITS = ["kg", "g", "litre", "ml", "pcs", "packet", "bottle"];
const PAYMENT = ["paid", "unpaid", "partial"];

function MaterialsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["materials_purchased"],
    queryFn: async () => (await (supabase as any).from("materials_purchased").select("*").order("purchase_date", { ascending: false })).data ?? [],
  });
  const { data: retailers = [] } = useQuery({
    queryKey: ["suppliers-for-materials"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name")).data ?? [],
  });

  const totals = useMemo(() => {
    const total = rows.reduce((s: number, r: any) => s + Number(r.total_cost || 0), 0);
    const unpaid = rows.filter((r: any) => r.payment_status !== "paid")
      .reduce((s: number, r: any) => s + Number(r.total_cost || 0), 0);
    return { total, unpaid, count: rows.length };
  }, [rows]);

  async function save(form: any) {
    const payload = {
      purchase_date: form.purchase_date || new Date().toISOString().slice(0, 10),
      material: form.material,
      supplier_id: form.supplier_id || null,
      supplier_name: form.supplier_name || (retailers.find((r: any) => r.id === form.supplier_id)?.name ?? null),
      quantity: Number(form.quantity || 0),
      unit: form.unit || "kg",
      unit_cost: Number(form.unit_cost || 0),
      total_cost: Number(form.quantity || 0) * Number(form.unit_cost || 0),
      payment_status: form.payment_status || "paid",
      notes: form.notes || null,
    };
    const op = form.id
      ? (supabase as any).from("materials_purchased").update(payload).eq("id", form.id)
      : (supabase as any).from("materials_purchased").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["materials_purchased"] });
  }
  async function del(id: string) {
    if (!confirm("Delete this purchase record?")) return;
    await (supabase as any).from("materials_purchased").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["materials_purchased"] });
  }

  return (
    <div>
      <PageHeader
        title="Materials Purchased"
        subtitle="Track every raw-material purchase, supplier, and outstanding payment."
        actions={<Button onClick={() => { setEditing({}); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add purchase</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-brand"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total spend</div>
          <div className="font-display text-2xl text-primary">{inr(totals.total)}</div>
        </CardContent></Card>
        <Card className="border-brand"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Outstanding</div>
          <div className="font-display text-2xl text-primary">{inr(totals.unpaid)}</div>
        </CardContent></Card>
        <Card className="border-brand"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Purchases</div>
          <div className="font-display text-2xl text-primary">{totals.count}</div>
        </CardContent></Card>
      </div>

      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            <th className="p-3">Date</th><th className="p-3">Material</th><th className="p-3">Supplier</th>
            <th className="p-3">Qty</th><th className="p-3">Unit cost</th><th className="p-3">Total</th>
            <th className="p-3">Payment</th><th className="p-3 w-12"></th>
          </tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/40 cursor-pointer" onClick={() => { setEditing(r); setOpen(true); }}>
                <td className="p-3">{formatDate(r.purchase_date)}</td>
                <td className="p-3 font-medium">{r.material}</td>
                <td className="p-3">{r.supplier_name || "—"}</td>
                <td className="p-3">{r.quantity} {r.unit}</td>
                <td className="p-3">{inr(Number(r.unit_cost))}</td>
                <td className="p-3 font-semibold">{inr(Number(r.total_cost))}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.payment_status === "paid" ? "bg-brand-leaf/15 text-brand-leaf" : "bg-destructive/15 text-destructive"}`}>{r.payment_status}</span>
                </td>
                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No purchases recorded yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit purchase" : "New purchase"}</DialogTitle></DialogHeader>
          {open && <PurchaseForm initial={editing ?? {}} retailers={retailers as any[]} onSubmit={save} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchaseForm({ initial, retailers, onSubmit }: { initial: any; retailers: any[]; onSubmit: (f: any) => void }) {
  const [f, setF] = useState<any>({
    purchase_date: initial.purchase_date ?? new Date().toISOString().slice(0, 10),
    material: initial.material ?? "",
    supplier_id: initial.supplier_id ?? "",
    supplier_name: initial.supplier_name ?? "",
    quantity: initial.quantity ?? "",
    unit: initial.unit ?? "kg",
    unit_cost: initial.unit_cost ?? "",
    payment_status: initial.payment_status ?? "paid",
    notes: initial.notes ?? "",
    id: initial.id,
  });
  const total = (Number(f.quantity) || 0) * (Number(f.unit_cost) || 0);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date</Label>
          <Input type="date" value={f.purchase_date} onChange={(e) => setF({ ...f, purchase_date: e.target.value })} required />
        </div>
        <div><Label>Material</Label>
          <Input value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} placeholder="Raw mango, chilli powder…" required />
        </div>
      </div>
      <div><Label>Supplier / Retailer</Label>
        <select className="w-full border border-input rounded h-9 px-2 bg-background"
          value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}>
          <option value="">— None / external —</option>
          {retailers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <Input className="mt-2" value={f.supplier_name} onChange={(e) => setF({ ...f, supplier_name: e.target.value })} placeholder="Or type supplier name" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Quantity</Label>
          <Input type="number" step="0.01" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} required />
        </div>
        <div><Label>Unit</Label>
          <select className="w-full border border-input rounded h-9 px-2 bg-background" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div><Label>Unit cost (₹)</Label>
          <Input type="number" step="0.01" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Payment status</Label>
          <select className="w-full border border-input rounded h-9 px-2 bg-background" value={f.payment_status} onChange={(e) => setF({ ...f, payment_status: e.target.value })}>
            {PAYMENT.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <Label>Total</Label>
          <div className="h-9 grid items-center font-semibold text-primary">{inr(total)}</div>
        </div>
      </div>
      <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <DialogFooter><Button type="submit">Save</Button></DialogFooter>
    </form>
  );
}
