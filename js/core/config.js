/**
 * Buildora V2 全局配置
 * 架构参考：Readdy.ai 模块化分层 + Supabase BaaS 后端
 */
const CONFIG = {
  // —— Supabase 连接（占位，部署时替换）——
  supabase: {
    url: 'YOUR_SUPABASE_PROJECT_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  },

  // —— API 端点（统一 {code, data, meta} 格式，对齐 Readdy 风格）——
  api: {
    baseURL: 'YOUR_SUPABASE_PROJECT_URL/rest/v1',
    endpoints: {
      // 站点 CRUD
      sites:            '/sites',
      siteById:         (id) => `/sites?id=eq.${id}`,
      sitePages:        (siteId) => `/pages?site_id=eq.${siteId}`,
      // 模板市场
      templates:        '/templates',
      templateById:     (id) => `/templates?id=eq.${id}`,
      templateByCategory:(cat) => `/templates?category=eq.${cat}`,
      // 用户 & 订阅
      userProfile:      '/profiles',
      subscription:     '/subscriptions',
      credits:          '/credits',
      // AI 生成
      aiGenerate:       '/rpc/ai_generate_site',
      aiModify:         '/rpc/ai_modify_section',
      // 存储
      upload:           '/storage/v1/object',
      assets:           (siteId) => `/assets?site_id=eq.${siteId}`,
    },
    // 请求超时 & 重试
    timeout: 15000,
    retries: 2,
  },

  // —— 订阅套餐（参照 Readdy Free / Starter / Pro / Enterprise）——
  plans: {
    free: {
      name: '免费版',
      sites: 3,
      credits: 100,
      templates: 'basic',
      exportFormats: ['html'],
      aiModels: ['basic'],
      storageMB: 50,
    },
    starter: {
      name: '入门版',
      price: 15,
      sites: 10,
      credits: 500,
      templates: 'all',
      exportFormats: ['html', 'zip', 'react'],
      aiModels: ['basic', 'advanced'],
      storageMB: 500,
    },
    pro: {
      name: '专业版',
      price: 39,
      sites: 50,
      credits: 2000,
      templates: 'all',
      exportFormats: ['html', 'zip', 'react', 'nextjs'],
      aiModels: ['basic', 'advanced', 'premium'],
      storageMB: 5000,
    },
    enterprise: {
      name: '企业版',
      price: 99,
      sites: -1,         // 无限
      credits: 10000,
      templates: 'all',
      exportFormats: ['all'],
      aiModels: ['all'],
      storageMB: 50000,
    },
  },

  // —— 模板分类（对齐 Readdy 17 行业分类体系）——
  templateCategories: [
    { id: 'business',    name: '商业服务', icon: 'briefcase',  tags: ['企业', 'B2B', '服务'] },
    { id: 'ecommerce',   name: '电商零售', icon: 'shopping-cart', tags: ['商店', '产品', '购物'] },
    { id: 'portfolio',   name: '作品展示', icon: 'palette',     tags: ['设计', '摄影', '创意'] },
    { id: 'blog',        name: '博客内容', icon: 'edit',        tags: ['写作', '新闻', '杂志'] },
    { id: 'restaurant',  name: '餐饮美食', icon: 'utensils',    tags: ['餐厅', '咖啡', '外卖'] },
    { id: 'education',   name: '教育培训', icon: 'book-open',   tags: ['学校', '课程', '在线'] },
    { id: 'health',      name: '健康医疗', icon: 'heart-pulse', tags: ['诊所', '健身', '心理'] },
    { id: 'realestate',  name: '房产物业', icon: 'building',    tags: ['中介', '楼盘', '租赁'] },
    { id: 'saas',        name: 'SaaS 软件', icon: 'cloud',      tags: ['工具', '订阅', '平台'] },
    { id: 'nonprofit',   name: '公益组织', icon: 'globe',       tags: ['慈善', 'NGO', '志愿'] },
    { id: 'entertainment', name: '文娱传媒', icon: 'film',      tags: ['影视', '音乐', '活动'] },
    { id: 'landing',     name: '营销落地', icon: 'flag',        tags: ['推广', '转化', '活动'] },
    { id: 'event',       name: '会议活动', icon: 'calendar',    tags: ['峰会', '婚礼', '聚会'] },
    { id: 'personal',    name: '个人主页', icon: 'user',        tags: ['简历', '名片', '社交'] },
    { id: 'startup',     name: '创业公司', icon: 'rocket',      tags: ['融资', '团队', '产品'] },
    { id: 'agency',      name: '设计机构', icon: 'layers',      tags: ['品牌', '广告', '营销'] },
    { id: 'gaming',      name: '游戏社区', icon: 'gamepad',     tags: ['电竞', '攻略', '公会'] },
  ],

  // —— AI 建站模型配置 ——
  ai: {
    provider: 'supabase-edge',    // 默认走 Supabase Edge Functions
    models: {
      basic:    { name: 'gpt-4o-mini',  maxTokens: 4096,  temperature: 0.7 },
      advanced: { name: 'gpt-4o',       maxTokens: 8192,  temperature: 0.5 },
      premium:  { name: 'claude-3.5-sonnet', maxTokens: 16384, temperature: 0.3 },
    },
    generation: {
      maxRetries: 2,
      timeout: 60000,
      promptTemplates: {
        website: '你是一个专业网站设计师。请根据以下需求生成完整的网站结构…',
        section: '你是一个 UI 组件专家。请为以下页面生成指定区块的 HTML…',
      },
    },
  },

  // —— 编辑器配置 ——
  editor: {
    canvas: { defaultWidth: 1440, minWidth: 320, maxWidth: 1920 },
    grid: { size: 8, snap: true },
    undo: { maxHistory: 50 },
    autoSave: { interval: 30000, enabled: true },
  },

  // —— 认证（Clerk 风格多 Provider）——
  auth: {
    providers: ['google', 'github', 'email', 'wechat'],
    session: { persistKey: 'buildora_session', tokenRefreshMargin: 300 }, // 5min 前刷新
    redirects: {
      afterLogin: '/dashboard',
      afterLogout: '/',
      unauthorized: '/login',
    },
  },
};

// 冻结防止运行时篡改
Object.freeze(CONFIG);
Object.freeze(CONFIG.api);
Object.freeze(CONFIG.api.endpoints);
Object.freeze(CONFIG.plans);
Object.freeze(CONFIG.templateCategories);
Object.freeze(CONFIG.ai);
Object.freeze(CONFIG.editor);
Object.freeze(CONFIG.auth);
