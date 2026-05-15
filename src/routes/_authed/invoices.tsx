import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authed/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-invoices"],
    queryFn: async () => (await supabase.from("orders").select("*, customers(name), order_items(*)").order("created_at", { ascending: false })).data ?? [],
  });

  function exportCSV() {
    const headers = ["Order","Customer","Channel","Status","Subtotal","GST","Total","Date"];
    const rows = (orders as any[]).map(o => [o.order_no, o.customers?.name ?? "Walk-in", o.channel, o.status, o.subtotal, o.gst_amount, o.total, formatDate(o.created_at)]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "khamaruzz-invoices.csv"; a.click();
  }

  const totalGST = (orders as any[]).reduce((s, o) => s + Number(o.gst_amount || 0), 0);
  const totalRevenue = (orders as any[]).reduce((s, o) => s + Number(o.total || 0), 0);

  return (
    <div>
      <PageHeader title="Billing & GST" subtitle="Tax invoices, GST summary, exports."
        actions={<Button onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-brand"><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Total invoices</div><div className="font-display text-2xl text-primary">{orders.length}</div></CardContent></Card>
        <Card className="border-brand"><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Total revenue</div><div className="font-display text-2xl text-primary">{inr(totalRevenue)}</div></CardContent></Card>
        <Card className="border-brand"><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">GST collected</div><div className="font-display text-2xl text-brand-red">{inr(totalGST)}</div></CardContent></Card>
      </div>

      <Card className="border-brand">
        <CardHeader className="pb-2"><CardTitle className="text-base">All invoices</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2">Invoice</th><th>Customer</th><th>Items</th><th className="text-right">Subtotal</th><th className="text-right">GST</th><th className="text-right">Total</th><th>Date</th></tr>
            </thead>
            <tbody>
              {(orders as any[]).map(o => (
                <tr key={o.id} className="border-b border-border/50">
                  <td className="py-2 font-mono text-xs text-primary">{o.order_no}</td>
                  <td>{o.customers?.name ?? "Walk-in"}</td>
                  <td className="text-muted-foreground text-xs">{(o.order_items || []).length} items</td>
                  <td className="text-right">{inr(o.subtotal)}</td>
                  <td className="text-right">{inr(o.gst_amount)}</td>
                  <td className="text-right font-semibold">{inr(o.total)}</td>
                  <td className="text-xs text-muted-foreground">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
