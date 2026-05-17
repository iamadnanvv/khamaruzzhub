import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/customers")({ component: () => <CrudPage table="customers" title="Customers" subtitle="Customer relationship records." fields={[
  { k: "name", label: "Name", required: true },
  { k: "phone", label: "Phone" },
  { k: "address", label: "Address", textarea: true },
  { k: "notes", label: "Notes", textarea: true },
]} /> });

export function CrudPage({ table, title, subtitle, fields }: { table: string; title: string; subtitle: string; fields: { k: string; label: string; required?: boolean; textarea?: boolean }[]}) {
  const tbl = table as any;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data = [] } = useQuery({
    queryKey: [table],
    queryFn: async () => (await supabase.from(tbl).select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function save(form: any) {
    const op = form.id ? supabase.from(tbl).update(form).eq("id", form.id) : supabase.from(tbl).insert(form);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: [table] });
  }
  async function del(id: string) {
    if (!confirm("Delete?")) return;
    await supabase.from(tbl).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: [table] });
  }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={<Button onClick={() => { setEditing({}); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add</Button>} />
      <Card className="border-brand overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            {fields.map((f) => <th key={f.k} className="p-3">{f.label}</th>)}<th className="p-3 w-20"></th>
          </tr></thead>
          <tbody>
            {data.map((row: any) => (
              <tr key={row.id} className="border-t border-border/60 hover:bg-secondary/40 cursor-pointer" onClick={() => { setEditing(row); setOpen(true); }}>
                {fields.map((f) => <td key={f.k} className="p-3">{row[f.k] || "—"}</td>)}
                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" onClick={() => del(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={fields.length + 1} className="p-8 text-center text-muted-foreground">No records.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} record</DialogTitle></DialogHeader>
          {open && <FormBody initial={editing ?? {}} fields={fields} onSubmit={save} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormBody({ initial, fields, onSubmit }: any) {
  const [f, setF] = useState<any>(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
      {fields.map((field: any) => (
        <div key={field.k} className="space-y-1">
          <Label>{field.label}</Label>
          {field.textarea
            ? <Textarea value={f[field.k] ?? ""} onChange={(e) => setF({ ...f, [field.k]: e.target.value })} />
            : <Input value={f[field.k] ?? ""} required={field.required} onChange={(e) => setF({ ...f, [field.k]: e.target.value })} />}
        </div>
      ))}
      <DialogFooter><Button type="submit">Save</Button></DialogFooter>
    </form>
  );
}
