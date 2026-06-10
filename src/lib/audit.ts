import { supabase } from "@/integrations/supabase/client";

export type AuditEntry = {
  action: string;
  entity: string;
  entity_id?: string | null;
  details?: Record<string, unknown>;
};

export async function logAudit(entry: AuditEntry) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      details: (entry.details ?? {}) as any,
    });
  } catch (err) {
    console.warn("[audit] failed to log", err);
  }
}
