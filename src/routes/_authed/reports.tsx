import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authed/reports")({ component: ReportsPage });

const COLORS = ["#7a3a20", "#a85a30", "#7a1818", "#3a6f3a", "#c47a1a"];

function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [{ data: orders }, { data: items }, { data: products }] = await Promise.all([
        supabase.from("orders").select("total, gst_amount, subtotal, created_at, channel"),
        supabase.from("order_items").select("product_name, quantity, line_total"),
        supabase.from("products").select("name, cost_price, selling_price"),
      ]);

      // sales per month
      const monthly: Record<string, number> = {};
      (orders ?? []).forEach((o: any) => {
        const k = new Date(o.created_at).toLocaleString("en-IN", { month: "short" });
        monthly[k] = (monthly[k] || 0) + Number(o.total || 0);
      });
      const monthlyData = Object.entries(monthly).map(([m, v]) => ({ m, v }));

      // best sellers
      const best: Record<string, number> = {};
      (items ?? []).forEach((it: any) => { best[it.product_name] = (best[it.product_name] || 0) + Number(it.line_total); });
      const top = Object.entries(best).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

      // channel mix
      const channels: Record<string, number> = {};
      (orders ?? []).forEach((o: any) => { channels[o.channel] = (channels[o.channel] || 0) + 1; });
      const channelData = Object.entries(channels).map(([name, value]) => ({ name, value }));

      const profit = (products ?? []).reduce((s: number, p: any) => s + (Number(p.selling_price) - Number(p.cost_price)), 0);
      return { monthlyData, top, channelData, profit };
    },
  });

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Sales, profit, channel mix and top performers." />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-brand">
          <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Revenue</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data?.monthlyData ?? []}>
                <XAxis dataKey="m" stroke="#7a3a20" />
                <YAxis stroke="#7a3a20" />
                <Tooltip formatter={(v: any) => inr(v)} />
                <Bar dataKey="v" fill="#a85a30" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardHeader className="pb-2"><CardTitle className="text-base">Best Sellers</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart layout="vertical" data={data?.top ?? []}>
                <XAxis type="number" stroke="#7a3a20" />
                <YAxis dataKey="name" type="category" width={120} stroke="#7a3a20" />
                <Tooltip formatter={(v: any) => inr(v)} />
                <Bar dataKey="value" fill="#7a1818" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardHeader className="pb-2"><CardTitle className="text-base">Channel Mix</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data?.channelData ?? []} dataKey="value" outerRadius={90} label>
                  {(data?.channelData ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardHeader className="pb-2"><CardTitle className="text-base">Theoretical Profit per Unit (sum)</CardTitle></CardHeader>
          <CardContent>
            <div className="font-display text-4xl text-primary mt-4">{inr(data?.profit ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on (selling price − cost price) summed across all variants. Use Reports → Sales for realized profit.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
