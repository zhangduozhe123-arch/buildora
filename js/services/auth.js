/**
 * Buildora V2 — 认证服务
 * 对齐 Readdy 的 Clerk 认证体系，基于 Supabase Auth 实现
 */

const AuthService = {
  // 当前用户
  _user: null,
  _session: null,

  // ============================================================
  //  初始化 & 监听
  // ============================================================

  /** 初始化认证（挂载状态变化监听） */
  async init() {
    const { data } = await CONFIG.supabase.client.auth.getSession();
    this._session = data?.session || null;
    this._user = data?.session?.user || null;

    CONFIG.supabase.client.auth.onAuthStateChange((event, session) => {
      this._session = session;
      this._user = session?.user || null;

      // 触发全局事件，供 UI 层响应
      window.dispatchEvent(new CustomEvent('buildora:authChange', {
        detail: { event, user: this._user, session: this._session }
      }));

      if (event === 'SIGNED_OUT') {
        this._onSignOut();
      }
    });

    return this._user;
  },

  // ============================================================
  //  账密注册 & 登录（对齐 Readdy email + Google OAuth）
  // ============================================================

  /** 邮箱注册 */
  async signUp(email, password, metadata = {}) {
    const res = await CONFIG.supabase.client.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });

    if (res.error) return Utils.error(400, res.error.message);

    // 注册成功 → 自动创建 profile 行
    if (res.data?.user) {
      this._user = res.data.user;
      this._session = res.data.session;
      await this._createProfile(res.data.user);
      this._syncToClerkFormat(); // 模拟 Clerk 风格用户对象
    }

    return Utils.success({ user: this._getPublicUser() });
  },

  /** 邮箱登录 */
  async signIn(email, password) {
    const res = await CONFIG.supabase.client.auth.signInWithPassword({ email, password });
    if (res.error) return Utils.error(400, res.error.message);

    this._user = res.data.user;
    this._session = res.data.session;
    await this._ensureProfile();

    return Utils.success({ user: this._getPublicUser() });
  },

  /** Google OAuth 登录（对齐 Readdy 的社交登录） */
  async signInWithGoogle() {
    const res = await CONFIG.supabase.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' }
    });
    if (res.error) return Utils.error(400, res.error.message);
  },

  // ============================================================
  //  会话管理
  // ============================================================

  /** 获取当前登录用户 */
  getUser() {
    return this._user ? this._getPublicUser() : null;
  },

  /** 是否已登录 */
  isAuthenticated() {
    return !!this._session && !!this._user;
  },

  /** 登出 */
  async signOut() {
    const res = await CONFIG.supabase.client.auth.signOut();
    if (res.error) return Utils.error(400, res.error.message);

    this._user = null;
    this._session = null;
    return Utils.success(null);
  },

  /** 刷新会话 */
  async refreshSession() {
    const { data } = await CONFIG.supabase.client.auth.refreshSession();
    if (data?.session) {
      this._session = data.session;
      this._user = data.session.user;
    }
    return this._user;
  },

  // ============================================================
  //  内部方法
  // ============================================================

  /** 创建用户 profile */
  async _createProfile(user) {
    const { error } = await CONFIG.supabase.client
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        plan: 'free',
        credits_used: 0,
        sites_count: 0,
        created_at: new Date().toISOString(),
      });

    if (error) console.error('[Auth] Profile creation failed:', error);
  },

  /** 确保 profile 存在 */
  async _ensureProfile() {
    if (!this._user) return;
    const { data } = await CONFIG.supabase.client
      .from('profiles')
      .select('id')
      .eq('id', this._user.id)
      .single();

    if (!data) await this._createProfile(this._user);
  },

  /** 同步为 Clerk 风格用户对象（前端兼容层） */
  _syncToClerkFormat() {
    // Readdy 用 Clerk，前端通过 user 对象访问
    // 这里做适配层，无需改 UI 代码
    window.__buildoraUser = this._getPublicUser();
  },

  /** 返回脱敏后的公开用户信息 */
  _getPublicUser() {
    if (!this._user) return null;
    return {
      id: this._user.id,
      email: this._user.email,
      email_confirmed_at: this._user.email_confirmed_at,
      created_at: this._user.created_at,
      last_sign_in_at: this._user.last_sign_in_at,
      app_metadata: this._user.app_metadata,
      user_metadata: this._user.user_metadata,
    };
  },

  /** 登出后清理 */
  _onSignOut() {
    delete window.__buildoraUser;
    // 跳转到首页
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  },
};
