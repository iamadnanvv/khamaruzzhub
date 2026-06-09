
-- Prevent any direct write to user_roles from anon/authenticated; only service_role may manage roles
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated, PUBLIC;

CREATE POLICY "Only service role can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Only service role can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Only service role can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (false);

-- Revoke direct EXECUTE on SECURITY DEFINER role-check functions from signed-in users.
-- These remain callable internally from RLS policies and other security definer functions.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
