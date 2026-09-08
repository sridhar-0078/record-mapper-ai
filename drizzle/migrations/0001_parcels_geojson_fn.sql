CREATE OR REPLACE FUNCTION public.parcels_geojson()
RETURNS TABLE (id UUID, survey_number TEXT, owner_name TEXT, record_status TEXT, area_acres NUMERIC, village TEXT, geojson TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT r.id, r.survey_number, r.owner_name, r.record_status, r.area_acres, r.village, ST_AsGeoJSON(r.geom)
  FROM public.land_record r
  WHERE r.geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.parcels_geojson() TO anon, authenticated;