import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, FileDown } from "lucide-react";
import { inr, formatDate } from "@/lib/format";
import { toast } from "sonner";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authed/orders")({ component: OrdersPage });

function OrdersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, customers(name, phone), order_items(*)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-orders"],
    queryFn: async () => (await supabase.from("products").select("id, name, variant, selling_price, gst_rate")).data ?? [],
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("id, name, phone")).data ?? [],
  });

  async function changeStatus(id: string, status: string) {
    await supabase.from("orders").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["orders"] });
  }
  async function changePayment(id: string, payment_status: string) {
    await supabase.from("orders").update({ payment_status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Direct, WhatsApp, Instagram and retail orders."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Order</Button>}
      />

      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Order #</th><th className="p-3">Customer</th><th className="p-3">Channel</th>
              <th className="p-3">Status</th><th className="p-3">Payment</th>
              <th className="p-3 text-right">Total</th><th className="p-3">Date</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id} className="border-t border-border/60">
                <td className="p-3 font-mono text-xs text-primary">{o.order_no}</td>
                <td className="p-3">{o.customers?.name ?? "Walk-in"}</td>
                <td className="p-3 capitalize">{o.channel}</td>
                <td className="p-3">
                  <select value={o.status} onChange={(e) => changeStatus(o.id, e.target.value)}
                    className="border border-input rounded px-2 py-1 bg-background text-xs">
                    {["pending","packed","shipped","delivered","cancelled"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <select value={o.payment_status} onChange={(e) => changePayment(o.id, e.target.value)}
                    className="border border-input rounded px-2 py-1 bg-background text-xs">
                    {["unpaid","partial","paid"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3 text-right font-semibold">{inr(o.total)}</td>
                <td className="p-3 text-muted-foreground text-xs">{formatDate(o.created_at)}</td>
                <td className="p-3">
                  <Button size="sm" variant="ghost" onClick={() => generateInvoice(o)}>
                    <FileDown className="h-4 w-4" /> Invoice
                  </Button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No orders yet. Create your first one.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Order</DialogTitle></DialogHeader>
          <NewOrderForm products={products as any} customers={customers as any} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["orders"] }); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewOrderForm({ products, customers, onDone }: { products: any[]; customers: any[]; onDone: () => void }) {
  const [customer_id, setCustomer] = useState("");
  const [channel, setChannel] = useState("direct");
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([{ product_id: "", quantity: 1 }]);
  const [notes, setNotes] = useState("");

  const lines = items.map((it) => {
    const p = products.find((x) => x.id === it.product_id);
    if (!p) return null;
    const line_total = Number(p.selling_price) * it.quantity;
    return { product_id: p.id, product_name: `${p.name} (${p.variant})`, quantity: it.quantity, unit_price: Number(p.selling_price), line_total, gst_rate: Number(p.gst_rate) };
  }).filter(Boolean) as any[];
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const gst = lines.reduce((s, l) => s + (l.line_total * l.gst_rate) / 100, 0);
  const total = subtotal + gst;

  async function submit() {
    if (lines.length === 0) return toast.error("Add at least one item");
    const { data: order, error } = await supabase.from("orders").insert({
      customer_id: customer_id || null, channel, subtotal, gst_amount: gst, total, notes,
    }).select().single();
    if (error || !order) return toast.error(error?.message || "Failed");
    const { error: e2 } = await supabase.from("order_items").insert(
      lines.map((l) => ({ order_id: order.id, product_id: l.product_id, product_name: l.product_name, quantity: l.quantity, unit_price: l.unit_price, line_total: l.line_total }))
    );
    if (e2) return toast.error(e2.message);
    toast.success("Order created");
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Customer</Label>
          <select value={customer_id} onChange={(e) => setCustomer(e.target.value)} className="w-full border border-input rounded h-9 px-2 bg-background">
            <option value="">Walk-in</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><Label>Channel</Label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full border border-input rounded h-9 px-2 bg-background">
            {["direct","whatsapp","instagram","retail"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Items</Label>
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <select value={it.product_id} onChange={(e) => { const c=[...items]; c[i].product_id=e.target.value; setItems(c); }}
              className="flex-1 border border-input rounded h-9 px-2 bg-background">
              <option value="">Select product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.variant} ({inr(p.selling_price)})</option>)}
            </select>
            <Input type="number" min={1} value={it.quantity} onChange={(e) => { const c=[...items]; c[i].quantity=Number(e.target.value)||1; setItems(c); }} className="w-20" />
            <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setItems([...items, { product_id: "", quantity: 1 }])}><Plus className="h-3 w-3 mr-1" /> Add item</Button>
      </div>

      <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      <div className="bg-secondary/50 rounded p-3 text-sm space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
        <div className="flex justify-between"><span>GST</span><span>{inr(gst)}</span></div>
        <div className="flex justify-between font-semibold text-primary text-base"><span>Total</span><span>{inr(total)}</span></div>
      </div>

      <DialogFooter><Button onClick={submit}>Create order</Button></DialogFooter>
    </div>
  );
}

function generateInvoice(order: any) {
  const doc = new jsPDF();
  doc.setFontSize(20); doc.setTextColor(60, 30, 20);
  doc.text("KHAMARUZZ NAADAN ACHAAR", 14, 20);
  doc.setFontSize(10); doc.setTextColor(100);
  doc.text("Authentic Homemade Kerala Pickles", 14, 26);
  doc.text("+91 96457 78508", 14, 31);
  doc.setFontSize(14); doc.setTextColor(0);
  doc.text("TAX INVOICE", 160, 20);
  doc.setFontSize(9);
  doc.text(`Invoice: ${order.order_no}`, 160, 27);
  doc.text(`Date: ${formatDate(order.created_at)}`, 160, 32);
  doc.line(14, 38, 196, 38);
  doc.text(`Bill to: ${order.customers?.name ?? "Walk-in"}`, 14, 45);
  if (order.customers?.phone) doc.text(`Phone: ${order.customers.phone}`, 14, 50);

  let y = 60;
  doc.setFillColor(245, 235, 220);
  doc.rect(14, y - 5, 182, 8, "F");
  doc.setFontSize(9); doc.setTextColor(60, 30, 20);
  doc.text("Item", 16, y); doc.text("Qty", 130, y); doc.text("Rate", 150, y); doc.text("Amount", 175, y);
  doc.setTextColor(0);
  y += 8;
  (order.order_items || []).forEach((it: any) => {
    doc.text(it.product_name, 16, y);
    doc.text(String(it.quantity), 130, y);
    doc.text(`Rs.${it.unit_price}`, 150, y);
    doc.text(`Rs.${it.line_total}`, 175, y);
    y += 6;
  });
  y += 6; doc.line(120, y, 196, y); y += 6;
  doc.text("Subtotal", 130, y); doc.text(`Rs.${order.subtotal}`, 175, y); y += 5;
  doc.text("GST", 130, y); doc.text(`Rs.${order.gst_amount}`, 175, y); y += 5;
  doc.setFontSize(11); doc.setTextColor(120, 30, 30);
  doc.text("TOTAL", 130, y); doc.text(`Rs.${order.total}`, 175, y);
  doc.setTextColor(0); doc.setFontSize(8);
  doc.text("Thank you for your order — made with love.", 14, 280);
  doc.save(`${order.order_no}.pdf`);
}
