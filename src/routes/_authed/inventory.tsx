import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/inventory")({ component: InventoryPage });

function InventoryPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("id, batch_no, quantity, low_stock_threshold, products(name, sku, variant, expiry_date)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function adjust(id: string, delta: number) {
    const row: any = data.find((r: any) => r.id === id);
    if (!row) return;
    const next = Math.max(0, row.quantity + delta);
    const { error } = await supabase.from("inventory").update({ quantity: next, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["inventory"] });
  }

  async function setThreshold(id: string, value: number) {
    const { error } = await supabase.from("inventory").update({ low_stock_threshold: value }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["inventory"] });
  }

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Track stock levels and low-stock alerts per batch." />
      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Product</th><th className="p-3">Variant</th><th className="p-3">Batch</th>
              <th className="p-3">Quantity</th><th className="p-3">Low-stock at</th><th className="p-3">Expiry</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any) => {
              const low = r.quantity <= r.low_stock_threshold;
              return (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="p-3 font-medium">{r.products?.name}</td>
                  <td className="p-3">{r.products?.variant}</td>
                  <td className="p-3 font-mono text-xs">{r.batch_no}</td>
                  <td className="p-3">
                    <div className="inline-flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => adjust(r.id, -1)}>−</Button>
                      <span className={`w-12 text-center font-mono ${low ? "text-accent font-bold" : ""}`}>{r.quantity}</span>
                      <Button size="sm" variant="outline" onClick={() => adjust(r.id, 1)}>+</Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        const v = prompt("Add quantity (e.g. 50)"); if (v) adjust(r.id, Number(v) || 0);
                      }}>+ Bulk</Button>
                    </div>
                  </td>
                  <td className="p-3">
                    <Input type="number" defaultValue={r.low_stock_threshold} className="w-20"
                      onBlur={(e) => setThreshold(r.id, Number(e.target.value) || 0)} />
                  </td>
                  <td className="p-3 text-muted-foreground">{r.products?.expiry_date ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
