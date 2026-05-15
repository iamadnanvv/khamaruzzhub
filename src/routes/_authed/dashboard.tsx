import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Boxes, ShoppingCart, IndianRupee, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { inr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/dashboard")({
  component: Dashboard,
});

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: string }) {
  return (
    <Card className="bg-card border-brand">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-12 w-12 rounded-lg grid place-items-center ${accent ?? "bg-primary/10 text-primary"}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-display text-primary mt-0.5">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [products, inv, orders, recent] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("inventory").select("quantity, low_stock_threshold, product_id, products(name, expiry_date)"),
        supabase.from("orders").select("total, status, created_at, channel, order_no, customer_id, customers(name)"),
        supabase.from("orders").select("order_no, total, status, created_at, customers(name)").order("created_at", { ascending: false }).limit(8),
      ]);
      const totalProducts = products.count ?? 0;
      const totalStock = (inv.data ?? []).reduce((s, r: any) => s + (r.quantity || 0), 0);
      const totalOrders = (orders.data ?? []).length;
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const monthRevenue = (orders.data ?? [])
        .filter((o: any) => new Date(o.created_at) >= monthStart)
        .reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const lowStock = (inv.data ?? []).filter((r: any) => r.quantity <= r.low_stock_threshold);
      const expiring = (inv.data ?? []).filter((r: any) => {
        const e = r.products?.expiry_date; if (!e) return false;
        const days = (new Date(e).getTime() - Date.now()) / 86400000;
        return days < 60;
      });
      return { totalProducts, totalStock, totalOrders, monthRevenue, lowStock, expiring, recent: recent.data ?? [] };
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Business Overview" subtitle="Real-time snapshot of your pickle empire." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Package} label="Products / Variants" value={data?.totalProducts ?? "—"} />
        <Stat icon={Boxes} label="Total Stock Units" value={data?.totalStock ?? "—"} accent="bg-brand-leaf/15 text-brand-leaf" />
        <Stat icon={ShoppingCart} label="Total Orders" value={data?.totalOrders ?? "—"} accent="bg-accent/15 text-accent" />
        <Stat icon={IndianRupee} label="Revenue (this month)" value={inr(data?.monthRevenue ?? 0)} accent="bg-primary/10 text-primary" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-brand">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-accent" /> Low stock alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.lowStock ?? []).slice(0, 6).map((r: any) => (
              <div key={r.product_id} className="flex justify-between border-b border-border/50 pb-1.5 last:border-0">
                <span>{r.products?.name}</span>
                <span className="font-mono text-accent">{r.quantity} left</span>
              </div>
            ))}
            {(!data?.lowStock || data.lowStock.length === 0) && <p className="text-muted-foreground">All stock levels healthy.</p>}
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-brand-red" /> Expiry alerts (60d)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.expiring ?? []).slice(0, 6).map((r: any, i: number) => (
              <div key={i} className="flex justify-between border-b border-border/50 pb-1.5 last:border-0">
                <span>{r.products?.name}</span>
                <span className="text-muted-foreground">{formatDate(r.products?.expiry_date)}</span>
              </div>
            ))}
            {(!data?.expiring || data.expiring.length === 0) && <p className="text-muted-foreground">No products nearing expiry.</p>}
          </CardContent>
        </Card>

        <Card className="border-brand lg:row-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brand-leaf" /> Recent Orders</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.recent ?? []).map((o: any) => (
              <div key={o.order_no} className="flex justify-between items-start border-b border-border/50 pb-2 last:border-0">
                <div>
                  <div className="font-mono text-xs text-primary">{o.order_no}</div>
                  <div className="text-muted-foreground text-xs">{o.customers?.name ?? "Walk-in"} · {o.status}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{inr(o.total)}</div>
                  <div className="text-[10px] text-muted-foreground">{formatDate(o.created_at)}</div>
                </div>
              </div>
            ))}
            {(!data?.recent || data.recent.length === 0) && <p className="text-muted-foreground">No orders yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
