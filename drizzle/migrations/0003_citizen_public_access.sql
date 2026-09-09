-- Citizen-facing public surface: limited parcel lookup + correction requests

CREATE TABLE public.citizen_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket text NOT NULL UNIQUE DEFAULT ('LW-' || upper(substr(md5(random()::text), 1, 6))),
  survey_number text,
  request_type text NOT NULL DEFAULT 'correction',
  citizen_name text NOT NULL,
  contact text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  officer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.citizen_request TO authenticated;
GRANT ALL ON public.citizen_request TO service_role;

ALTER TABLE public.citizen_request ENABLE ROW LEVEL SECURITY;

CREATE POLICY "officers manage citizen_request" ON public.citizen_request
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Citizens are anonymous: they interact only through the security-definer
-- functions below, which expose a limited, non-sensitive projection.

CREATE OR REPLACE FUNCTION public.citizen_parcels_at_point(lat double precision, lng double precision, radius_m double precision DEFAULT 60)
RETURNS TABLE (
  survey_number text,
  area_acres numeric,
  land_type text,
  village text,
  tehsil text,
  district text,
  record_status text,
  inside boolean,
  distance_m double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.survey_number, r.area_acres, r.land_type, r.village, r.tehsil, r.district,
         r.record_status,
         ST_Contains(r.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326)) AS inside,
         ST_Distance(r.geom::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) AS distance_m
  FROM public.land_record r
  WHERE r.geom IS NOT NULL
    AND ST_DWithin(r.geom::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_m)
  ORDER BY inside DESC, distance_m ASC
  LIMIT 8;
$$;

CREATE OR REPLACE FUNCTION public.citizen_search_records(q text)
RETURNS TABLE (
  survey_number text,
  khasra_khata_number text,
  area_acres numeric,
  land_type text,
  village text,
  tehsil text,
  district text,
  record_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.survey_number, r.khasra_khata_number, r.area_acres, r.land_type,
         r.village, r.tehsil, r.district, r.record_status
  FROM public.land_record r
  WHERE q IS NOT NULL AND length(btrim(q)) >= 2
    AND (r.survey_number ILIKE '%' || btrim(q) || '%'
      OR coalesce(r.khasra_khata_number,'') ILIKE '%' || btrim(q) || '%'
      OR coalesce(r.village,'') ILIKE '%' || btrim(q) || '%')
  ORDER BY r.survey_number
  LIMIT 25;
$$;

CREATE OR REPLACE FUNCTION public.citizen_submit_request(
  p_name text, p_contact text, p_message text, p_survey text DEFAULT NULL, p_type text DEFAULT 'correction'
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t text;
BEGIN
  IF coalesce(btrim(p_name),'') = '' OR coalesce(btrim(p_message),'') = '' THEN
    RAISE EXCEPTION 'Name and message are required';
  END IF;
  INSERT INTO public.citizen_request (survey_number, request_type, citizen_name, contact, message)
  VALUES (nullif(btrim(p_survey),''), coalesce(nullif(btrim(p_type),''),'correction'),
          btrim(p_name), nullif(btrim(p_contact),''), btrim(p_message))
  RETURNING ticket INTO t;
  RETURN t;
END;
$$;

CREATE OR REPLACE FUNCTION public.citizen_track_request(p_ticket text)
RETURNS TABLE (
  ticket text,
  survey_number text,
  request_type text,
  status text,
  officer_note text,
  message text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.ticket, c.survey_number, c.request_type, c.status, c.officer_note,
         c.message, c.created_at, c.updated_at
  FROM public.citizen_request c
  WHERE upper(btrim(p_ticket)) = c.ticket
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.citizen_parcels_at_point(double precision, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_search_records(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_submit_request(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_track_request(text) TO anon, authenticated;
