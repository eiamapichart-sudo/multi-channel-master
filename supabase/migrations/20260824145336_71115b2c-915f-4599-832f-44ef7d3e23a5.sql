-- enums
CREATE TYPE public.app_role AS ENUM ('admin','approver','editor');
CREATE TYPE public.brand_role AS ENUM ('owner','approver','editor');
CREATE TYPE public.platform AS ENUM ('facebook','instagram','tiktok','youtube','line');
CREATE TYPE public.post_status AS ENUM ('draft','pending','approved','publishing','published','failed');
CREATE TYPE public.target_status AS ENUM ('queued','publishing','published','failed');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'editor') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- brands
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT 'teal',
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- brand_members
CREATE TABLE public.brand_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.brand_role NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_members TO authenticated;
GRANT ALL ON public.brand_members TO service_role;
ALTER TABLE public.brand_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_brand_member(_brand_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.brand_members WHERE brand_id = _brand_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_brand_manager(_brand_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.brand_members WHERE brand_id = _brand_id AND user_id = _user_id AND role IN ('owner','approver'));
$$;

CREATE POLICY "brands_select_member" ON public.brands FOR SELECT TO authenticated USING (public.is_brand_member(id, auth.uid()));
CREATE POLICY "brands_insert_own" ON public.brands FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "brands_update_manager" ON public.brands FOR UPDATE TO authenticated USING (public.is_brand_manager(id, auth.uid())) WITH CHECK (public.is_brand_manager(id, auth.uid()));
CREATE POLICY "brands_delete_creator" ON public.brands FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "brand_members_select" ON public.brand_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_brand_member(brand_id, auth.uid()));
CREATE POLICY "brand_members_insert" ON public.brand_members FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR public.is_brand_manager(brand_id, auth.uid())
);
CREATE POLICY "brand_members_update" ON public.brand_members FOR UPDATE TO authenticated USING (public.is_brand_manager(brand_id, auth.uid())) WITH CHECK (public.is_brand_manager(brand_id, auth.uid()));
CREATE POLICY "brand_members_delete" ON public.brand_members FOR DELETE TO authenticated USING (public.is_brand_manager(brand_id, auth.uid()));

-- auto-own new brand
CREATE OR REPLACE FUNCTION public.handle_new_brand()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.brand_members (brand_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_brand_created AFTER INSERT ON public.brands FOR EACH ROW EXECUTE FUNCTION public.handle_new_brand();

-- channel_accounts
CREATE TABLE public.channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  account_name TEXT NOT NULL,
  connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, platform, account_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_accounts TO authenticated;
GRANT ALL ON public.channel_accounts TO service_role;
ALTER TABLE public.channel_accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER channel_accounts_updated_at BEFORE UPDATE ON public.channel_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "channels_member_all" ON public.channel_accounts FOR ALL TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()))
  WITH CHECK (public.is_brand_member(brand_id, auth.uid()));

-- posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  scheduled_at TIMESTAMPTZ,
  status public.post_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL DEFAULT auth.uid(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "posts_member_all" ON public.posts FOR ALL TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()))
  WITH CHECK (public.is_brand_member(brand_id, auth.uid()));
CREATE INDEX posts_brand_scheduled_idx ON public.posts (brand_id, scheduled_at);

-- post_targets
CREATE TABLE public.post_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  override_body TEXT,
  status public.target_status NOT NULL DEFAULT 'queued',
  error_message TEXT,
  external_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_targets TO authenticated;
GRANT ALL ON public.post_targets TO service_role;
ALTER TABLE public.post_targets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER post_targets_updated_at BEFORE UPDATE ON public.post_targets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "post_targets_member_all" ON public.post_targets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND public.is_brand_member(p.brand_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND public.is_brand_member(p.brand_id, auth.uid())));