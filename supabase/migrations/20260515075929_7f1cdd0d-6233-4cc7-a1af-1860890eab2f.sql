
revoke execute on function public.has_role(uuid, public.app_role) from anon, authenticated, public;
revoke execute on function public.is_admin(uuid) from anon, authenticated, public;
