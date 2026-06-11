DROP POLICY IF EXISTS "Authenticated can read audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit log" ON public.audit_log;

CREATE POLICY "Admins can read audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert audit log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND user_id = auth.uid()
);