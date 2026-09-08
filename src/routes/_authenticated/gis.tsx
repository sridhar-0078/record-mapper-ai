import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, StatusBadge } from "@/components/ui-kit";
import { getOverlaps, parcelsAtPoint, STATUS_LABEL } from "@/lib/land";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/gis")({
  head: () => ({
    meta: [
      { title: "GIS Cadastral Parcels — Bhoomi Setu" },
      {
        name: "description",
        content:
          "Cadastral parcel polygons linked to survey numbers, with spatial conflict detection and point lookup.",
      },
      { property: "og:title", content: "GIS Cadastral Parcels — Bhoomi Setu" },
      {
        property: "og:description",
        content: "Map view of sample cadastral parcels, overlap detection and location-based parcel lookup.",
      },
    ],
  }),
  component: GisPage,
});

type Parcel = {
  id: string;
  survey_number: string;
  owner_name: string | null;
  record_status: string;
  area_acres: number | null;
  village: string | null;
  geojson: string;
};

const COLORS: Record<string, string> = {
  verified: "var(--success)",
  flagged: "var(--destructive)",
  needs_review: "var(--warning)",
  pending_verification: "var(--primary)",
};

function GisPage() {
  const parcels = useQuery({
    queryKey: ["parcels"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("parcels_geojson" as never);
      if (error) throw error;
      return (data ?? []) as unknown as Parcel[];
    },
  });
  const overlaps = useQuery({ queryKey: ["overlaps"], queryFn: getOverlaps });

  const [lat, setLat] = useState("21.1312");
  const [lng, setLng] = useState("79.0415");
  const [lookup, setLookup] = useState<Awaited<ReturnType<typeof parcelsAtPoint>> | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const list = parcels.data ?? [];
  const rings = list.map((p) => ({
    ...p,
    ring: (JSON.parse(p.geojson) as { coordinates: number[][][] }).coordinates[0]!,
  }));

  const xs = rings.flatMap((r) => r.ring.map((c) => c[0]!));
  const ys = rings.flatMap((r) => r.ring.map((c) => c[1]!));
  const minX = Math.min(...xs, Number(lng));
  const maxX = Math.max(...xs, Number(lng));
  const minY = Math.min(...ys, Number(lat));
  const maxY = Math.max(...ys, Number(lat));
  const pad = 0.002;
  const W = 720;
  const H = 460;
  const sx = (x: number) => ((x - (minX - pad)) / (maxX - minX + pad * 2)) * W;
  const sy = (y: number) => H - ((y - (minY - pad)) / (maxY - minY + pad * 2)) * H;

  async function runLookup(la: number, ln: number, acc: number | null) {
    setBusy(true);
    setAccuracy(acc);
    try {
      setLookup(await parcelsAtPoint(la, ln, Math.max(acc ?? 0, 60)));
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));
      void runLookup(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy));
    });
  }

  const inside = lookup?.find((p) => p.inside);
  const nearBoundary = inside && (accuracy ?? 0) > 0 && lookup!.some((p) => !p.inside && p.distance_m < (accuracy ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">GIS &amp; cadastral parcels</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sample fictional parcel polygons linked to survey numbers, stored as spatial geometry.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Parcel map" subtitle="Colour indicates verification status">
          {rings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading parcels…</p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md border border-border bg-secondary/40">
              {rings.map((p) => (
                <g key={p.id}>
                  <polygon
                    points={p.ring.map((c) => `${sx(c[0]!)},${sy(c[1]!)}`).join(" ")}
                    fill={COLORS[p.record_status] ?? "var(--primary)"}
                    fillOpacity={0.22}
                    stroke={COLORS[p.record_status] ?? "var(--primary)"}
                    strokeWidth={1.5}
                  />
                  <text
                    x={sx(p.ring.reduce((s, c) => s + c[0]!, 0) / p.ring.length)}
                    y={sy(p.ring.reduce((s, c) => s + c[1]!, 0) / p.ring.length)}
                    textAnchor="middle"
                    className="font-mono"
                    fontSize={11}
                    fill="currentColor"
                  >
                    {p.survey_number}
                  </text>
                </g>
              ))}
              {Number(lat) && Number(lng) ? (
                <circle cx={sx(Number(lng))} cy={sy(Number(lat))} r={5} fill="var(--accent)" stroke="var(--foreground)" />
              ) : null}
            </svg>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Location lookup" subtitle="Point-in-polygon query against parcel boundaries">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Latitude
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                Longitude
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => runLookup(Number(lat), Number(lng), accuracy)}
                disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Find parcel
              </button>
              <button
                onClick={useMyLocation}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium"
              >
                Use my location
              </button>
            </div>

            {lookup && (
              <div className="mt-4 space-y-3 text-sm">
                {accuracy != null && (
                  <p className="text-xs text-muted-foreground">GPS accuracy ±{accuracy} m</p>
                )}
                {inside ? (
                  <div className="rounded-md border border-border p-3">
                    <p className="font-medium">Matched parcel: Survey {inside.survey_number}</p>
                    <p className="text-muted-foreground">
                      {inside.village} · {inside.land_type} · {inside.area_acres} acres
                    </p>
                    <div className="mt-2">
                      <StatusBadge
                        status={inside.record_status}
                        label={STATUS_LABEL[inside.record_status] ?? inside.record_status}
                      />
                    </div>
                    <Link
                      to="/records/$id"
                      params={{ id: inside.id }}
                      className="mt-2 inline-block text-primary underline-offset-4 hover:underline"
                    >
                      Open record
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No parcel contains this point.</p>
                )}
                {(nearBoundary || !inside) && lookup.filter((p) => !p.inside).length > 0 && (
                  <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                    <p className="font-medium">Point is close to a parcel boundary</p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {lookup
                        .filter((p) => !p.inside)
                        .map((p) => (
                          <li key={p.id}>
                            Survey {p.survey_number} — {p.distance_m.toFixed(0)} m away
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Location-based identification is indicative only and is never proof of ownership.
                </p>
              </div>
            )}
          </Card>

          <Card title="Spatial conflicts" subtitle="Overlapping parcel geometry needing survey review">
            {(overlaps.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No overlapping parcels detected.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(overlaps.data ?? []).map((o, i) => (
                  <li key={i} className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    Survey {o.a_survey} overlaps Survey {o.b_survey} by{" "}
                    <span className="font-mono">{o.overlap_sq_m.toFixed(0)} m²</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
