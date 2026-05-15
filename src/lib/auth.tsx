import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

// Internal admin platform: username "Kamaruzz" maps to a fixed email behind the scenes.
const ADMIN_EMAIL = "kamaruzz@khamaruzz.app";

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error?: string }>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthCtx["signIn"] = async (username, password) => {
    const email =
      username.trim().toLowerCase() === "kamaruzz"
        ? ADMIN_EMAIL
        : username.includes("@")
          ? username.trim()
          : `${username.trim().toLowerCase()}@khamaruzz.app`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Invalid username or password" };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const changePassword: AuthCtx["changePassword"] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return {};
  };

  return (
    <Ctx.Provider value={{ session, loading, signIn, signOut, changePassword }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
