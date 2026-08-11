/**
 * Buildora V2 — 部署与发布服务
 * 对齐 Readdy 的 publish/deploy 流程：
 *   草稿 → 预览 → 一键发布 → 自动生成 CDN 部署 URL
 */

const DeployService = {
  // ============================================================
  //  发布流程（对齐 Readdy 的 publishSite 端点）
  // ============================================================

  /** 发布站点：将草稿生成静态 HTML 并部署到 Supabase Storage + Edge */
  async publish(siteId) {
    const { code, data, meta } = await ApiService.publishSite(siteId);
    return { code, data, meta };
  },

  /** 获取所有已发布站点 */
  async getPublishedSites() {
    const user = AuthService.getUser();
    if (!user) return Utils.error(401, '请先登录');

    const { data, error } = await CONFIG.supabase.client
      .from('deployments')
      .select('*')
      .eq('user_id', user.id)
      .order('deployed_at', { ascending: false });

    if (error) return Utils.error(400, error.message);
    return Utils.success(data);
  },

  // ============================================================
  //  导出（对齐 Readdy 的 exportSite 端点）
  // ============================================================

  /** 导出站点为 zip */
  async exportZip(siteId) {
    return await ApiService.exportSite(siteId, 'zip');
  },

  // ============================================================
  //  自定义域名（对齐 Readdy 的 customDomain 能力）
  // ============================================================

  /** 绑定自定义域名 */
  async setCustomDomain(siteId, domain) {
    const user = AuthService.getUser();
    if (!user) return Utils.error(401, '请先登录');

    const can = await SubscriptionService.canPerform('custom_domain');
    if (!can) return Utils.error(402, '当前套餐不支持自定义域名，请升级到 Pro 或以上套餐');

    const { data, error } = await CONFIG.supabase.client
      .from('sites')
      .update({
        custom_domain: domain,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .eq('user_id', user.id)
      .select('custom_domain')
      .single();

    if (error) return Utils.error(400, error.message);
    return Utils.success(data);
  },

  /** 移除自定义域名 */
  async removeCustomDomain(siteId) {
    const user = AuthService.getUser();
    if (!user) return Utils.error(401, '请先登录');

    const { error } = await CONFIG.supabase.client
      .from('sites')
      .update({
        custom_domain: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .eq('user_id', user.id);

    if (error) return Utils.error(400, error.message);
    return Utils.success(null);
  },

  // ============================================================
  //  部署历史
  // ============================================================

  /** 获取某站点的部署历史 */
  async getDeployHistory(siteId, page = 1, pageSize = 10) {
    const user = AuthService.getUser();
    if (!user) return Utils.error(401, '请先登录');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await CONFIG.supabase.client
      .from('deployments')
      .select('*')
      .eq('site_id', siteId)
      .eq('user_id', user.id)
      .order('deployed_at', { ascending: false })
      .range(from, to);

    if (error) return Utils.error(400, error.message);
    return Utils.success(data);
  },

  /** 回滚到指定版本 */
  async rollback(deploymentId) {
    const user = AuthService.getUser();
    if (!user) return Utils.error(401, '请先登录');

    // 查找部署记录
    const { data: dep } = await CONFIG.supabase.client
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .eq('user_id', user.id)
      .single();

    if (!dep) return Utils.error(404, '部署记录不存在');

    // 恢复草稿内容
    const { error } = await CONFIG.supabase.client
      .from('sites')
      .update({
        html: dep.snapshot_html,
        css: dep.snapshot_css,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dep.site_id)
      .eq('user_id', user.id);

    if (error) return Utils.error(400, error.message);
    return Utils.success({ rolled_back_to: deploymentId });
  },

  // ============================================================
  //  协作（对齐 Readdy 的 team/collaboration 概念）
  // ============================================================

  /** 邀请协作者 */
  async inviteCollaborator(siteId, email, role = 'editor') {
    const user = AuthService.getUser();
    if (!user) return Utils.error(401, '请先登录');

    const { error } = await CONFIG.supabase.client
      .from('collaborators')
      .insert({
        site_id: siteId,
        owner_id: user.id,
        email,
        role,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

    if (error) {
      if (error.code === '23505') return Utils.error(409, '该用户已被邀请');
      return Utils.error(400, error.message);
    }

    return Utils.success(null, { invited: email, role });
  },
};
