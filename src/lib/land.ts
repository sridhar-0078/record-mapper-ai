import { supabase } from "@/integrations/supabase/client";

export type LandRecord = {
  id: string;
  document_id: string | null;
  owner_name: string | null;
  survey_number: string;
  khasra_khata_number: string | null;
  area_acres: number | null;
  village: string | null;
  tehsil: string | null;
  district: string | null;
  land_type: string | null;
  mutation_details: string | null;
  registration_info: string | null;
  record_status: string;
  confidence_scores: Record<string, number>;
  overall_confidence: number;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
};

export const FIELDS = [
  { key: "owner_name", label: "Owner name" },
  { key: "survey_number", label: "Survey number" },
  { key: "khasra_khata_number", label: "Khasra / Khata number" },
  { key: "area_acres", label: "Area (acres)" },
  { key: "village", label: "Village" },
  { key: "tehsil", label: "Tehsil / Taluk" },
  { key: "district", label: "District" },
  { key: "land_type", label: "Land classification" },
  { key: "mutation_details", label: "Mutation details" },
  { key: "registration_info", label: "Registration information" },
] as const;

export const STATUS_LABEL: Record<string, string> = {
  pending_verification: "Pending verification",
  needs_review: "Needs review",
  flagged: "Flagged for review",
  verified: "Verified",
};

export async function listRecords() {
  const { data, error } = await supabase
    .from("land_record")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LandRecord[];
}

export async function getRecord(id: string) {
  const { data, error } = await supabase.from("land_record").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as LandRecord | null;
}

export async function getHistory(recordId: string) {
  const { data, error } = await supabase
    .from("record_history")
    .select("*")
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getFlags(recordId?: string) {
  let q = supabase.from("validation_flag").select("*").order("created_at", { ascending: false });
  if (recordId) q = q.eq("record_id", recordId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getAuditLog() {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------ *
 * Simulated digitization pipeline
 * Stands in for: OpenCV preprocessing -> OCR/handwriting recognition ->
 * NLP field extraction. Produces the same structured output shape a real
 * pipeline would, so the officer review workflow is fully exercised.
 * ------------------------------------------------------------------ */

const SAMPLE_OWNERS = ["Vithal Pawar", "Meenakshi Joshi", "Harish Gadge", "Laxmi Bai Chavan", "Iqbal Ansari"];
const SAMPLE_VILLAGES = ["Ambazari", "Wadi", "Hingna", "Butibori", "Kalmeshwar"];
const SAMPLE_TYPES = ["Agricultural", "Residential", "Commercial", "Barren"];

const rand = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
const conf = (min: number, max: number) => Math.round((min + Math.random() * (max - min)) * 100) / 100;

export type PipelineResult = { recordId: string; steps: string[]; flags: string[] };

export async function runDigitizationPipeline(input: {
  fileName: string;
  language: string;
  district: string;
}): Promise<PipelineResult> {
  const steps: string[] = [];
  const survey = `${Math.floor(Math.random() * 240) + 10}/${Math.floor(Math.random() * 9) + 1}`;
  const village = rand(SAMPLE_VILLAGES);
  const area = Math.round((Math.random() * 6 + 0.4) * 100) / 100;

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      file_name: input.fileName,
      language: input.language,
      district: input.district,
      status: "extracted",
      preprocessing: { deskew: true, denoise: true, contrast_enhanced: true, rotation_deg: -1.4 },
      ocr_text: `सर्वे क्रमांक ${survey} — ग्राम ${village} — क्षेत्रफल ${area} एकड़ (simulated OCR output)`,
    })
    .select()
    .single();
  if (docErr) throw docErr;
  steps.push("Image preprocessing: denoise, contrast enhancement, deskew (−1.4°)");
  steps.push(`OCR + handwriting recognition (${input.language.toUpperCase()}) completed`);

  const confidence_scores = {
    owner_name: conf(0.55, 0.99),
    survey_number: conf(0.8, 0.99),
    khasra_khata_number: conf(0.6, 0.97),
    area_acres: conf(0.5, 0.98),
    village: conf(0.75, 0.99),
    tehsil: conf(0.7, 0.98),
    district: conf(0.85, 0.99),
    land_type: conf(0.6, 0.96),
    mutation_details: conf(0.3, 0.9),
    registration_info: conf(0.45, 0.95),
  };
  const values = Object.values(confidence_scores);
  const overall = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
  steps.push("NLP field extraction produced a structured land record");

  const { data: existing } = await supabase
    .from("land_record")
    .select("id, survey_number, area_acres")
    .eq("survey_number", survey);

  const flags: string[] = [];
  if (existing && existing.length > 0) flags.push("duplicate_survey_number");
  if (overall < 0.8) flags.push("low_confidence");
  if (confidence_scores.mutation_details < 0.5) flags.push("missing_or_unclear_mutation");

  const status = flags.includes("duplicate_survey_number")
    ? "flagged"
    : overall < 0.8
      ? "needs_review"
      : "pending_verification";

  const { data: rec, error: recErr } = await supabase
    .from("land_record")
    .insert({
      document_id: doc.id,
      owner_name: rand(SAMPLE_OWNERS),
      survey_number: survey,
      khasra_khata_number: `KH-${Math.floor(Math.random() * 9000) + 1000}`,
      area_acres: area,
      village,
      tehsil: "Nagpur Rural",
      district: input.district,
      land_type: rand(SAMPLE_TYPES),
      mutation_details: "Mutation entry partially legible in source document",
      registration_info: `Reg. ${1950 + Math.floor(Math.random() * 60)}/${village.slice(0, 3).toUpperCase()}/${Math.floor(Math.random() * 900) + 100}`,
      record_status: status,
      confidence_scores,
      overall_confidence: overall,
    })
    .select()
    .single();
  if (recErr) throw recErr;
  steps.push("Validation and duplicate/anomaly checks completed");

  const messages: Record<string, { severity: string; message: string }> = {
    duplicate_survey_number: {
      severity: "high",
      message: `Survey number ${survey} already exists in the register — possible duplicate document or a newer version. Flagged for officer review only.`,
    },
    low_confidence: {
      severity: "medium",
      message: `Overall extraction confidence is ${(overall * 100).toFixed(0)}% — several fields need manual comparison with the scan.`,
    },
    missing_or_unclear_mutation: {
      severity: "low",
      message: "Mutation details could not be read reliably from the source document.",
    },
  };
  if (flags.length) {
    await supabase
      .from("validation_flag")
      .insert(flags.map((f) => ({ record_id: rec.id, flag_type: f, ...messages[f]! })));
  }

  await supabase.from("record_history").insert({
    record_id: rec.id,
    survey_number: survey,
    event_type: "digitized",
    summary: `Digitized from ${input.fileName}`,
    actor: "ai.pipeline",
  });
  await supabase.from("audit_log").insert({
    entity: "land_record",
    entity_id: rec.id,
    action: "created",
    details: { survey_number: survey, source: input.fileName },
  });

  return { recordId: rec.id, steps, flags };
}

export async function saveCorrections(
  record: LandRecord,
  updates: Record<string, string>,
  approve: boolean,
) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    const current = (record as unknown as Record<string, unknown>)[key];
    const next = key === "area_acres" ? (value === "" ? null : Number(value)) : value === "" ? null : value;
    if (String(current ?? "") !== String(next ?? "")) {
      changes[key] = { from: current, to: next };
      patch[key] = next;
    }
  }

  if (Object.keys(changes).length) {
    await supabase.from("correction_feedback").insert(
      Object.entries(changes).map(([field, c]) => ({
        record_id: record.id,
        field_name: field,
        ai_value: c.from === null || c.from === undefined ? null : String(c.from),
        corrected_value: c.to === null ? null : String(c.to),
        ai_confidence: record.confidence_scores?.[field] ?? null,
      })),
    );
  }

  if (approve) {
    patch["record_status"] = "verified";
    patch["verified_by"] = "demo.officer";
    patch["verified_at"] = new Date().toISOString();
  }
  patch["updated_at"] = new Date().toISOString();

  const { error } = await supabase.from("land_record").update(patch as never).eq("id", record.id);
  if (error) throw error;

  if (Object.keys(changes).length) {
    await supabase.from("record_history").insert({
      record_id: record.id,
      survey_number: record.survey_number,
      event_type: "corrected",
      summary: `Officer corrected ${Object.keys(changes).length} field(s)`,
      changes: changes as never,
      actor: "demo.officer",
    });
  }
  if (approve) {
    await supabase.from("record_history").insert({
      record_id: record.id,
      survey_number: record.survey_number,
      event_type: "verified",
      summary: "Record approved by officer",
      actor: "demo.officer",
    });
    await supabase.from("validation_flag").update({ resolved: true }).eq("record_id", record.id);
  }
  await supabase.from("audit_log").insert({
    entity: "land_record",
    entity_id: record.id,
    action: approve ? "approved" : "updated",
    details: changes as never,
  });
}

export async function flagRecord(record: LandRecord, message: string) {
  await supabase.from("land_record").update({ record_status: "flagged" }).eq("id", record.id);
  await supabase.from("validation_flag").insert({
    record_id: record.id,
    flag_type: "officer_flag",
    severity: "high",
    message,
  });
  await supabase.from("record_history").insert({
    record_id: record.id,
    survey_number: record.survey_number,
    event_type: "flagged",
    summary: message,
    actor: "demo.officer",
  });
  await supabase.from("audit_log").insert({
    entity: "land_record",
    entity_id: record.id,
    action: "flagged",
    details: { message },
  });
}

export async function getParcels() {
  const { data, error } = await supabase.rpc("parcels_geojson" as never);
  if (error) throw error;
  return data;
}

export async function getOverlaps() {
  const { data, error } = await supabase.rpc("overlapping_parcels" as never);
  if (error) throw error;
  return (data ?? []) as unknown as { a_survey: string; b_survey: string; overlap_sq_m: number }[];
}

export async function parcelsAtPoint(lat: number, lng: number, radius = 60) {
  const { data, error } = await supabase.rpc("parcels_at_point" as never, {
    lat,
    lng,
    radius_m: radius,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string;
    survey_number: string;
    owner_name: string | null;
    area_acres: number | null;
    land_type: string | null;
    village: string | null;
    record_status: string;
    inside: boolean;
    distance_m: number;
  }[];
}
