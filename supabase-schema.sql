-- ==================== Buildora 数据库建表脚本 ====================
-- 在 Supabase Dashboard → SQL Editor 中运行此脚本

-- 创建 clients 表
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  plan TEXT DEFAULT 'Starter',
  status TEXT DEFAULT 'active',
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 products 表
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  billing TEXT DEFAULT 'monthly',
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 projects 表
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  status TEXT DEFAULT 'draft',
  visits TEXT DEFAULT '0',
  thumbnail TEXT DEFAULT '#0D9488',
  icon TEXT DEFAULT '🚀',
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 activities 表
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT DEFAULT 'primary',
  text TEXT NOT NULL,
  time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 启用行级安全 (RLS) ====================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户进行所有操作（演示用，生产环境请收紧权限）
CREATE POLICY "Allow all on clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on activities" ON activities FOR ALL USING (true) WITH CHECK (true);

-- ==================== 插入种子数据 ====================

-- 客户数据
INSERT INTO clients (name, email, phone, company, plan, status, website) VALUES
  ('Acme Corp', 'contact@acme.com', '+86 138-0013-8000', 'Acme 科技有限公司', 'Pro', 'active', 'acme.buildora.io'),
  ('TechFlow', 'hello@techflow.io', '+86 139-0013-9000', 'TechFlow 数字科技', 'Starter', 'active', 'techflow.buildora.io'),
  ('Global Trade Co', 'info@globaltrade.com', '+1 415-555-0199', 'Global Trade Co.', 'Enterprise', 'active', 'globaltrade.buildora.io'),
  ('小明烘焙坊', 'xm@bakery.cn', '+86 155-1234-5678', '小明烘焙坊', 'Starter', 'inactive', 'xiaoming.buildora.io');

-- 产品数据
INSERT INTO products (name, price, billing, description, status) VALUES
  ('基础建站套餐', 29, 'monthly', '适合个人和小型企业，包含 1 个网站、5GB 存储空间。', 'active'),
  ('专业版套餐', 79, 'monthly', '适合成长型企业，包含 5 个网站、50GB 存储、自定义域名。', 'active'),
  ('企业版套餐', 199, 'monthly', '适合大型企业，无限网站、500GB 存储、白标功能、优先支持。', 'active'),
  ('AI 内容生成', 19, 'monthly', 'AI 自动生成网站文案、博客文章和产品描述。', 'active'),
  ('SEO 优化服务', 49, 'monthly', '专业 SEO 优化，提升搜索引擎排名。', 'inactive');

-- 项目数据
INSERT INTO projects (name, domain, status, visits, thumbnail, icon, client_id)
SELECT '企业官网', 'company.buildora.io', 'published', '12.4K', '#0D9488', '🏢', id FROM clients WHERE name = 'Acme Corp'
UNION ALL
SELECT 'SaaS 落地页', 'saas.buildora.io', 'published', '15.8K', '#3B82F6', '🚀', id FROM clients WHERE name = 'Acme Corp'
UNION ALL
SELECT '电商商城', 'shop.buildora.io', 'published', '8.7K', '#EC4899', '🛒', id FROM clients WHERE name = 'Global Trade Co'
UNION ALL
SELECT '个人博客', 'blog.buildora.io', 'draft', '3.2K', '#F59E0B', '✍️', id FROM clients WHERE name = 'TechFlow'
UNION ALL
SELECT '产品展示', 'product.buildora.io', 'draft', '2.1K', '#8B5CF6', '📱', id FROM clients WHERE name = 'TechFlow'
UNION ALL
SELECT '活动报名页', 'event.buildora.io', 'published', '5.6K', '#10B981', '📅', id FROM clients WHERE name = '小明烘焙坊';

-- 活动数据
INSERT INTO activities (type, text, time) VALUES
  ('success', '客户 "Acme Corp" 网站已发布', '2 小时前'),
  ('primary', 'AI 正在生成 "产品展示页"', '5 分钟前'),
  ('warning', '支付网关需要配置', '1 天前');

-- ==================== 完成 ====================
