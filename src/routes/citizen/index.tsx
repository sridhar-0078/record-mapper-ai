import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Card, StatusBadge } from "@/components/ui-kit";
import { STATUS_LABEL } from "@/lib/land";
import { getCurrentPosition, parcelsAtLocation, type CitizenParcel } from "@/lib/citizen";

export const Route = createFileRoute("/citizen/")({
  head: () => ({
    meta: [
      { title: "Land details at my location — LAND WALLET" },
      {
        name: "description",
        content:
          "Use your phone's GPS to find the survey number, area and classification of the land parcel you are standing on.",
      },
      { property: "og:title", content: "Land details at my location — LAND WALLET" },
      {
        property: "og:description",
        content: "GPS-based cadastral parcel lookup with accuracy caveats for citizens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LocatePage,
});

function LocatePage() {
  const [state, setState] = useState<"idle" | "locating" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [parcels, setParcels] = useState<CitizenParcel[]>([]);

  async function locate() {
    setError(null);
    setState("locating");
    try {
      const p = await getCurrentPosition();
      setPos(p);
      const radius = Math.min(Math.max(p.accuracy, 30), 250);
      setParcels(await parcelsAtLocation(p.lat, p.lng, radius));
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("idle");
    }
  }

  const match = parcels.find((p) => p.inside) ?? null;
  const others = parcels.filter((p) => p !== match);
  const nearBoundary =
    !!match && pos ? match.distance_m <= pos.accuracy : parcels.length > 0 && !match;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl">Land details at my location</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Allow location access and we will match your position against mapped cadastral parcels.
        </p>
      </div>

      <Button onClick={locate} disabled={state === "locating"} className="w-full">
        {state === "locating" ? "Getting your location…" : "Use my current location"}
      </Button>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {pos && (
        <Card title="Your position">
          <dl className="grid grid-cols-2 gap-3 font-mono text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Latitude</dt>
              <dd>{pos.lat.toFixed(6)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Longitude</dt>
              <dd>{pos.lng.toFixed(6)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">GPS accuracy</dt>
              <dd>±{pos.accuracy} m</dd>
            </div>
          </dl>
        </Card>
      )}

      {state === "done" && match && (
        <Card title={`Survey number ${match.survey_number}`} subtitle="Parcel containing your position">
          <div className="space-y-2 text-sm">
            <Row label="Area" value={match.area_acres ? `${match.area_acres} acres` : "—"} />
            <Row label="Classification" value={match.land_type ?? "—"} />
            <Row label="Village" value={match.village ?? "—"} />
            <Row label="Tehsil" value={match.tehsil ?? "—"} />
            <Row label="District" value={match.district ?? "—"} />
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-muted-foreground">Record status</span>
              <StatusBadge
                status={match.record_status}
                label={STATUS_LABEL[match.record_status] ?? match.record_status}
              />
            </div>
          </div>
          <Link
            to="/citizen/requests"
            search={{ survey: match.survey_number }}
            className="mt-4 block rounded-md border border-border px-3 py-2 text-center text-sm text-primary"
          >
            Report a problem with this record
          </Link>
        </Card>
      )}

      {state === "done" && !match && parcels.length > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          You do not appear to be inside a mapped parcel. The closest parcels are listed below.
        </p>
      )}

      {state === "done" && parcels.length === 0 && (
        <p className="rounded-md border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          No mapped parcel was found near you. This demo only covers a small sample area around Nagpur.
        </p>
      )}

      {nearBoundary && others.length > 0 && (
        <Card title="You may be near a boundary" subtitle="Nearby survey numbers to consider">
          <ul className="space-y-2 text-sm">
            {others.map((p) => (
              <li key={p.survey_number} className="flex items-center justify-between gap-3">
                <span className="font-mono">{p.survey_number}</span>
                <span className="text-xs text-muted-foreground">
                  {p.village ?? "—"} · {Math.round(p.distance_m)} m away
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="rounded-md border border-border bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        GPS identification is indicative only. Position error of ±{pos?.accuracy ?? "several"} metres can place you
        in a neighbouring parcel. This screen is not proof of ownership and has no legal standing — obtain a
        certified record from the revenue office for any official purpose.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
