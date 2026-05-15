import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: () => (
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  ),
});

function LoginPage() {
  const { signIn, session } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState("Kamaruzz");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) nav({ to: "/dashboard" });
  }, [session, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await signIn(u, p);
    setBusy(false);
    if (error) setErr(error);
    else nav({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-brand-gradient text-primary-foreground p-12 relative overflow-hidden">
        <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-brand-cream/5" />
        <div className="absolute top-20 -left-20 w-[280px] h-[280px] rounded-full bg-brand-cream/5" />
        <div className="relative">
          <img src={logo} alt="" className="h-20 w-20 rounded-xl bg-brand-cream/95 p-2 shadow-2xl" />
          <h1 className="font-display text-5xl mt-8 leading-tight">
            Khamaruzz<br/>
            <span className="text-3xl text-brand-cream/80">Naadan Achaar</span>
          </h1>
          <p className="mt-4 max-w-sm text-brand-cream/80 italic">
            Authentic homemade Kerala pickles — made with love, managed with care.
          </p>
        </div>
        <div className="relative text-xs uppercase tracking-[0.3em] opacity-70">
          Internal Admin Console
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-3">
            <img src={logo} alt="" className="h-12 w-12 rounded-lg bg-brand-cream p-1" />
            <div className="font-display text-2xl text-primary">Khamaruzz Admin</div>
          </div>
          <div>
            <h2 className="font-display text-3xl text-primary">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to manage your business.</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="u">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="u" value={u} onChange={(e) => setU(e.target.value)} className="pl-9" autoComplete="username" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="p" type="password" value={p} onChange={(e) => setP(e.target.value)} className="pl-9" autoComplete="current-password" />
              </div>
            </div>
          </div>

          {err && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{err}</div>}

          <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Authorized personnel only. Activity is logged.
          </p>
        </form>
      </div>
    </div>
  );
}
