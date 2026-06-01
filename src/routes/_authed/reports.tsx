import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authed/reports")({ component: ReportsPage });

const COLORS = ["#7a3a20", "#a85a30", "#7a1818", "#3a6f3a", "#c47a1a", "#1f6f8b"];

function ReportsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [ordersRes, itemsRes, productsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("total, gst_amount, subtotal, created_at, channel, payment_status, status"),
        supabase.from("order_items").select("product_name, quantity, line_total"),
        supabase.from("products").select("name, cost_price, selling_price"),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (productsRes.error) throw productsRes.error;

      const orders = ordersRes.data ?? [];
      const items = itemsRes.data ?? [];
      const products = productsRes.data ?? [];

      // KPIs
      const totalRevenue = orders.reduce((s, o: any) => s + Number(o.total || 0), 0);
      const totalGst = orders.reduce((s, o: any) => s + Number(o.gst_amount || 0), 0);
      const paidRevenue = orders
        .filter((o: any) => o.payment_status === "paid")
        .reduce((s, o: any) => s + Number(o.total || 0), 0);
      const unitsSold = items.reduce((s, it: any) => s + Number(it.quantity || 0), 0);
      const orderCount = orders.length;
      const avgOrder = orderCount ? totalRevenue / orderCount : 0;

      // monthly: sort chronologically using YYYY-MM key
      const monthly: Record<string, { key: string; label: string; v: number }> = {};
      orders.forEach((o: any) => {
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
        if (!monthly[key]) monthly[key] = { key, label, v: 0 };
        monthly[key].v += Number(o.total || 0);
      });
      const monthlyData = Object.values(monthly)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(({ label, v }) => ({ m: label, v: Math.round(v) }));

      // best sellers
      const best: Record<string, number> = {};
      items.forEach((it: any) => {
        best[it.product_name] = (best[it.product_name] || 0) + Number(it.line_total || 0);
      });
      const top = Object.entries(best)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value: Math.round(value) }));

      // channel mix
      const channels: Record<string, number> = {};
      orders.forEach((o: any) => {
        channels[o.channel] = (channels[o.channel] || 0) + 1;
      });
      const channelData = Object.entries(channels).map(([name, value]) => ({ name, value }));

      const profit = products.reduce(
        (s: number, p: any) => s + (Number(p.selling_price) - Number(p.cost_price)),
        0,
      );

      return {
        monthlyData,
        top,
        channelData,
        profit,
        totalRevenue,
        totalGst,
        paidRevenue,
        unitsSold,
        orderCount,
        avgOrder,
      };
    },
  });

  if (error) {
    return (
      <div>
        <PageHeader title="Reports & Analytics" subtitle="Sales, profit, channel mix and top performers." />
        <Card className="border-destructive p-6 text-sm text-destructive">
          Failed to load reports: {(error as Error).message}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Sales, profit, channel mix and top performers."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="Total Revenue" value={inr(data?.totalRevenue ?? 0)} loading={isLoading} />
        <Kpi label="Paid Revenue" value={inr(data?.paidRevenue ?? 0)} loading={isLoading} />
        <Kpi label="Orders" value={String(data?.orderCount ?? 0)} loading={isLoading} />
        <Kpi label="Avg Order Value" value={inr(data?.avgOrder ?? 0)} loading={isLoading} />
        <Kpi label="GST Collected" value={inr(data?.totalGst ?? 0)} loading={isLoading} />
        <Kpi label="Units Sold" value={String(data?.unitsSold ?? 0)} loading={isLoading} />
        <Kpi label="Catalogue Margin" value={inr(data?.profit ?? 0)} loading={isLoading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-brand">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            {(data?.monthlyData?.length ?? 0) === 0 ? (
              <Empty text="No sales yet" />
            ) : (
              <ResponsiveContainer>
                <BarChart data={data?.monthlyData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7d8c8" />
                  <XAxis dataKey="m" stroke="#7a3a20" />
                  <YAxis stroke="#7a3a20" />
                  <Tooltip formatter={(v: any) => inr(v)} />
                  <Bar dataKey="v" fill="#a85a30" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Best Sellers</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            {(data?.top?.length ?? 0) === 0 ? (
              <Empty text="No items sold yet" />
            ) : (
              <ResponsiveContainer>
                <BarChart layout="vertical" data={data?.top ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7d8c8" />
                  <XAxis type="number" stroke="#7a3a20" />
                  <YAxis dataKey="name" type="category" width={140} stroke="#7a3a20" />
                  <Tooltip formatter={(v: any) => inr(v)} />
                  <Bar dataKey="value" fill="#7a1818" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Channel Mix</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            {(data?.channelData?.length ?? 0) === 0 ? (
              <Empty text="No orders yet" />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data?.channelData ?? []} dataKey="value" outerRadius={90} label>
                    {(data?.channelData ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Catalogue Margin (per unit, summed)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-4xl text-primary mt-4">{inr(data?.profit ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Sum of (selling price − cost price) across all product variants. For realised profit,
              cross-check with Orders.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <Card className="border-brand p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-2xl text-primary mt-1">{loading ? "…" : value}</div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="h-full grid place-items-center text-sm text-muted-foreground">{text}</div>
  );
}
