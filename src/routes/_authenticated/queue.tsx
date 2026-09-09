import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, ConfidenceBar, StatusBadge } from "@/components/ui-kit";
import { getFlags, listRecords, STATUS_LABEL } from "@/lib/land";

export const Route = createFileRoute("/_authenticated/queue")({
  head: () => ({
    meta: [
      { title: "Human Verification Queue — LAND WALLET" },
      {
        name: "description",
        content:
          "Low-confidence and conflicting land records routed to revenue officers for manual verification.",
      },
      { property: "og:title", content: "Human Verification Queue — LAND WALLET" },
      {
        property: "og:description",
        content: "Review AI-extracted land records flagged for duplicates, area mismatches or low confidence.",
      },
    ],
  }),
  component: QueuePage,
});

function QueuePage() {
  const records = useQuery({ queryKey: ["records"], queryFn: listRecords });
  const flags = useQuery({ queryKey: ["flags"], queryFn: () => getFlags() });

  const queue = (records.data ?? []).filter((r) => r.record_status !== "verified");
  const flagsByRecord = (flags.data ?? []).reduce<Record<string, number>>((acc, f) => {
    if (!f.resolved) acc[f.record_id] = (acc[f.record_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Human verification queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Records the AI could not confirm on its own. Anomalies are surfaced for your judgement —
          the system never declares fraud.
        </p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Survey no.</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Village</th>
                <th className="py-2 pr-4">Area</th>
                <th className="py-2 pr-4">Confidence</th>
                <th className="py-2 pr-4">Anomalies</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-mono">{r.survey_number}</td>
                  <td className="py-3 pr-4">{r.owner_name}</td>
                  <td className="py-3 pr-4">{r.village}</td>
                  <td className="py-3 pr-4 font-mono">{r.area_acres} ac</td>
                  <td className="py-3 pr-4">
                    <ConfidenceBar value={Number(r.overall_confidence)} />
                  </td>
                  <td className="py-3 pr-4">
                    {flagsByRecord[r.id] ? (
                      <span className="text-destructive">{flagsByRecord[r.id]} open</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={r.record_status} label={STATUS_LABEL[r.record_status] ?? r.record_status} />
                  </td>
                  <td className="py-3">
                    <Link
                      to="/records/$id"
                      params={{ id: r.id }}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Verify
                    </Link>
                  </td>
                </tr>
              ))}
              {!queue.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    Queue is clear.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
