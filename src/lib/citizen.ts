import { supabase } from "@/integrations/supabase/client";

export type CitizenParcel = {
  survey_number: string;
  area_acres: number | null;
  land_type: string | null;
  village: string | null;
  tehsil: string | null;
  district: string | null;
  record_status: string;
  inside: boolean;
  distance_m: number;
};

export type CitizenSearchRow = {
  survey_number: string;
  khasra_khata_number: string | null;
  area_acres: number | null;
  land_type: string | null;
  village: string | null;
  tehsil: string | null;
  district: string | null;
  record_status: string;
};

export type CitizenRequest = {
  ticket: string;
  survey_number: string | null;
  request_type: string;
  status: string;
  officer_note: string | null;
  message: string;
  created_at: string;
  updated_at: string;
};

export async function parcelsAtLocation(lat: number, lng: number, radius = 60) {
  const { data, error } = await supabase.rpc("citizen_parcels_at_point" as never, {
    lat,
    lng,
    radius_m: radius,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as CitizenParcel[];
}

export async function searchPublicRecords(q: string) {
  const { data, error } = await supabase.rpc("citizen_search_records" as never, { q } as never);
  if (error) throw error;
  return (data ?? []) as unknown as CitizenSearchRow[];
}

export async function submitCitizenRequest(input: {
  name: string;
  contact: string;
  message: string;
  survey?: string;
  type?: string;
}) {
  const { data, error } = await supabase.rpc("citizen_submit_request" as never, {
    p_name: input.name,
    p_contact: input.contact,
    p_message: input.message,
    p_survey: input.survey ?? null,
    p_type: input.type ?? "correction",
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function trackRequest(ticket: string) {
  const { data, error } = await supabase.rpc("citizen_track_request" as never, {
    p_ticket: ticket,
  } as never);
  if (error) throw error;
  const rows = (data ?? []) as unknown as CitizenRequest[];
  return rows[0] ?? null;
}

/** Real browser GPS reading with accuracy radius. */
export function getCurrentPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Allow location access to find the parcel you are standing on."
              : err.code === err.TIMEOUT
                ? "Timed out while getting your location. Try again in an open area."
                : "Could not determine your location.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

/** Tickets stored on-device so a citizen can come back and track them. */
const KEY = "lw.citizen.tickets";

export function savedTickets(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function saveTicket(ticket: string) {
  if (typeof window === "undefined") return;
  const all = [ticket, ...savedTickets().filter((t) => t !== ticket)].slice(0, 10);
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export const REQUEST_STATUS: Record<string, string> = {
  submitted: "Submitted",
  in_review: "With officer",
  more_info: "More information needed",
  resolved: "Resolved",
  rejected: "Closed without change",
};
