import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authed/audit")({
  component: AuditPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function AuditPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Recent actions performed on the platform" />
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No audit entries yet.</td></tr>
              )}
              {data.map((row: any) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{row.user_email ?? row.user_id ?? "—"}</td>
                  <td className="px-4 py-2"><Badge variant="secondary">{row.action}</Badge></td>
                  <td className="px-4 py-2">{row.entity}{row.entity_id ? ` · ${row.entity_id}` : ""}</td>
                  <td className="px-4 py-2 font-mono text-xs max-w-md truncate">
                    {row.details && Object.keys(row.details).length > 0 ? JSON.stringify(row.details) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
