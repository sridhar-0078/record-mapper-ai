CREATE EXTENSION IF NOT EXISTS postgis;

-- Documents uploaded by officers
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT,
  language TEXT NOT NULL DEFAULT 'hi',
  district TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  ocr_text TEXT,
  preprocessing JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by TEXT NOT NULL DEFAULT 'demo.officer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.land_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  owner_name TEXT,
  survey_number TEXT NOT NULL,
  khasra_khata_number TEXT,
  area_acres NUMERIC,
  village TEXT,
  tehsil TEXT,
  district TEXT,
  land_type TEXT,
  mutation_details TEXT,
  registration_info TEXT,
  record_status TEXT NOT NULL DEFAULT 'pending_verification',
  confidence_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_confidence NUMERIC NOT NULL DEFAULT 0,
  geom geometry(Polygon, 4326),
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX land_record_geom_idx ON public.land_record USING GIST (geom);
CREATE INDEX land_record_survey_idx ON public.land_record (survey_number);

CREATE TABLE public.record_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.land_record(id) ON DELETE CASCADE,
  survey_number TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.validation_flag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.land_record(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'demo.officer',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.correction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.land_record(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  ai_value TEXT,
  corrected_value TEXT,
  ai_confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents, public.land_record, public.record_history, public.validation_flag, public.audit_log, public.correction_feedback TO anon, authenticated;
GRANT ALL ON public.documents, public.land_record, public.record_history, public.validation_flag, public.audit_log, public.correction_feedback TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_flag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo open documents" ON public.documents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open land_record" ON public.land_record FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open record_history" ON public.record_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open validation_flag" ON public.validation_flag FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open audit_log" ON public.audit_log FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open correction_feedback" ON public.correction_feedback FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Spatial lookup: point in parcel + nearby parcels
CREATE OR REPLACE FUNCTION public.parcels_at_point(lat double precision, lng double precision, radius_m double precision DEFAULT 50)
RETURNS TABLE (
  id UUID,
  survey_number TEXT,
  owner_name TEXT,
  area_acres NUMERIC,
  land_type TEXT,
  village TEXT,
  record_status TEXT,
  inside BOOLEAN,
  distance_m DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT r.id, r.survey_number, r.owner_name, r.area_acres, r.land_type, r.village, r.record_status,
         ST_Contains(r.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326)) AS inside,
         ST_Distance(r.geom::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) AS distance_m
  FROM public.land_record r
  WHERE r.geom IS NOT NULL
    AND ST_DWithin(r.geom::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_m)
  ORDER BY inside DESC, distance_m ASC
  LIMIT 10;
$$;

-- Overlapping parcel detection
CREATE OR REPLACE FUNCTION public.overlapping_parcels()
RETURNS TABLE (a_survey TEXT, b_survey TEXT, overlap_sq_m DOUBLE PRECISION)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.survey_number, b.survey_number,
         ST_Area(ST_Intersection(a.geom, b.geom)::geography)
  FROM public.land_record a
  JOIN public.land_record b ON a.id < b.id
  WHERE a.geom IS NOT NULL AND b.geom IS NOT NULL AND ST_Overlaps(a.geom, b.geom);
$$;

GRANT EXECUTE ON FUNCTION public.parcels_at_point(double precision, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.overlapping_parcels() TO anon, authenticated;