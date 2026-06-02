import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Phone, MapPin, TrendingUp, Clock, ShoppingBag, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { inr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/customers")({ component: CustomersPage });

function CustomersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-for-crm"],
    queryFn: async () => (await supabase.from("orders").select("*, order_items(product_name, quantity, line_total)")).data ?? [],
  });

  const insights = useMemo(() => {
    const map: Record<string, { ltv: number; count: number; last: string | null; topProduct: string | null }> = {};
    (orders as any[]).forEach((o: any) => {
      if (!o.customer_id) return;
      const m = map[o.customer_id] ||= { ltv: 0, count: 0, last: null, topProduct: null };
      m.ltv += Number(o.total || 0);
      m.count += 1;
      if (!m.last || new Date(o.created_at) > new Date(m.last)) m.last = o.created_at;
    });
    // Compute top product per customer
    Object.keys(map).forEach(cid => {
      const cnt: Record<string, number> = {};
      (orders as any[]).filter((o: any) => o.customer_id === cid).forEach((o: any) => {
        (o.order_items || []).forEach((it: any) => { cnt[it.product_name] = (cnt[it.product_name] || 0) + Number(it.quantity); });
      });
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      map[cid].topProduct = top?.[0] ?? null;
    });
    return map;
  }, [orders]);

  const filtered = (customers as any[]).filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  // Sort by LTV (top customers first)
  filtered.sort((a, b) => (insights[b.id]?.ltv || 0) - (insights[a.id]?.ltv || 0));

  async function save(form: any) {
    const payload = { name: form.name, phone: form.phone || null, address: form.address || null, notes: form.notes || null };
    const op = form.id
      ? supabase.from("customers").update(payload).eq("id", form.id)
      : supabase.from("customers").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["customers"] });
  }
  async function del(id: string) {
    if (!confirm("Delete this customer?")) return;
    await supabase.from("customers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Customer 360° view — lifetime value, orders, and at-risk flags."
        actions={
          <div className="flex gap-2">
            <Input placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
            <Button onClick={() => { setEditing({}); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        }
      />

      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            <th className="p-3">Customer</th><th className="p-3">Phone</th>
            <th className="p-3 text-right">Lifetime ₹</th><th className="p-3 text-right">Orders</th>
            <th className="p-3">Last order</th><th className="p-3">Favourite</th>
            <th className="p-3 w-12"></th>
          </tr></thead>
          <tbody>
            {filtered.map((c: any) => {
              const i = insights[c.id] || { ltv: 0, count: 0, last: null, topProduct: null };
              const daysSince = i.last ? Math.floor((Date.now() - new Date(i.last).getTime()) / 86400000) : null;
              const atRisk = daysSince !== null && daysSince > 60 && i.count > 0;
              return (
                <tr key={c.id} className="border-t border-border/60 hover:bg-secondary/40 cursor-pointer" onClick={() => setEditing({ ...c, _detail: true })}>
                  <td className="p-3 font-medium flex items-center gap-2">
                    {atRisk && <AlertTriangle className="h-3.5 w-3.5 text-accent" />}
                    {c.name}
                  </td>
                  <td className="p-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="p-3 text-right font-semibold text-primary">{inr(i.ltv)}</td>
                  <td className="p-3 text-right">{i.count}</td>
                  <td className="p-3 text-xs">
                    {i.last ? formatDate(i.last) : "—"}
                    {daysSince !== null && <span className="text-muted-foreground"> ({daysSince}d ago)</span>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{i.topProduct || "—"}</td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No customers.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!editing || open} onOpenChange={(o) => { if (!o) { setEditing(null); setOpen(false); } }}>
        <DialogContent className="max-w-2xl">
          {editing?._detail
            ? <CustomerDetail customer={editing} orders={(orders as any[]).filter(o => o.customer_id === editing.id)} insight={insights[editing.id]} onEdit={() => setEditing({ ...editing, _detail: false })} />
            : <>
                <DialogHeader><DialogTitle>{editing?.id ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
                <CustomerForm initial={editing ?? {}} onSubmit={save} />
              </>
          }
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerDetail({ customer, orders, insight, onEdit }: { customer: any; orders: any[]; insight: any; onEdit: () => void }) {
  const ltv = insight?.ltv || 0;
  const avg = insight?.count ? ltv / insight.count : 0;
  return (
    <div>
      <DialogHeader><DialogTitle className="flex items-center gap-2">{customer.name}<Button size="sm" variant="outline" onClick={onEdit}>Edit</Button></DialogTitle></DialogHeader>
      <Tabs defaultValue="overview" className="mt-2">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-2 mt-3 text-sm">
          {customer.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {customer.phone}</div>}
          {customer.address && <div className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" /> {customer.address}</div>}
          {customer.notes && <div className="text-muted-foreground border-l-2 border-brand pl-3 mt-2">{customer.notes}</div>}
        </TabsContent>
        <TabsContent value="orders" className="mt-3">
          <div className="max-h-80 overflow-y-auto space-y-2">
            {orders.length === 0 && <p className="text-muted-foreground text-sm">No orders yet.</p>}
            {orders.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).map(o => (
              <Card key={o.id} className="border-brand"><CardContent className="p-3 flex justify-between items-start">
                <div>
                  <div className="font-mono text-xs text-primary">{o.order_no}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatDate(o.created_at)} · {o.channel} · {o.status}</div>
                  <div className="text-xs mt-1">{(o.order_items || []).map((it: any) => `${it.product_name} ×${it.quantity}`).join(", ")}</div>
                </div>
                <div className="font-semibold text-right">{inr(o.total)}</div>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="insights" className="mt-3 grid grid-cols-2 gap-3">
          <StatBox icon={TrendingUp} label="Lifetime value" value={inr(ltv)} />
          <StatBox icon={ShoppingBag} label="Avg order value" value={inr(avg)} />
          <StatBox icon={ShoppingBag} label="Total orders" value={insight?.count ?? 0} />
          <StatBox icon={Clock} label="Last order" value={insight?.last ? formatDate(insight.last) : "—"} />
          {insight?.topProduct && (
            <div className="col-span-2 border border-brand rounded-md p-3">
              <div className="text-xs uppercase text-muted-foreground">Favourite product</div>
              <div className="font-display text-lg text-primary mt-0.5">{insight.topProduct}</div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }: any) {
  return (
    <div className="border border-brand rounded-md p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="font-display text-lg text-primary mt-0.5">{value}</div>
    </div>
  );
}

function CustomerForm({ initial, onSubmit }: { initial: any; onSubmit: (f: any) => void }) {
  const [f, setF] = useState<any>({ name: initial.name ?? "", phone: initial.phone ?? "", address: initial.address ?? "", notes: initial.notes ?? "", id: initial.id });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
      <div><Label>Name</Label><Input value={f.name} required onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div><Label>Address</Label><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <DialogFooter><Button type="submit">Save</Button></DialogFooter>
    </form>
  );
}

// keep export for suppliers.tsx import
export function CrudPage({ table, title, subtitle, fields }: { table: string; title: string; subtitle: string; fields: { k: string; label: string; required?: boolean; textarea?: boolean }[] }) {
  const tbl = table as any;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data = [] } = useQuery({
    queryKey: [table],
    queryFn: async () => (await supabase.from(tbl).select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function save(form: any) {
    const op = form.id ? supabase.from(tbl).update(form).eq("id", form.id) : supabase.from(tbl).insert(form);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: [table] });
  }
  async function del(id: string) {
    if (!confirm("Delete?")) return;
    await supabase.from(tbl).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: [table] });
  }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={<Button onClick={() => { setEditing({}); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add</Button>} />
      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            {fields.map((f) => <th key={f.k} className="p-3">{f.label}</th>)}<th className="p-3 w-20"></th>
          </tr></thead>
          <tbody>
            {data.map((row: any) => (
              <tr key={row.id} className="border-t border-border/60 hover:bg-secondary/40 cursor-pointer" onClick={() => { setEditing(row); setOpen(true); }}>
                {fields.map((f) => <td key={f.k} className="p-3">{row[f.k] || "—"}</td>)}
                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" onClick={() => del(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={fields.length + 1} className="p-8 text-center text-muted-foreground">No records.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} record</DialogTitle></DialogHeader>
          {open && <FormBody initial={editing ?? {}} fields={fields} onSubmit={save} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormBody({ initial, fields, onSubmit }: any) {
  const [f, setF] = useState<any>(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
      {fields.map((field: any) => (
        <div key={field.k} className="space-y-1">
          <Label>{field.label}</Label>
          {field.textarea
            ? <Textarea value={f[field.k] ?? ""} onChange={(e) => setF({ ...f, [field.k]: e.target.value })} />
            : <Input value={f[field.k] ?? ""} required={field.required} onChange={(e) => setF({ ...f, [field.k]: e.target.value })} />}
        </div>
      ))}
      <DialogFooter><Button type="submit">Save</Button></DialogFooter>
    </form>
  );
}
