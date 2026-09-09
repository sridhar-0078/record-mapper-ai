import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LAND WALLET — AI Land Record Digitization Portal" },
      {
        name: "description",
        content:
          "AI-assisted digitization, validation, confidence scoring and GIS linking of legacy land records for revenue officers.",
      },
      { property: "og:title", content: "LAND WALLET — AI Land Record Digitization Portal" },
      {
        property: "og:description",
        content:
          "Digitize historical land records, verify AI extractions and map cadastral parcels in one officer portal.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    title: "Document digitization",
    body: "Scanned records are enhanced, deskewed and read in Hindi, Marathi and English before extraction.",
  },
  {
    title: "AI field extraction",
    body: "Owner, survey number, khasra, area, village, tehsil, mutation and registration fields, each with a confidence score.",
  },
  {
    title: "Validation engine",
    body: "Duplicate survey numbers, area mismatches and conflicting owners are flagged for officer review — never auto-declared fraud.",
  },
  {
    title: "Human verification",
    body: "Low-confidence fields route to a queue where officers compare AI output against the source and correct it.",
  },
  {
    title: "Immutable history",
    body: "Every correction, approval and mutation is written to a per-survey-number timeline and audit log.",
  },
  {
    title: "GIS parcel linking",
    body: "Each record links to a cadastral polygon with spatial overlap detection and location-based lookup.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-accent/60 font-serif text-lg text-accent">
              LW
            </div>
            <div>
              <p className="font-serif text-lg leading-tight">LAND WALLET</p>
              <p className="text-xs opacity-75">Land Record Digitization &amp; Validation</p>
            </div>
          </div>
          <Link
            to="/auth"
            search={{ redirect: undefined }}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Officer sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Prototype · Sample data
        </p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">
          Turn historical land documents into verified, searchable, map-linked records.
        </h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          LAND WALLET reads legacy registers and mutation papers, extracts structured fields with
          per-field confidence, checks them for conflicts, and links each verified record to its
          cadastral parcel — with an officer in the loop at every step.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/auth"
            search={{ redirect: undefined }}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Sign in to the portal
          </Link>
          <Link
            to="/auth"
            search={{ redirect: "/dashboard" }}
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-secondary"
          >
            Create an officer account
          </Link>
          <Link
            to="/citizen"
            className="rounded-md border border-accent/60 px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
          >
            Open the citizen app
          </Link>
        </div>


        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
            >
              <h2 className="font-serif text-lg">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        Prototype using sample fictional parcels and records. Production deployment requires
        authorized government data. Location-based parcel identification is indicative only and is
        never proof of ownership.
      </footer>
    </div>
  );
}
