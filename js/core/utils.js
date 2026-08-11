/**
 * Buildora V2 — 工具函数库
 * 统一 {code, data, meta} 响应格式，对齐 Readdy API 风格
 */

const Utils = {
  // ============================================================
  //  API 响应封装（Readdy 风格 {code, data, meta}）
  // ============================================================

  /** 成功响应 */
  success(data, meta = {}) {
    return { code: 200, data, meta: { timestamp: Date.now(), ...meta } };
  },

  /** 创建成功 */
  created(data, meta = {}) {
    return { code: 201, data, meta: { timestamp: Date.now(), ...meta } };
  },

  /** 业务错误 */
  error(code = 400, message = '请求错误', meta = {}) {
    return { code, data: null, meta: { message, timestamp: Date.now(), ...meta } };
  },

  /** 鉴权错误 */
  unauthorized(message = '未登录，请先登录') {
    return { code: 401, data: null, meta: { message, timestamp: Date.now() } };
  },

  /** 权限不足 */
  forbidden(message = '权限不足，请升级套餐') {
    return { code: 403, data: null, meta: { message, timestamp: Date.now() } };
  },

  /** 资源不存在 */
  notFound(resource = '资源') {
    return { code: 404, data: null, meta: { message: `${resource}不存在`, timestamp: Date.now() } };
  },

  /** 服务器内部错误 */
  serverError(err) {
    const message = err?.message || '服务器内部错误';
    console.error('[Buildora] Server Error:', err);
    return { code: 500, data: null, meta: { message, timestamp: Date.now() } };
  },

  // ============================================================
  //  HTTP 请求封装（Supabase JS Client + 统一错误处理）
  // ============================================================

  /**
   * 通用 fetch 包装，带超时 & 重试
   */
  async fetch(url, options = {}, retries = CONFIG.api.retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.api.timeout);

    const defaultHeaders = {
      'Content-Type': 'application/json',
      'apikey': CONFIG.supabase.anonKey,
      'Authorization': `Bearer ${CONFIG.supabase.anonKey}`,
    };

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const res = await fetch(`${CONFIG.api.baseURL}${url}`, {
          ...options,
          headers: { ...defaultHeaders, ...options.headers },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw { status: res.status, body };
        }

        return await res.json();
      } catch (err) {
        clearTimeout(timeout);
        if (attempt > retries) {
          if (err.name === 'AbortError') return Utils.error(408, '请求超时');
          return Utils.error(err.status || 500, err.body?.message || '请求失败');
        }
        await Utils.sleep(1000 * attempt); // 递增退避
      }
    }
  },

  // ============================================================
  //  通用工具
  // ============================================================

  /** 延时 */
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  /** 防抖 */
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /** 节流 */
  throttle(fn, limit = 300) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /** 生成唯一 ID */
  uid(prefix = 'el') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  },

  /** 深度克隆 */
  clone(obj) {
    return structuredClone(obj);
  },

  /** 从 localStorage 安全读取 JSON */
  getStorage(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  /** 安全写入 localStorage */
  setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  /** 格式化文件大小 */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  },

  /** 格式化时间 */
  formatDate(ts, fmt = 'YYYY-MM-DD HH:mm') {
    const d = new Date(ts);
    const map = {
      YYYY: d.getFullYear(),
      MM: String(d.getMonth() + 1).padStart(2, '0'),
      DD: String(d.getDate()).padStart(2, '0'),
      HH: String(d.getHours()).padStart(2, '0'),
      mm: String(d.getMinutes()).padStart(2, '0'),
      ss: String(d.getSeconds()).padStart(2, '0'),
    };
    return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, k => map[k]);
  },

  /** 安全转义 HTML */
  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /** 判断是否为移动端 */
  isMobile() {
    return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
  },

  /** 判断套餐功能是否可用 */
  canUse(feature, plan) {
    const planCfg = CONFIG.plans[plan] || CONFIG.plans.free;
    const val = planCfg[feature];
    if (val === 'all') return true;
    if (Array.isArray(val)) return val.includes(feature);
    if (typeof val === 'number') return val > 0 || val === -1;
    return !!val;
  },
};
