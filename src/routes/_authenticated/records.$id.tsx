import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, Card, ConfidenceBar, StatusBadge } from "@/components/ui-kit";
import {
  FIELDS,
  STATUS_LABEL,
  flagRecord,
  getFlags,
  getHistory,
  getRecord,
  saveCorrections,
} from "@/lib/land";

export const Route = createFileRoute("/_authenticated/records/$id")({
  head: () => ({
    meta: [
      { title: "Record Verification — LAND WALLET" },
      {
        name: "description",
        content:
          "Compare AI-extracted fields against the source scan, correct values, approve or flag the record.",
      },
      { property: "og:title", content: "Record Verification — LAND WALLET" },
      {
        property: "og:description",
        content: "Per-field confidence scores, anomaly flags and the full change history of a land record.",
      },
    ],
  }),
  component: RecordDetail,
});

function RecordDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const record = useQuery({ queryKey: ["record", id], queryFn: () => getRecord(id) });
  const history = useQuery({ queryKey: ["history", id], queryFn: () => getHistory(id) });
  const flags = useQuery({ queryKey: ["flags", id], queryFn: () => getFlags(id) });

  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!record.data) return;
    const r = record.data as unknown as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const f of FIELDS) next[f.key] = r[f.key] == null ? "" : String(r[f.key]);
    setForm(next);
  }, [record.data]);

  if (record.isLoading) return <p className="text-sm text-muted-foreground">Loading record…</p>;
  if (!record.data) return <p className="text-sm text-muted-foreground">Record not found.</p>;
  const r = record.data;

  async function submit(approve: boolean) {
    setSaving(true);
    setNote(null);
    try {
      await saveCorrections(r, form, approve);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["record", id] }),
        qc.invalidateQueries({ queryKey: ["history", id] }),
        qc.invalidateQueries({ queryKey: ["flags"] }),
        qc.invalidateQueries({ queryKey: ["records"] }),
      ]);
      setNote(approve ? "Record approved and added to the verified register." : "Corrections saved.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function raiseFlag() {
    const message = window.prompt("Describe the issue for the reviewing officer:");
    if (!message) return;
    await flagRecord(r, message);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["record", id] }),
      qc.invalidateQueries({ queryKey: ["flags"] }),
      qc.invalidateQueries({ queryKey: ["records"] }),
    ]);
    setNote("Record flagged for further review.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/queue" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            ← Back to queue
          </Link>
          <h1 className="font-serif text-2xl">Survey {r.survey_number}</h1>
          <p className="text-sm text-muted-foreground">
            {r.village} · {r.tehsil} · {r.district}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConfidenceBar value={Number(r.overall_confidence)} />
          <StatusBadge status={r.record_status} label={STATUS_LABEL[r.record_status] ?? r.record_status} />
        </div>
      </div>

      {(flags.data ?? []).filter((f) => !f.resolved).length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Anomalies detected — officer review required</p>
          <ul className="mt-2 space-y-1 text-sm">
            {(flags.data ?? [])
              .filter((f) => !f.resolved)
              .map((f) => (
                <li key={f.id}>
                  <span className="font-mono text-xs uppercase text-muted-foreground">
                    {f.severity}
                  </span>{" "}
                  {f.message}
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            These are indicators only. The system does not determine fraud.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card title="AI extraction vs. officer correction" subtitle="Edit any field, then approve">
          <div className="space-y-4">
            {FIELDS.map((f) => {
              const c = r.confidence_scores?.[f.key];
              return (
                <div key={f.key} className="grid gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{f.label}</label>
                    {c != null && <ConfidenceBar value={Number(c)} />}
                  </div>
                  <input
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className={`w-full rounded-md border bg-card px-3 py-2 text-sm ${
                      c != null && Number(c) < 0.75 ? "border-warning" : "border-input"
                    }`}
                  />
                </div>
              );
            })}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => submit(true)} disabled={saving}>
                Approve record
              </Button>
              <Button variant="outline" onClick={() => submit(false)} disabled={saving}>
                Save corrections
              </Button>
              <Button variant="danger" onClick={raiseFlag} disabled={saving}>
                Flag for review
              </Button>
            </div>
            {note && <p className="text-sm text-success">{note}</p>}
            <p className="text-xs text-muted-foreground">
              Every correction is stored as training feedback and improves future extraction accuracy.
            </p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Source document" subtitle="Simulated scan preview and recognised text">
            <div className="rounded-md border border-dashed border-border bg-secondary/50 p-6 text-center text-sm text-muted-foreground">
              Scanned page preview
              <p className="mt-1 text-xs">
                Demo build — original scans are stored in encrypted object storage in production.
              </p>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
              {`सर्वे क्रमांक ${r.survey_number}\nस्वामी: ${r.owner_name ?? "—"}\nक्षेत्रफल: ${r.area_acres ?? "—"} एकड़\nग्राम: ${r.village ?? "—"}`}
            </pre>
          </Card>

          <Card title="Record history" subtitle="Immutable timeline for this survey number">
            <ol className="space-y-3">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm font-medium">{h.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.event_type} · {h.actor} · {new Date(h.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
