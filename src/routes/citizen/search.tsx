import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Card, StatusBadge } from "@/components/ui-kit";
import { STATUS_LABEL } from "@/lib/land";
import { searchPublicRecords, type CitizenSearchRow } from "@/lib/citizen";

export const Route = createFileRoute("/citizen/search")({
  head: () => ({
    meta: [
      { title: "Search land records — LAND WALLET" },
      {
        name: "description",
        content: "Search digitized land records by survey number, khasra/khata number or village.",
      },
      { property: "og:title", content: "Search land records — LAND WALLET" },
      {
        property: "og:description",
        content: "Citizen search across verified and digitized cadastral land records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CitizenSearchRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      setRows(await searchPublicRecords(q));
    } catch {
      setError("Search is unavailable right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl">Search land records</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          By survey number, khasra/khata number or village name.
        </p>
      </div>

      <form onSubmit={run} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. 112/3 or Ambazari"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy}>
          {busy ? "…" : "Search"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {rows && rows.length === 0 && (
        <p className="rounded-md border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          No records matched that search.
        </p>
      )}

      <div className="space-y-3">
        {rows?.map((r) => (
          <Card key={r.survey_number + (r.khasra_khata_number ?? "")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-base">{r.survey_number}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.village, r.tehsil, r.district].filter(Boolean).join(" · ")}
                </p>
              </div>
              <StatusBadge
                status={r.record_status}
                label={STATUS_LABEL[r.record_status] ?? r.record_status}
              />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Item label="Khasra / Khata" value={r.khasra_khata_number ?? "—"} />
              <Item label="Area" value={r.area_acres ? `${r.area_acres} acres` : "—"} />
              <Item label="Classification" value={r.land_type ?? "—"} />
            </dl>
            <Link
              to="/citizen/requests"
              search={{ survey: r.survey_number }}
              className="mt-3 block rounded-md border border-border px-3 py-2 text-center text-sm text-primary"
            >
              Request a correction
            </Link>
          </Card>
        ))}
      </div>

      <p className="rounded-md border border-border bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Owner names are not shown in the citizen app. Only non-sensitive parcel information is published here.
      </p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
