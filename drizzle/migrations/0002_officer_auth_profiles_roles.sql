-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'officer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  designation text,
  district text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles readable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + default officer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, designation, district, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data ->> 'designation', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'district', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'officer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tighten demo policies: signed-in officers only
DROP POLICY IF EXISTS "demo open land_record" ON public.land_record;
DROP POLICY IF EXISTS "demo open documents" ON public.documents;
DROP POLICY IF EXISTS "demo open record_history" ON public.record_history;
DROP POLICY IF EXISTS "demo open validation_flag" ON public.validation_flag;
DROP POLICY IF EXISTS "demo open audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "demo open correction_feedback" ON public.correction_feedback;

CREATE POLICY "officers manage land_record" ON public.land_record FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "officers manage documents" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "officers manage record_history" ON public.record_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "officers manage validation_flag" ON public.validation_flag FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "officers manage audit_log" ON public.audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "officers manage correction_feedback" ON public.correction_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON public.land_record, public.documents, public.record_history, public.validation_flag, public.audit_log, public.correction_feedback FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.land_record, public.documents, public.record_history, public.validation_flag, public.audit_log, public.correction_feedback TO authenticated;

-- Realtime for live updates
ALTER TABLE public.land_record REPLICA IDENTITY FULL;
ALTER TABLE public.record_history REPLICA IDENTITY FULL;
ALTER TABLE public.validation_flag REPLICA IDENTITY FULL;
ALTER TABLE public.audit_log REPLICA IDENTITY FULL;
ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.land_record;
ALTER PUBLICATION supabase_realtime ADD TABLE public.record_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.validation_flag;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
