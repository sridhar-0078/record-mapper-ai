import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/citizen")({
  component: CitizenShell,
});

const TABS = [
  { to: "/citizen", label: "My location", exact: true },
  { to: "/citizen/search", label: "Search" },
  { to: "/citizen/requests", label: "Requests" },
] as const;

function CitizenShell() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-border bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-accent/60 font-serif text-accent">
              LW
            </span>
            <div>
              <p className="font-serif text-base leading-tight">LAND WALLET</p>
              <p className="text-[11px] opacity-80">Citizen services</p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-24">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-border bg-card">
          <div className="grid grid-cols-3">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: "exact" in t }}
                className="px-2 py-3 text-center text-xs text-muted-foreground [&.active]:font-semibold [&.active]:text-primary"
              >
                {t.label}
              </Link>
            ))}
          </div>
          <p className="border-t border-border bg-secondary px-4 py-1.5 text-center text-[10px] leading-snug text-muted-foreground">
            Prototype with sample parcels. Location results are indicative only and are never proof of ownership.
          </p>
        </nav>
      </div>
    </div>
  );
}
