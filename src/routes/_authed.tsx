import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <AuthProvider>
      <Gate />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!session) {
    // client-side redirect (route guard via component since auth is client-only)
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
