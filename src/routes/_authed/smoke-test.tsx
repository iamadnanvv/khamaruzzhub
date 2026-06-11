import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, PlayCircle, AlertTriangle, Clock } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/smoke-test")({
  component: SmokeTestPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

type Status = "idle" | "running" | "pass" | "fail" | "warn";
type Check = {
  id: string;
  name: string;
  group: string;
  run: () => Promise<{ ok: boolean; message: string; warn?: boolean }>;
};

const CHECKS: Check[] = [
  {
    id: "auth.session",
    name: "Login session active",
    group: "Auth",
    run: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { ok: false, message: error.message };
      if (!data.session) return { ok: false, message: "No active session" };
      return { ok: true, message: `Signed in as ${data.session.user.email ?? data.session.user.id}` };
    },
  },
  {
    id: "dashboard.products",
    name: "Dashboard: products count",
    group: "Dashboard",
    run: async () => {
      const { count, error } = await supabase.from("products").select("id", { count: "exact", head: true });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `${count ?? 0} products` };
    },
  },
  {
    id: "dashboard.inventory",
    name: "Dashboard: inventory metrics",
    group: "Dashboard",
    run: async () => {
      const { data, error } = await supabase.from("inventory").select("quantity, low_stock_threshold");
      if (error) return { ok: false, message: error.message };
      const total = (data ?? []).reduce((s, r: any) => s + (r.quantity || 0), 0);
      return { ok: true, message: `${data?.length ?? 0} rows · ${total} units total` };
    },
  },
  {
    id: "dashboard.orders",
    name: "Dashboard: orders feed",
    group: "Dashboard",
    run: async () => {
      const { data, error } = await supabase.from("orders").select("id, total, created_at").order("created_at", { ascending: false }).limit(5);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `Latest ${data?.length ?? 0} orders fetched` };
    },
  },
  {
    id: "products.crud",
    name: "Products CRUD (insert → update → delete)",
    group: "Products",
    run: async () => {
      const probe = `__smoke_${Date.now()}`;
      const ins = await supabase.from("products").insert({ name: probe, sku: probe } as any).select().single();
      if (ins.error) return { ok: false, message: `insert: ${ins.error.message}` };
      const id = (ins.data as any).id;
      const upd = await supabase.from("products").update({ name: `${probe}_u` } as any).eq("id", id);
      if (upd.error) {
        await supabase.from("products").delete().eq("id", id);
        return { ok: false, message: `update: ${upd.error.message}` };
      }
      const del = await supabase.from("products").delete().eq("id", id);
      if (del.error) return { ok: false, message: `delete: ${del.error.message}` };
      return { ok: true, message: "Insert, update, delete all succeeded" };
    },
  },
  {
    id: "orders.read",
    name: "Orders: read with items",
    group: "Orders",
    run: async () => {
      const { error } = await supabase.from("orders").select("id, total, order_items(id, quantity)").limit(3);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "Orders + order_items join OK" };
    },
  },
  {
    id: "reports.export",
    name: "Reports: aggregate export query",
    group: "Reports",
    run: async () => {
      const { data, error } = await supabase.from("orders").select("total, status, created_at");
      if (error) return { ok: false, message: error.message };
      const rev = (data ?? []).reduce((s, r: any) => s + Number(r.total || 0), 0);
      return { ok: true, message: `${data?.length ?? 0} orders · ₹${rev.toFixed(2)} aggregate` };
    },
  },
  {
    id: "customers.read",
    name: "Customers list reachable",
    group: "CRM",
    run: async () => {
      const { error, count } = await supabase.from("customers").select("id", { count: "exact", head: true });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `${count ?? 0} customers` };
    },
  },
  {
    id: "suppliers.read",
    name: "Retailers/Suppliers reachable",
    group: "CRM",
    run: async () => {
      const { error, count } = await supabase.from("suppliers").select("id", { count: "exact", head: true });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `${count ?? 0} entries` };
    },
  },
  {
    id: "audit.write",
    name: "Audit log: insert permission",
    group: "Audit",
    run: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { ok: false, message: "No user" };
      const { error } = await supabase.from("audit_log").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        action: "smoke.test",
        entity: "system",
        details: { ts: new Date().toISOString() } as any,
      });
      if (error) return { ok: false, message: error.message, warn: true };
      return { ok: true, message: "Audit insert OK" };
    },
  },
  {
    id: "alerts.read",
    name: "Alerts reachable",
    group: "Alerts",
    run: async () => {
      const { error } = await supabase.from("alerts").select("id").limit(1);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "Alerts query OK" };
    },
  },
  {
    id: "pages.routes",
    name: "Key admin routes resolve",
    group: "Pages",
    run: async () => {
      const routes = ["/dashboard", "/products", "/inventory", "/orders", "/reports", "/audit", "/backup"];
      const missing: string[] = [];
      for (const r of routes) {
        try {
          const res = await fetch(r, { method: "HEAD" });
          if (!res.ok && res.status !== 405) missing.push(`${r}(${res.status})`);
        } catch {
          missing.push(r);
        }
      }
      if (missing.length) return { ok: false, message: `Unreachable: ${missing.join(", ")}`, warn: true };
      return { ok: true, message: `${routes.length} routes OK` };
    },
  },
];

function StatusIcon({ s }: { s: Status }) {
  if (s === "running") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  if (s === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />;
}

function SmokeTestPage() {
  const [results, setResults] = useState<Record<string, { status: Status; message?: string; ms?: number }>>({});
  const [running, setRunning] = useState(false);

  async function runAll() {
    setRunning(true);
    const next: typeof results = {};
    CHECKS.forEach(c => { next[c.id] = { status: "running" }; });
    setResults({ ...next });

    let pass = 0, fail = 0, warn = 0;
    for (const c of CHECKS) {
      const t0 = performance.now();
      try {
        const r = await c.run();
        const ms = Math.round(performance.now() - t0);
        if (r.ok) { next[c.id] = { status: "pass", message: r.message, ms }; pass++; }
        else if (r.warn) { next[c.id] = { status: "warn", message: r.message, ms }; warn++; }
        else { next[c.id] = { status: "fail", message: r.message, ms }; fail++; }
      } catch (e: any) {
        next[c.id] = { status: "fail", message: e?.message ?? String(e), ms: Math.round(performance.now() - t0) };
        fail++;
      }
      setResults({ ...next });
    }

    setRunning(false);
    await logAudit({
      action: "smoke.run",
      entity: "system",
      details: { pass, fail, warn, total: CHECKS.length },
    });
    if (fail === 0) toast.success(`Smoke test complete — ${pass} passed${warn ? `, ${warn} warnings` : ""}`);
    else toast.error(`${fail} check${fail > 1 ? "s" : ""} failed`);
  }

  const counts = Object.values(results).reduce(
    (a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; },
    {} as Record<string, number>,
  );
  const groups = Array.from(new Set(CHECKS.map(c => c.group)));

  return (
    <>
      <PageHeader
        title="Platform Smoke Test"
        subtitle="One-click health check across auth, dashboard, CRUD, orders, and reports."
        actions={
          <Button onClick={runAll} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            {running ? "Running…" : "Run smoke test"}
          </Button>
        }
      />

      {Object.keys(results).length > 0 && (
        <div className="flex gap-2 mb-4 text-sm">
          <Badge variant="secondary">Total: {CHECKS.length}</Badge>
          <Badge className="bg-green-600">Pass: {counts.pass ?? 0}</Badge>
          <Badge className="bg-amber-500">Warn: {counts.warn ?? 0}</Badge>
          <Badge variant="destructive">Fail: {counts.fail ?? 0}</Badge>
        </div>
      )}

      <div className="space-y-4">
        {groups.map(g => (
          <Card key={g} className="p-0 overflow-hidden">
            <div className="px-4 py-2 bg-muted text-xs uppercase tracking-wider font-medium">{g}</div>
            <div className="divide-y">
              {CHECKS.filter(c => c.group === g).map(c => {
                const r = results[c.id];
                return (
                  <div key={c.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="pt-0.5"><StatusIcon s={r?.status ?? "idle"} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{c.name}</div>
                      {r?.message && (
                        <div className={`text-xs mt-0.5 ${r.status === "fail" ? "text-destructive" : "text-muted-foreground"}`}>
                          {r.message}
                        </div>
                      )}
                    </div>
                    {r?.ms != null && <div className="text-xs text-muted-foreground tabular-nums">{r.ms}ms</div>}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <ScheduledHistory />
    </>
  );
}

function ScheduledHistory() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["smoke_test_runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smoke_test_runs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  return (
    <Card className="mt-6 p-0 overflow-hidden">
      <div className="px-4 py-2 bg-muted text-xs uppercase tracking-wider font-medium flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" /> Scheduled run history (daily, last 30)
      </div>
      <div className="divide-y">
        {isLoading && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && data.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No scheduled runs recorded yet — the daily job will populate this list.
          </div>
        )}
        {data.map((row: any) => (
          <div key={row.id} className="px-4 py-3 flex items-center gap-3 text-sm">
            <div className="flex-1">
              <div className="font-medium">{new Date(row.created_at).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                {row.triggered_by} · {row.duration_ms}ms · {row.total} checks
              </div>
            </div>
            <div className="flex gap-1.5 text-xs">
              <Badge className="bg-green-600">{row.pass} pass</Badge>
              {row.warn > 0 && <Badge className="bg-amber-500">{row.warn} warn</Badge>}
              {row.fail > 0 ? <Badge variant="destructive">{row.fail} fail</Badge> : <Badge variant="secondary">0 fail</Badge>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
