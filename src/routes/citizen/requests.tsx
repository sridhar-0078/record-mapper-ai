import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Card, StatusBadge } from "@/components/ui-kit";
import {
  REQUEST_STATUS,
  savedTickets,
  saveTicket,
  submitCitizenRequest,
  trackRequest,
  type CitizenRequest,
} from "@/lib/citizen";

type Search = { survey?: string };

export const Route = createFileRoute("/citizen/requests")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    survey: typeof search["survey"] === "string" ? search["survey"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "My requests — LAND WALLET" },
      {
        name: "description",
        content:
          "Submit a land record correction request and track its status with your ticket number.",
      },
      { property: "og:title", content: "My requests — LAND WALLET" },
      {
        property: "og:description",
        content: "Raise and follow up on land record correction requests as a citizen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

const TYPES = [
  { value: "correction", label: "Correction to a record" },
  { value: "verification", label: "Verification request" },
  { value: "boundary", label: "Boundary / mapping issue" },
];

function RequestsPage() {
  const { survey } = Route.useSearch();
  const [form, setForm] = useState({
    name: "",
    contact: "",
    message: "",
    survey: survey ?? "",
    type: "correction",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState<string | null>(null);

  const [tickets, setTickets] = useState<string[]>([]);
  const [tracked, setTracked] = useState<CitizenRequest[]>([]);
  const [lookup, setLookup] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    setTickets(savedTickets());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await Promise.all(tickets.map((t) => trackRequest(t).catch(() => null)));
      if (!cancelled) setTracked(rows.filter((r): r is CitizenRequest => !!r));
    })();
    return () => {
      cancelled = true;
    };
  }, [tickets]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      setError("Your name and a description of the issue are required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const ticket = await submitCitizenRequest(form);
      saveTicket(ticket);
      setNewTicket(ticket);
      setTickets(savedTickets());
      setForm({ name: "", contact: "", message: "", survey: "", type: "correction" });
    } catch {
      setError("Could not submit the request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function track(e: React.FormEvent) {
    e.preventDefault();
    const t = lookup.trim().toUpperCase();
    if (!t) return;
    setLookupError(null);
    const row = await trackRequest(t).catch(() => null);
    if (!row) {
      setLookupError("No request found with that ticket number.");
      return;
    }
    saveTicket(t);
    setTickets(savedTickets());
    setLookup("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl">My requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raise a correction or verification request and follow its progress.
        </p>
      </div>

      {newTicket && (
        <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">
          Request submitted. Your ticket number is <span className="font-mono">{newTicket}</span> — keep it to
          track the status.
        </p>
      )}

      <Card title="Submit a request">
        <form onSubmit={submit} className="space-y-3 text-sm">
          <Field label="Your name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2"
            />
          </Field>
          <Field label="Phone or email (optional)">
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2"
            />
          </Field>
          <Field label="Survey number (optional)">
            <input
              value={form.survey}
              onChange={(e) => setForm({ ...form, survey: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono"
            />
          </Field>
          <Field label="Request type">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="What is the problem?">
            <textarea
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2"
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      </Card>

      <Card title="Track by ticket number">
        <form onSubmit={track} className="flex gap-2">
          <input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="LW-XXXXXX"
            className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm uppercase"
          />
          <Button type="submit" variant="outline">
            Track
          </Button>
        </form>
        {lookupError && <p className="mt-2 text-sm text-destructive">{lookupError}</p>}
      </Card>

      {tracked.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-serif text-lg">Status</h2>
          {tracked.map((r) => (
            <Card key={r.ticket}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm">{r.ticket}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.survey_number ? `Survey ${r.survey_number} · ` : ""}
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge
                  status={r.status === "resolved" ? "verified" : r.status === "rejected" ? "flagged" : "needs_review"}
                  label={REQUEST_STATUS[r.status] ?? r.status}
                />
              </div>
              <p className="mt-3 text-sm">{r.message}</p>
              {r.officer_note && (
                <p className="mt-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm">
                  Officer note: {r.officer_note}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
