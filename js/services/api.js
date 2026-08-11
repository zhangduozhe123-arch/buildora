/**
 * Buildora V2 — API 服务层
 * 对齐 Readdy 16 个 API 端点结构，统一 {code, data, meta} 响应格式
 */

const ApiService = {
  // ============================================================
  //  站点 CRUD（Readdy: /api/v1/sites）
  // ============================================================

  /** 获取站点列表 */
  async getSites() {
    const { data, error } = await CONFIG.supabase.client
      .from('sites')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) return Utils.error(400, error.message);
    return Utils.success(data, { total: data.length });
  },

  /** 获取单个站点 */
  async getSite(siteId) {
    const { data, error } = await CONFIG.supabase.client
      .from('sites')
      .select('*, pages(*)')
      .eq('id', siteId)
      .single();

    if (error) return Utils.error(404, 'Site not found');
    return Utils.success(data);
  },

  /** 创建站点 */
  async createSite(params) {
    // 套餐权限检查（对齐 Readdy 订阅限制）
    const plan = await SubscriptionService.getPlan();
    const { count } = await CONFIG.supabase.client
      .from('sites')
      .select('id', { count: 'exact', head: true });

    if (count >= CONFIG.subscription.plans[plan].maxSites) {
      return Utils.error(403, '站点数量已达套餐上限，请升级');
    }

    const { data, error } = await CONFIG.supabase.client
      .from('sites')
      .insert({
        name: params.name || '未命名站点',
        template: params.template || 'blank',
        html: params.html || '',
        css: params.css || '',
        custom_domain: params.custom_domain || null,
        language: params.language || 'zh',
        published: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return Utils.error(400, error.message);

    // 记录积分消耗
    await this._consumeCredits('site_create');
    return Utils.success(data);
  },

  /** 更新站点 */
  async updateSite(siteId, updates) {
    const { data, error } = await CONFIG.supabase.client
      .from('sites')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', siteId)
      .select()
      .single();

    if (error) return Utils.error(400, error.message);
    return Utils.success(data);
  },

  /** 删除站点 */
  async deleteSite(siteId) {
    await CONFIG.supabase.client.from('pages').delete().eq('site_id', siteId);
    const { error } = await CONFIG.supabase.client
      .from('sites')
      .delete()
      .eq('id', siteId);

    if (error) return Utils.error(400, error.message);
    return Utils.success(null);
  },

  // ============================================================
  //  页面 CRUD（Readdy: /api/v1/sites/:id/pages）
  // ============================================================

  /** 获取站点下所有页面 */
  async getPages(siteId) {
    const { data, error } = await CONFIG.supabase.client
      .from('pages')
      .select('*')
      .eq('site_id', siteId)
      .order('sort_order', { ascending: true });

    if (error) return Utils.error(400, error.message);
    return Utils.success(data, { total: data.length });
  },

  /** 创建页面 */
  async createPage(siteId, params) {
    const { data, error } = await CONFIG.supabase.client
      .from('pages')
      .insert({
        site_id: siteId,
        name: params.name || '新页面',
        slug: params.slug || Utils.slugify(params.name || 'new-page'),
        html: params.html || '',
        css: params.css || '',
        sort_order: params.sort_order || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return Utils.error(400, error.message);
    return Utils.success(data);
  },

  /** 更新页面 */
  async updatePage(pageId, updates) {
    const { data, error } = await CONFIG.supabase.client
      .from('pages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', pageId)
      .select()
      .single();

    if (error) return Utils.error(400, error.message);
    return Utils.success(data);
  },

  /** 删除页面 */
  async deletePage(pageId) {
    const { error } = await CONFIG.supabase.client
      .from('pages')
      .delete()
      .eq('id', pageId);

    if (error) return Utils.error(400, error.message);
    return Utils.success(null);
  },

  // ============================================================
  //  AI 生成（Readdy: /api/v1/ai/generate & /api/v1/ai/modify）
  // ============================================================

  /** AI 生成站点 */
  async aiGenerate(prompt, template = 'modern') {
    // 套餐权限检查
    const creditsLeft = await SubscriptionService.getCreditsLeft();
    if (creditsLeft < CONFIG.ai.generationCost) {
      return Utils.error(403, '积分不足，请升级套餐');
    }

    // 调用 Supabase Edge Function 或外部 AI API
    const res = await Utils.apiFetch(CONFIG.api.endpoints.AI_GENERATE, {
      method: 'POST',
      body: JSON.stringify({ prompt, template, lang: 'zh' }),
    });

    if (res.code !== 0) return res;

    // 自动保存生成结果到站点
    const site = await this.createSite({
      name: prompt.substring(0, 50),
      template,
      html: res.data.html,
      css: res.data.css,
    });

    await this._consumeCredits('ai_generate');
    return Utils.success(site.data, { prompt, template });
  },

  /** AI 修改站点内容 */
  async aiModify(siteId, instruction) {
    const creditsLeft = await SubscriptionService.getCreditsLeft();
    if (creditsLeft < CONFIG.ai.modificationCost) {
      return Utils.error(403, '积分不足');
    }

    const site = await this.getSite(siteId);
    if (site.code !== 0) return site;

    const res = await Utils.apiFetch(CONFIG.api.endpoints.AI_MODIFY, {
      method: 'POST',
      body: JSON.stringify({
        instruction,
        current_html: site.data.html,
        current_css: site.data.css,
      }),
    });

    if (res.code !== 0) return res;

    await this.updateSite(siteId, {
      html: res.data.html,
      css: res.data.css,
    });

    await this._consumeCredits('ai_modify');
    return Utils.success(res.data);
  },

  // ============================================================
  //  发布 & 导出（Readdy: /api/v1/sites/:id/publish & export）
  // ============================================================

  /** 发布站点 */
  async publishSite(siteId) {
    const { data, error } = await CONFIG.supabase.client
      .from('sites')
      .update({
        published: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .select()
      .single();

    if (error) return Utils.error(400, error.message);
    return Utils.success({
      ...data,
      url: `${CONFIG.deployment.baseUrl}/${data.custom_domain || data.id}`,
    });
  },

  /** 导出站点 HTML */
  async exportSite(siteId) {
    const site = await this.getSite(siteId);
    if (site.code !== 0) return site;
    const pages = await this.getPages(siteId);

    const fullHTML = ApiService._buildExportHTML(site.data, pages.data);
    return Utils.success({
      html: fullHTML,
      filename: `${Utils.slugify(site.data.name)}.html`,
    });
  },

  // ============================================================
  //  模板（Readdy: /api/v1/templates）
  // ============================================================

  /** 获取模板列表（按行业分类） */
  async getTemplates(category = 'all') {
    const templates = CONFIG.templates.categories[category] ||
      Object.values(CONFIG.templates.categories).flat();

    return Utils.success(templates, {
      total: templates.length,
      categories: Object.keys(CONFIG.templates.categories),
    });
  },

  // ============================================================
  //  内部
  // ============================================================

  /** 积分消耗 */
  async _consumeCredits(action) {
    const cost = {
      ai_generate: CONFIG.ai.generationCost,
      ai_modify: CONFIG.ai.modificationCost,
      site_create: CONFIG.subscription.creditsPerSite,
    }[action] || 0;

    if (cost <= 0) return;

    const user = AuthService.getUser();
    if (!user) return;

    await CONFIG.supabase.client
      .from('profiles')
      .update({ credits_used: CONFIG.supabase.client.rpc('increment_credits', { amount: cost }) })
      .eq('id', user.id);
  },

  /** 构建导出 HTML */
  _buildExportHTML(site, pages) {
    const pagesHTML = (pages || [])
      .map(p => `<!-- Page: ${p.name} -->\n${p.html || ''}`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="${site.language || 'zh'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${site.name}</title>
  <style>${site.css || ''}</style>
</head>
<body>
  ${site.html || ''}
  ${pagesHTML}
</body>
</html>`;
  },
};
