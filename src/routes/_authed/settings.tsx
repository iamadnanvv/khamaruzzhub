import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/settings")({ component: SettingsPage });

function SettingsPage() {
  const { changePassword, session } = useAuth();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    const { error } = await changePassword(pw);
    setBusy(false);
    if (error) toast.error(error); else { toast.success("Password updated"); setPw(""); }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Brand information and account security." />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-brand">
          <CardHeader><CardTitle className="text-base">Brand information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Brand">Khamaruzz Naadan Achaar</Row>
            <Row label="Tagline">Authentic Homemade Kerala Pickles</Row>
            <Row label="Phone">+91 96457 78508</Row>
            <Row label="Instagram">@khamaruzz_naadan_achaar</Row>
            <Row label="Website"><a href="https://khamaruzzachaar.page.gd/?i=1" target="_blank" rel="noopener" className="underline">khamaruzzachaar.page.gd</a></Row>
            <Row label="GS1 Prefix (suggested)">890</Row>
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Signed in as</Label><Input value={session?.user.email ?? ""} disabled /></div>
              <div><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
              <Button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between border-b border-border/50 py-1.5"><span className="text-muted-foreground">{label}</span><span className="font-medium">{children}</span></div>;
}
