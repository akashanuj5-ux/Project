
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('ADMIN','REQUESTER','FLOOR_MANAGER','PPC_REVIEWER','VIEWER');
CREATE TYPE public.review_status AS ENUM ('PENDING','APPROVED','REJECTED','NA');
CREATE TYPE public.sync_status AS ENUM ('NOT_SYNCED','SYNCED','FAILED');

-- UPDATED_AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- MASTER ROUTING
CREATE TABLE public.master_routing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item TEXT NOT NULL,
  op_code TEXT,
  op_desc TEXT,
  dept_code TEXT,
  dept_desc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mr_item ON public.master_routing (upper(item) text_pattern_ops);
CREATE INDEX idx_mr_op_code ON public.master_routing (upper(op_code) text_pattern_ops);
CREATE INDEX idx_mr_op_desc ON public.master_routing (upper(op_desc) text_pattern_ops);
CREATE INDEX idx_mr_dept_code ON public.master_routing (upper(dept_code) text_pattern_ops);
CREATE INDEX idx_mr_dept_desc ON public.master_routing (upper(dept_desc) text_pattern_ops);
CREATE TRIGGER trg_mr_updated BEFORE UPDATE ON public.master_routing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'ADMIN');
$$;

-- new user -> profile (+ ADMIN for the very first account, REQUESTER after)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''),'@',1)))
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'ADMIN'::public.app_role ELSE COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'REQUESTER'::public.app_role) END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FORM FIELDS
CREATE TABLE public.form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options TEXT[] NOT NULL DEFAULT '{}',
  required BOOLEAN NOT NULL DEFAULT false,
  visible BOOLEAN NOT NULL DEFAULT true,
  is_core BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ff_updated BEFORE UPDATE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DEVIATIONS
CREATE SEQUENCE public.deviation_ticket_seq START 1001;
CREATE TABLE public.deviations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_no TEXT NOT NULL UNIQUE,
  requester_id UUID,
  requester_name TEXT NOT NULL DEFAULT '',
  requester_email TEXT NOT NULL DEFAULT '',
  supervisor_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  last_seq_no INTEGER,
  last_operation_name TEXT,
  next_dept_code TEXT,
  next_dept_desc TEXT,
  next_seq_no INTEGER,
  next_op_code TEXT,
  proposed_operation TEXT NOT NULL,
  movement_date DATE,
  change_type TEXT NOT NULL DEFAULT 'Permanent',
  remarks TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  floor_status public.review_status NOT NULL DEFAULT 'PENDING',
  floor_reviewed_by UUID,
  floor_reviewer_name TEXT,
  floor_reviewed_at TIMESTAMPTZ,
  floor_remarks TEXT,
  ppc_status public.review_status NOT NULL DEFAULT 'PENDING',
  ppc_reviewed_by UUID,
  ppc_reviewer_name TEXT,
  ppc_reviewed_at TIMESTAMPTZ,
  ppc_remarks TEXT,
  eco_no TEXT,
  fusion_sync public.sync_status NOT NULL DEFAULT 'NOT_SYNCED',
  fusion_synced_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_dev_updated BEFORE UPDATE ON public.deviations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_ticket_no() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ticket_no IS NULL OR NEW.ticket_no = '' THEN
    NEW.ticket_no := 'DEV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.deviation_ticket_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_dev_ticket BEFORE INSERT ON public.deviations FOR EACH ROW EXECUTE FUNCTION public.set_ticket_no();

-- AUDIT TRAIL
CREATE TABLE public.audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deviation_id UUID REFERENCES public.deviations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_name TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  remarks TEXT,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_dev ON public.audit_trail (deviation_id, created_at DESC);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_routing TO authenticated;
GRANT ALL ON public.master_routing TO service_role;
GRANT INSERT ON public.master_routing TO anon; -- temporary seed grant, revoked after data load
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO authenticated;
GRANT ALL ON public.form_fields TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deviations TO authenticated;
GRANT ALL ON public.deviations TO service_role;
GRANT SELECT, INSERT ON public.audit_trail TO authenticated;
GRANT ALL ON public.audit_trail TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.deviation_ticket_seq TO authenticated, service_role;

-- RLS
ALTER TABLE public.master_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deviations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master read" ON public.master_routing FOR SELECT TO authenticated USING (true);
CREATE POLICY "master admin write" ON public.master_routing FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "master seed insert" ON public.master_routing FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles admin insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "form fields read" ON public.form_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "form fields admin write" ON public.form_fields FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "deviations read" ON public.deviations FOR SELECT TO authenticated USING (
  requester_id = auth.uid() OR public.is_admin()
  OR public.has_role(auth.uid(),'FLOOR_MANAGER') OR public.has_role(auth.uid(),'PPC_REVIEWER') OR public.has_role(auth.uid(),'VIEWER')
);
CREATE POLICY "deviations insert" ON public.deviations FOR INSERT TO authenticated WITH CHECK (
  requester_id = auth.uid() AND (public.has_role(auth.uid(),'REQUESTER') OR public.is_admin())
);
CREATE POLICY "deviations review update" ON public.deviations FOR UPDATE TO authenticated USING (
  public.is_admin() OR public.has_role(auth.uid(),'FLOOR_MANAGER') OR public.has_role(auth.uid(),'PPC_REVIEWER')
) WITH CHECK (
  public.is_admin() OR public.has_role(auth.uid(),'FLOOR_MANAGER') OR public.has_role(auth.uid(),'PPC_REVIEWER')
);
CREATE POLICY "deviations admin delete" ON public.deviations FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "audit read" ON public.audit_trail FOR SELECT TO authenticated USING (
  public.is_admin() OR public.has_role(auth.uid(),'FLOOR_MANAGER') OR public.has_role(auth.uid(),'PPC_REVIEWER') OR public.has_role(auth.uid(),'VIEWER')
  OR EXISTS (SELECT 1 FROM public.deviations d WHERE d.id = deviation_id AND d.requester_id = auth.uid())
);
CREATE POLICY "audit insert" ON public.audit_trail FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- CORE FORM FIELDS
INSERT INTO public.form_fields (field_key,label,field_type,required,visible,is_core,sort_order,options) VALUES
 ('supervisor_name','Supervisor Name (Prod. Transit Control)','text',true,true,true,1,'{}'),
 ('item_name','Item Name','item_lookup',true,true,true,2,'{}'),
 ('last_seq_no','Last Seq No.','number',true,true,true,3,'{}'),
 ('last_operation_name','Last Operation Name','op_desc_lookup',true,true,true,4,'{}'),
 ('next_dept_code','Next Department Code','dept_code_lookup',true,true,true,5,'{}'),
 ('next_dept_desc','Next Department Description','dept_desc_lookup',false,true,true,6,'{}'),
 ('next_seq_no','Next Seq No','number',true,true,true,7,'{}'),
 ('next_op_code','Next Operation Code','op_code_lookup',false,true,true,8,'{}'),
 ('proposed_operation','Proposed Operation (Need to Change in Routing)','op_desc_lookup',true,true,true,9,'{}'),
 ('movement_date','Movement Date','date',false,true,true,10,'{}'),
 ('change_type','Change Type','select',true,true,true,11,'{"Permanent","Temporary","Pilot / Trial","Emergency Rework"}'),
 ('remarks','Remarks','textarea',false,true,true,12,'{}');
