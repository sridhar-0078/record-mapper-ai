import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setActor } from "@/lib/land";

export type Profile = {
  id: string;
  full_name: string | null;
  designation: string | null;
  district: string | null;
  email: string | null;
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, designation, district, email")
    .eq("id", userId)
    .maybeSingle();
  if (data?.full_name) setActor(data.full_name);
  return (data ?? null) as Profile | null;
}

export async function fetchRoles(userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", userId);
  if (error) throw error;
}
