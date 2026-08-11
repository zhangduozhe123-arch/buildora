-- ============================================================
--  Buildora V2 — 数据库迁移脚本
--  对齐 Readdy 后端架构，在 Supabase BaaS 上复刻核心表结构
--  运行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================================

-- ============================================================
--  1. 用户扩展信息（profiles）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  provider      TEXT DEFAULT 'email',          -- email | google
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 自动为新注册用户创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, provider, metadata)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'provider', 'email'),
    NEW.raw_user_meta_data
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
--  2. 订阅与积分
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',   -- free | starter | pro | business
  status      TEXT NOT NULL DEFAULT 'active', -- active | cancelled | past_due
  credits     INT NOT NULL DEFAULT 10,        -- 剩余 AI 积分
  features    JSONB DEFAULT '{}'::jsonb,      -- 套餐功能权限位
  started_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 自动给新用户建免费套餐
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, credits, features)
  VALUES (
    NEW.id,
    'free',
    'active',
    10,
    '{"sites":1,"pages_per_site":3,"templates":true,"export":"html","custom_domain":false,"ai_messages":3,"collaborators":1}'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();

-- 积分消耗日志（审计）
CREATE TABLE IF NOT EXISTS public.credit_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,                  -- ai_generate | ai_modify | export | publish
  credits     INT NOT NULL,                   -- 消耗数量（负值）
  balance     INT NOT NULL,                   -- 变更后余额
  site_id     UUID,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_credit_logs_user ON public.credit_logs (user_id, created_at DESC);

-- ============================================================
--  3. 站点
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sites (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT '未命名站点',
  description   TEXT,
  template_id   TEXT,
  language      TEXT DEFAULT 'zh',
  status        TEXT DEFAULT 'draft',         -- draft | published | archived

  -- 站点内容（HTML + CSS 源码）
  html          TEXT DEFAULT '',
  css           TEXT DEFAULT '',

  -- 站点设置（对齐 Readdy 站点级设置）
  settings      JSONB DEFAULT '{}'::jsonb,

  -- 部署信息
  published_url TEXT,
  custom_domain TEXT,
  last_published_at TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sites_user ON public.sites (user_id, updated_at DESC);

-- ============================================================
--  4. 页面（多页站点）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id     UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '未命名页面',
  slug        TEXT NOT NULL,
  html        TEXT DEFAULT '',
  css         TEXT DEFAULT '',
  sort_order  INT DEFAULT 0,
  is_home     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE (site_id, slug)
);

CREATE INDEX idx_pages_site ON public.pages (site_id, sort_order);

-- ============================================================
--  5. AI 对话历史（对齐 Readdy AI 对话上下文）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id     UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  messages    JSONB DEFAULT '[]'::jsonb,      -- [{role, content, timestamp}]
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_conv_site ON public.ai_conversations (site_id);

-- ============================================================
--  6. 部署记录
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deployments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  version       INT NOT NULL DEFAULT 1,
  snapshot_html TEXT,                         -- 发布时的 HTML 快照
  snapshot_css  TEXT,                         -- 发布时的 CSS 快照
  published_url TEXT,
  deployed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deployments_site ON public.deployments (site_id, version DESC);

-- ============================================================
--  7. 协作者
-- ============================================================
CREATE TABLE IF NOT EXISTS public.collaborators (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id     UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  owner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT DEFAULT 'editor',          -- editor | viewer | admin
  status      TEXT DEFAULT 'pending',         -- pending | accepted | rejected
  invited_at  TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,

  UNIQUE (site_id, email)
);

-- ============================================================
--  8. 模板库（对齐 Readdy 17 分类模板体系）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.templates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL,                  -- business | restaurant | portfolio | blog | ...
  tags        TEXT[] DEFAULT '{}',
  thumbnail   TEXT,
  html        TEXT NOT NULL,
  css         TEXT DEFAULT '',
  is_premium  BOOLEAN DEFAULT false,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_templates_category ON public.templates (category);

-- ============================================================
--  9. RLS（行级安全策略）
-- ============================================================
-- 用户只能读取自己的数据
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators  ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- subscriptions
CREATE POLICY "Users read own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- credit_logs
CREATE POLICY "Users read own credit logs" ON public.credit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- sites
CREATE POLICY "Users CRUD own sites" ON public.sites
  FOR ALL USING (auth.uid() = user_id);

-- pages
CREATE POLICY "Users CRUD pages of own sites" ON public.pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.sites WHERE id = pages.site_id AND user_id = auth.uid())
  );

-- ai_conversations
CREATE POLICY "Users CRUD own ai conversations" ON public.ai_conversations
  FOR ALL USING (auth.uid() = user_id);

-- deployments
CREATE POLICY "Users read own deployments" ON public.deployments
  FOR SELECT USING (auth.uid() = user_id);

-- collaborators
CREATE POLICY "Owners manage collaborators" ON public.collaborators
  FOR ALL USING (auth.uid() = owner_id);

-- templates（公开读取）
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates are public read" ON public.templates
  FOR SELECT USING (true);

-- ============================================================
-- 10. 插入默认模板数据（对齐 Readdy 17 分类）
-- ============================================================
INSERT INTO public.templates (name, description, category, tags, html, css) VALUES
('极简企业站', '适合中小企业官网的简洁模板', 'business', '{企业,简约,中文}',
 '<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>企业官网</title></head><body><header><h1>公司名称</h1><nav><a href="#">首页</a><a href="#">关于</a><a href="#">服务</a><a href="#">联系</a></nav></header><main><section class="hero"><h2>让业务更简单</h2><p>专注为企业提供数字化解决方案</p></section></main><footer><p>© 2024 公司名称. All Rights Reserved.</p></footer></body></html>',
 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",sans-serif;margin:0;color:#333}header{display:flex;justify-content:space-between;align-items:center;padding:1rem 5%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08)}nav a{margin-left:24px;text-decoration:none;color:#555}.hero{text-align:center;padding:120px 20px;background:#f5f7fa}.hero h2{font-size:36px;margin-bottom:12px}footer{text-align:center;padding:24px;background:#f5f7fa;font-size:14px;color:#999}'),

('餐饮美食', '适合餐厅、咖啡店、烘焙坊的展示型模板', 'restaurant', '{餐饮,菜单,食品}',
 '<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>餐厅官网</title></head><body><header><h1>品味轩</h1></header><main><section class="menu"><h2>今日推荐</h2><div class="grid"><div class="card"><h3>招牌红烧肉</h3><p>精选五花肉，慢炖四小时</p></div></div></section></main><footer><p>© 2024 品味轩</p></footer></body></html>',
 'body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;margin:0}.menu{padding:60px 5%}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}.card{background:#fff;padding:24px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.06)}'),

('个人作品集', '适合设计师、摄影师展示作品的极简模板', 'portfolio', '{作品集,创意,设计师}',
 '<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>作品集</title></head><body><header><h1>我的作品</h1></header><main><section class="gallery"><div class="item"><img src="#" alt="项目封面"><h3>项目名称</h3></div></section></main></body></html>',
 'body{font-family:"Helvetica Neue",sans-serif;margin:0;background:#fafafa}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:40px 5%}.item{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.04)}')
ON CONFLICT DO NOTHING;
