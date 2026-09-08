import { createFileRoute, Outlet, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfile, fetchRoles } from "@/lib/auth";
import { useLiveData } from "@/hooks/use-live-data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: PortalLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/upload", label: "Upload & digitize" },
  { to: "/queue", label: "Verification queue" },
  { to: "/records", label: "Records" },
  { to: "/gis", label: "GIS parcels" },
] as const;

function PortalLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useLiveData();

  const profile = useQuery({ queryKey: ["profile", user.id], queryFn: () => fetchProfile(user.id) });
  const roles = useQuery({ queryKey: ["roles", user.id], queryFn: () => fetchRoles(user.id) });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  }

  const name = profile.data?.full_name ?? user.email ?? "Officer";
  const role = roles.data?.includes("admin") ? "Administrator" : "Revenue Officer";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-accent/60 font-serif text-lg text-accent">
              भू
            </div>
            <div>
              <p className="font-serif text-lg leading-tight">Bhoomi Setu</p>
              <p className="text-xs opacity-75">
                Intelligent Land Record Digitization &amp; Validation — Officer Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs opacity-85">
              <p className="font-medium">{name}</p>
              <p>
                {role}
                {profile.data?.district ? ` · ${profile.data.district} District` : ""}
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Live
            </span>
            <button
              onClick={signOut}
              className="rounded-md border border-primary-foreground/30 px-3 py-1.5 text-xs font-medium transition hover:bg-primary-foreground/10"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="border-t border-primary-foreground/15">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm opacity-80 transition hover:opacity-100"
                activeProps={{ className: "!border-accent !opacity-100 font-medium" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        Prototype using sample fictional parcels. Production deployment requires authorized
        government parcel and record data. The system flags anomalies for human review and never
        declares fraud automatically.
      </footer>
    </div>
  );
}
