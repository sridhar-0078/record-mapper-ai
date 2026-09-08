import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, ConfidenceBar, StatusBadge } from "@/components/ui-kit";
import { listRecords, STATUS_LABEL } from "@/lib/land";

export const Route = createFileRoute("/records/")({
  head: () => ({
    meta: [
      { title: "Land Record Register — Bhoomi Setu" },
      {
        name: "description",
        content: "Searchable register of digitized land records with owner, survey number and status.",
      },
      { property: "og:title", content: "Land Record Register — Bhoomi Setu" },
      {
        property: "og:description",
        content: "Search structured land records by owner, survey number, khasra number or village.",
      },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  const [q, setQ] = useState("");
  const records = useQuery({ queryKey: ["records"], queryFn: listRecords });
  const term = q.trim().toLowerCase();
  const list = (records.data ?? []).filter((r) =>
    !term
      ? true
      : [r.owner_name, r.survey_number, r.khasra_khata_number, r.village, r.district]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Land record register</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every structured record produced by the pipeline, with its verification state.
        </p>
      </div>

      <Card>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by owner, survey number, khasra number or village…"
          className="mb-4 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Survey no.</th>
                <th className="py-2 pr-4">Khasra / Khata</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Village / Tehsil</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Area</th>
                <th className="py-2 pr-4">Confidence</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-mono">
                    <Link
                      to="/records/$id"
                      params={{ id: r.id }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {r.survey_number}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{r.khasra_khata_number}</td>
                  <td className="py-3 pr-4">{r.owner_name}</td>
                  <td className="py-3 pr-4">
                    {r.village} · {r.tehsil}
                  </td>
                  <td className="py-3 pr-4">{r.land_type}</td>
                  <td className="py-3 pr-4 font-mono">{r.area_acres} ac</td>
                  <td className="py-3 pr-4">
                    <ConfidenceBar value={Number(r.overall_confidence)} />
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={r.record_status} label={STATUS_LABEL[r.record_status] ?? r.record_status} />
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No matching records.
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
