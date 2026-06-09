import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, IndianRupee, PackageX, Bell, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { inr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/alerts")({ component: AlertsPage });

type AlertItem = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message?: string;
  link?: string;
  icon: any;
  created_at?: string;
};

function AlertsPage() {
  const qc = useQueryClient();
  const { data: alerts = [], refetch } = useQuery({
    queryKey: ["alerts-live"],
    queryFn: computeAlerts,
  });

  useEffect(() => { refetch(); }, [refetch]);

  const grouped = (alerts as AlertItem[]).reduce<Record<string, AlertItem[]>>((acc, a) => {
    (acc[a.severity] ||= []).push(a); return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Proactive notifications for stock, expiry, payments, and dues."
        actions={
          <Button variant="outline" onClick={() => { refetch(); qc.invalidateQueries(); toast.success("Refreshed"); }}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard color="destructive" label="Critical" count={(grouped.critical || []).length} />
        <SummaryCard color="accent" label="Warnings" count={(grouped.warning || []).length} />
        <SummaryCard color="primary" label="Info" count={(grouped.info || []).length} />
      </div>

      {alerts.length === 0 ? (
        <Card className="border-brand">
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-brand-leaf mb-3" />
            <div className="font-display text-xl text-primary">All clear!</div>
            <p className="text-muted-foreground text-sm mt-1">No active alerts. Your business is running smoothly.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(alerts as AlertItem[]).map(a => (
            <Card key={a.id} className={`border-l-4 ${
              a.severity === "critical" ? "border-l-destructive" :
              a.severity === "warning" ? "border-l-accent" : "border-l-primary"
            }`}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className={`h-9 w-9 rounded-md grid place-items-center shrink-0 ${
                  a.severity === "critical" ? "bg-destructive/10 text-destructive" :
                  a.severity === "warning" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"
                }`}>
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{a.title}</div>
                  {a.message && <div className="text-sm text-muted-foreground mt-0.5">{a.message}</div>}
                </div>
                {a.link && (
                  <Link to={a.link} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
                    View →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ color, label, count }: { color: string; label: string; count: number }) {
  const cls = color === "destructive" ? "text-destructive" : color === "accent" ? "text-accent" : "text-primary";
  return (
    <Card className="border-brand"><CardContent className="p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-3xl ${cls}`}>{count}</div>
    </CardContent></Card>
  );
}

export async function computeAlerts(): Promise<AlertItem[]> {
  const out: AlertItem[] = [];

  const [inv, rawMats, orders, mats, suppliers] = await Promise.all([
    supabase.from("inventory").select("quantity, low_stock_threshold, batch_no, products(name, expiry_date)"),
    (supabase as any).from("raw_materials").select("name, current_stock, low_stock_threshold, unit"),
    supabase.from("orders").select("order_no, total, payment_status, created_at, customers(name)").neq("payment_status", "paid"),
    (supabase as any).from("materials_purchased").select("material, total_cost, supplier_name, purchase_date, payment_status").neq("payment_status", "paid"),
    supabase.from("suppliers").select("name, outstanding").gt("outstanding", 0),
  ]);

  // Low finished stock
  (inv.data ?? []).forEach((r: any, i: number) => {
    if (r.quantity <= r.low_stock_threshold) {
      out.push({
        id: `inv-${i}`, type: "low_stock", severity: r.quantity === 0 ? "critical" : "warning",
        icon: PackageX,
        title: `${r.products?.name} — ${r.quantity} units left (batch ${r.batch_no})`,
        message: `Threshold: ${r.low_stock_threshold}. Time to produce more.`,
        link: "/inventory",
      });
    }
  });

  // Low raw material
  (rawMats.data ?? []).forEach((r: any, i: number) => {
    if (Number(r.current_stock) <= Number(r.low_stock_threshold)) {
      out.push({
        id: `raw-${i}`, type: "low_raw", severity: Number(r.current_stock) === 0 ? "critical" : "warning",
        icon: AlertTriangle,
        title: `Low raw stock: ${r.name}`,
        message: `${r.current_stock} ${r.unit} remaining (threshold ${r.low_stock_threshold} ${r.unit}).`,
        link: "/raw-materials",
      });
    }
  });

  // Expiry
  (inv.data ?? []).forEach((r: any, i: number) => {
    const e = r.products?.expiry_date;
    if (!e) return;
    const days = Math.floor((new Date(e).getTime() - Date.now()) / 86400000);
    if (days < 0) {
      out.push({ id: `exp-${i}`, type: "expired", severity: "critical", icon: Clock,
        title: `${r.products?.name} EXPIRED`, message: `Expired ${Math.abs(days)} day(s) ago. Remove from stock.`, link: "/inventory" });
    } else if (days <= 30) {
      out.push({ id: `exp-${i}`, type: "expiring", severity: "warning", icon: Clock,
        title: `${r.products?.name} expires in ${days} day(s)`, message: `Expiry: ${formatDate(e)}`, link: "/inventory" });
    } else if (days <= 60) {
      out.push({ id: `exp-${i}`, type: "expiring", severity: "info", icon: Clock,
        title: `${r.products?.name} expires in ${days} days`, link: "/inventory" });
    }
  });

  // Unpaid orders
  (orders.data ?? []).forEach((o: any, i: number) => {
    out.push({ id: `ord-${i}`, type: "unpaid_order", severity: "warning", icon: IndianRupee,
      title: `Order ${o.order_no} — ${inr(o.total)} ${o.payment_status}`,
      message: `${o.customers?.name ?? "Walk-in"} · ${formatDate(o.created_at)}`,
      link: "/orders" });
  });

  // Unpaid material purchases
  (mats.data ?? []).forEach((m: any, i: number) => {
    out.push({ id: `mat-${i}`, type: "unpaid_material", severity: "warning", icon: IndianRupee,
      title: `Unpaid purchase: ${m.material} — ${inr(m.total_cost)}`,
      message: `${m.supplier_name ?? "—"} · ${formatDate(m.purchase_date)}`,
      link: "/raw-materials" });
  });

  // Retailer outstanding
  (suppliers.data ?? []).forEach((s: any, i: number) => {
    out.push({ id: `sup-${i}`, type: "outstanding", severity: "info", icon: Bell,
      title: `${s.name} owes ${inr(s.outstanding)}`, link: "/suppliers" });
  });

  // Sort: critical > warning > info
  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
