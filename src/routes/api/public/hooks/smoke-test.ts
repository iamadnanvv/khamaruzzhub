import { createFileRoute } from "@tanstack/react-router";

const TABLES = [
  "products", "inventory", "raw_materials", "materials_purchased",
  "production_batches", "raw_material_consumption", "recipes",
  "orders", "order_items", "customers", "suppliers",
  "purchase_orders", "purchase_order_items", "alerts", "audit_log",
] as const;

type CheckResult = { id: string; name: string; group: string; ok: boolean; warn?: boolean; message: string; ms: number };

async function runSmokeChecks() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: CheckResult[] = [];

  async function timed<T>(id: string, name: string, group: string, fn: () => Promise<{ ok: boolean; warn?: boolean; message: string }>) {
    const t0 = Date.now();
    try {
      const r = await fn();
      results.push({ id, name, group, ok: r.ok, warn: r.warn, message: r.message, ms: Date.now() - t0 });
    } catch (e: any) {
      results.push({ id, name, group, ok: false, message: e?.message ?? String(e), ms: Date.now() - t0 });
    }
  }

  // Per-table reachability
  for (const t of TABLES) {
    await timed(`table.${t}`, `Table reachable: ${t}`, "Tables", async () => {
      const { error, count } = await supabaseAdmin.from(t as any).select("*", { count: "exact", head: true });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `${count ?? 0} rows` };
    });
  }

  // Key joins / aggregates
  await timed("join.orders_items", "Orders + items join", "Joins", async () => {
    const { error } = await supabaseAdmin.from("orders").select("id, order_items(id)").limit(3);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "OK" };
  });

  await timed("agg.revenue", "Revenue aggregate", "Reports", async () => {
    const { data, error } = await supabaseAdmin.from("orders").select("total");
    if (error) return { ok: false, message: error.message };
    const rev = (data ?? []).reduce((s, r: any) => s + Number(r.total || 0), 0);
    return { ok: true, message: `₹${rev.toFixed(2)} across ${data?.length ?? 0} orders` };
  });

  await timed("inv.low_stock", "Inventory low-stock scan", "Inventory", async () => {
    const { data, error } = await supabaseAdmin.from("inventory").select("quantity, low_stock_threshold");
    if (error) return { ok: false, message: error.message };
    const low = (data ?? []).filter((r: any) => r.quantity <= r.low_stock_threshold).length;
    return { ok: true, warn: low > 0, message: `${low} low-stock item(s)` };
  });

  await timed("audit.insert", "Audit log writable", "Audit", async () => {
    const { error } = await supabaseAdmin.from("audit_log").insert({
      user_id: null,
      user_email: "system@cron",
      action: "smoke.cron",
      entity: "system",
      details: {} as any,
    } as any);
    if (error) return { ok: false, message: error.message, warn: true };
    return { ok: true, message: "OK" };
  });

  return results;
}

export const Route = createFileRoute("/api/public/hooks/smoke-test")({
  server: {
    handlers: {
      POST: async () => {
        const t0 = Date.now();
        const results = await runSmokeChecks();
        const duration_ms = Date.now() - t0;
        const pass = results.filter(r => r.ok && !r.warn).length;
        const warn = results.filter(r => r.ok && r.warn).length;
        const fail = results.filter(r => !r.ok).length;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("smoke_test_runs").insert({
          triggered_by: "cron",
          pass, fail, warn,
          total: results.length,
          duration_ms,
          results: results as any,
        }).select("id").single();

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          ok: true, id: data?.id, pass, fail, warn, total: results.length, duration_ms,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
      GET: async () => new Response(JSON.stringify({ ok: true, hint: "POST to run smoke test" }), {
        headers: { "Content-Type": "application/json" },
      }),
    },
  },
});
