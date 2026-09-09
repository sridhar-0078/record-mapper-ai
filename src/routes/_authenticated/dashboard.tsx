import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, Stat, StatusBadge } from "@/components/ui-kit";
import { getAuditLog, getDocuments, getFlags, listRecords, STATUS_LABEL } from "@/lib/land";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Digitization Dashboard — LAND WALLET" },
      {
        name: "description",
        content:
          "Live view of documents processed, extraction accuracy, pending verifications and flagged land records.",
      },
      { property: "og:title", content: "Digitization Dashboard — LAND WALLET" },
      {
        property: "og:description",
        content: "Track digitization progress, verification backlog and anomalies by district.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const records = useQuery({ queryKey: ["records"], queryFn: listRecords });
  const docs = useQuery({ queryKey: ["documents"], queryFn: getDocuments });
  const flags = useQuery({ queryKey: ["flags"], queryFn: () => getFlags() });
  const audit = useQuery({ queryKey: ["audit"], queryFn: getAuditLog });

  const list = records.data ?? [];
  const verified = list.filter((r) => r.record_status === "verified").length;
  const pending = list.filter((r) => r.record_status !== "verified").length;
  const avgConf = list.length
    ? Math.round((list.reduce((s, r) => s + Number(r.overall_confidence), 0) / list.length) * 100)
    : 0;
  const openFlags = (flags.data ?? []).filter((f) => !f.resolved).length;

  const byVillage = list.reduce<Record<string, { total: number; done: number }>>((acc, r) => {
    const key = r.village ?? "Unassigned";
    acc[key] ??= { total: 0, done: 0 };
    acc[key].total += 1;
    if (r.record_status === "verified") acc[key].done += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl">Digitization dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          End-to-end status of the historical land record digitization programme.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Documents processed" value={docs.data?.length ?? 0} hint="Scans through the pipeline" />
        <Stat label="Structured records" value={list.length} />
        <Stat label="Approved records" value={verified} hint={`${pending} awaiting officer action`} />
        <Stat label="Avg. extraction confidence" value={`${avgConf}%`} />
        <Stat label="Open anomalies" value={openFlags} hint="Awaiting human review" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Digitization progress by village" subtitle="Approved vs. total structured records">
          <ul className="space-y-3">
            {Object.entries(byVillage).map(([village, v]) => {
              const pct = Math.round((v.done / v.total) * 100);
              return (
                <li key={village}>
                  <div className="flex justify-between text-sm">
                    <span>{village}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {v.done}/{v.total} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
            {!Object.keys(byVillage).length && (
              <p className="text-sm text-muted-foreground">No records yet.</p>
            )}
          </ul>
        </Card>

        <Card
          title="Records needing attention"
          subtitle="Low confidence, duplicates and conflicts — for review, not judgement"
          action={
            <Link to="/queue" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Open queue
            </Link>
          }
        >
          <ul className="divide-y divide-border">
            {list
              .filter((r) => r.record_status !== "verified")
              .slice(0, 6)
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <Link
                      to="/records/$id"
                      params={{ id: r.id }}
                      className="font-mono text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Survey {r.survey_number}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.owner_name} · {r.village}
                    </p>
                  </div>
                  <StatusBadge status={r.record_status} label={STATUS_LABEL[r.record_status] ?? r.record_status} />
                </li>
              ))}
            {!pending && <p className="text-sm text-muted-foreground">Nothing pending. Queue is clear.</p>}
          </ul>
        </Card>
      </div>

      <Card title="Audit trail" subtitle="Immutable log of every action on the register">
        <ul className="space-y-2 text-sm">
          {(audit.data ?? []).slice(0, 12).map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3 border-b border-border/60 pb-2">
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString()}
              </span>
              <span className="font-medium">{a.action}</span>
              <span className="text-muted-foreground">
                {a.entity} · by {a.actor}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
