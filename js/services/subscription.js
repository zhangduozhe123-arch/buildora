/**
 * Buildora V2 — 订阅与积分服务
 * 对齐 Readdy 的订阅积分体系：免费/Starter/Pro/Enterprise 四级套餐
 */

const SubscriptionService = {
  _cache: null,

  // ============================================================
  //  套餐查询
  // ============================================================

  /** 获取当前用户套餐（带缓存） */
  async getPlan() {
    if (this._cache?.plan) return this._cache.plan;

    const user = AuthService.getUser();
    if (!user) return 'free';

    const { data } = await CONFIG.supabase.client
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    const plan = data?.plan || 'free';
    this._cache = { ...this._cache, plan };
    return plan;
  },

  /** 获取套餐详情 */
  async getPlanInfo() {
    const plan = await this.getPlan();
    return Utils.success(CONFIG.subscription.plans[plan], { plan });
  },

  /** 获取可用积分 */
  async getCreditsLeft() {
    const plan = await this.getPlan();
    const planInfo = CONFIG.subscription.plans[plan];

    const user = AuthService.getUser();
    if (!user) return planInfo.monthlyCredits;

    const { data } = await CONFIG.supabase.client
      .from('profiles')
      .select('credits_used')
      .eq('id', user.id)
      .single();

    const used = data?.credits_used || 0;
    return Math.max(0, planInfo.monthlyCredits - used);
  },

  /** 检查是否可执行某操作 */
  async canPerform(action) {
    const checks = {
      site_create: async () => {
        const plan = await this.getPlan();
        const { count } = await CONFIG.supabase.client
          .from('sites')
          .select('id', { count: 'exact', head: true });
        return count < CONFIG.subscription.plans[plan].maxSites;
      },
      api_call: async () => {
        const plan = await this.getPlan();
        return CONFIG.subscription.plans[plan].apiCalls > 0 || plan === 'enterprise';
      },
      custom_domain: async () => {
        const plan = await this.getPlan();
        return CONFIG.subscription.plans[plan].customDomain;
      },
    };

    const checkFn = checks[action];
    if (!checkFn) return true;
    return await checkFn();
  },

  // ============================================================
  //  套餐升级（跳转支付——对齐 Readdy 支付流程）
  // ============================================================

  /** 获取可升级套餐列表 */
  async getAvailablePlans() {
    const current = await this.getPlan();
    const tiers = ['free', 'starter', 'pro', 'enterprise'];
    const idx = tiers.indexOf(current);

    return tiers.slice(idx + 1).map(key => ({
      key,
      ...CONFIG.subscription.plans[key],
    }));
  },

  /** 发起升级 */
  async upgradePlan(targetPlan) {
    const user = AuthService.getUser();
    if (!user) return Utils.error(401, '请先登录');

    // 创建 Stripe/Paddle 支付会话（通过 Supabase Edge Function）
    const res = await Utils.apiFetch(CONFIG.api.endpoints.CREATE_CHECKOUT, {
      method: 'POST',
      body: JSON.stringify({ plan: targetPlan }),
    });

    if (res.code !== 0) return res;

    // 跳转到支付页面
    if (res.data.url) {
      window.location.href = res.data.url;
    }

    return Utils.success(null, { redirect: res.data.url });
  },

  // ============================================================
  //  积分操作
  // ============================================================

  /** 获取积分消耗记录（对齐 Readdy 的 credit 日志） */
  async getCreditHistory(page = 1, pageSize = 20) {
    const user = AuthService.getUser();
    if (!user) return Utils.error(401, '请先登录');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await CONFIG.supabase.client
      .from('credit_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return Utils.error(400, error.message);
    return Utils.success(data, { page, pageSize });
  },

  /** 记录积分消耗（内部） */
  async logCredits(action, amount) {
    const user = AuthService.getUser();
    if (!user) return;

    await CONFIG.supabase.client.from('credit_logs').insert({
      user_id: user.id,
      action,
      amount,
      created_at: new Date().toISOString(),
    });
  },

  /** 清除缓存（套餐变更后调用） */
  clearCache() {
    this._cache = null;
  },
};
