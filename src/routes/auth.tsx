import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Officer sign in — Bhoomi Setu" },
      {
        name: "description",
        content: "Secure sign in for revenue officers to the land record digitization portal.",
      },
      { property: "og:title", content: "Officer sign in — Bhoomi Setu" },
      { property: "og:description", content: "Sign in to digitize, verify and approve land records." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const dest = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("Revenue Officer");
  const [district, setDistrict] = useState("Nagpur");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: dest, replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: dest, replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [dest, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth",
            data: { full_name: fullName, designation, district },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage({
            tone: "info",
            text: "Account created. Check your email and confirm the link to sign in.",
          });
        }
      }
    } catch (err) {
      setMessage({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      setMessage({ tone: "error", text: String(result.error) });
      return;
    }
    if (result.redirected) return;
    navigate({ to: dest, replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-primary font-serif text-lg text-primary-foreground">
            भू
          </div>
          <div>
            <p className="font-serif text-xl">Bhoomi Setu</p>
            <p className="text-xs text-muted-foreground">Officer portal · restricted access</p>
          </div>
        </div>

        <h1 className="mt-6 font-serif text-2xl">
          {mode === "signin" ? "Sign in to continue" : "Create officer account"}
        </h1>

        <button
          onClick={google}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-secondary"
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <Field label="Full name" value={fullName} onChange={setFullName} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Designation" value={designation} onChange={setDesignation} />
                <Field label="District" value={district} onChange={setDistrict} />
              </div>
            </>
          )}
          <Field label="Official email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required />

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-4 rounded-md border p-3 text-sm ${
              message.tone === "error"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-border bg-secondary text-foreground"
            }`}
          >
            {message.text}
          </p>
        )}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New officer?" : "Already registered?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setMessage(null);
            }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prototype access only. Production deployment requires authorized government identity
          verification.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
