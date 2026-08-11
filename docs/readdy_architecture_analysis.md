# Readdy.ai 深度架构分析报告

> 分析日期：2026-08-12
> 目标 URL：https://readdy.ai/
> 分析账户：Duozhe Zhang (zhangduozhe123@gmail.com) | Free Plan
> 分析工具：agent-browser (standalone Chromium)

---

## 1. 技术栈总览

| 层级 | 技术 | 详情 |
|------|------|------|
| **前端框架** | Vue 3 + Composition API | `<script setup>` 语法，scoped style (`data-v-*`) |
| **构建工具** | Vite | modulepreload 链接 + content-hash 文件名 |
| **UI 组件** | 自研 (Radix Vue 风格) | AlertDialog / DropdownMenu / SelectGroup / DialogTrigger |
| **状态管理** | Pinia (推断) | Vue 3 生态标配，模块名含 `store` |
| **路由** | Vue Router | History API pushState |
| **CSS** | 自研设计系统 | 无 Tailwind；主题色 rgba(112, 87, 255, 1)，暗色模式 `.dark` |
| **后端 CDN** | AWS CloudFront | `via: ...cloudfront.net (CloudFront)` |
| **后端运行时** | Go (推断) | `goCanary: true` 配置项 |
| **数据库** | 自托管 DB | `selfHostDB: true` |
| **环境** | 美国生产环境 | `env: "prod-us"` |

---

## 2. 前端依赖清单

### 核心运行时库
| 库 | 用途 | 文件名 |
|-----|------|--------|
| Dexie | IndexedDB 封装 | dexie-DTDOAvqa.js |
| lodash | 工具函数 | lodash-Czf3lVKe.js |
| DOMPurify | XSS 过滤 | purify.es-D9RiKzGB.js |
| marked | Markdown 解析 | marked-CQz6xZ8n.js |
| JSZip | ZIP 压缩 | jszip-BGBfUMn9.js |
| xlsx | Excel 处理 | xlsx-DXo_40wG.js |
| image-compression | 图片压缩 | image-compression-BzWLnoYn.js |
| lucide-icons | SVG 图标 | lucide-icons-CNmSY7Dl.js |
| chart | 图表渲染 | chart-eMvXPBko.js |
| vue-draggable-plus | 拖拽功能 | vue-draggable-plus-Dp-G3x8I.js |

### 业务模块（部分）
| 模块 | 说明 |
|------|------|
| SkillManagerPanel | 技能管理面板 |
| subscription-treasure-chest | 订阅宝箱 |
| useScrollFetch | 无限滚动加载 |
| useDropzone | 文件拖放上传 |
| aiReadyTrackingContext | AI 就绪追踪 |
| useWhiteLabelUpgrade | 白标升级 |
| assetPreviewUrl | 资源预览 |
| import-products-successful | 产品导入 |
| FeedbackBanner | 反馈横幅 |

### 第三方集成
| 服务 | 用途 |
|------|------|
| **Clerk** | 用户认证（JWT Bearer Token） |
| **PostHog** | 用户行为分析 + 录屏 |
| **Google Analytics 4** | 流量分析 (G-FB0NP1MM86) |
| **Google Ads** | 广告追踪 (AW-17337021885) |
| **Facebook Pixel** | 社交广告 (1144403361112207) |
| **Swan** | 用户行为录制/回放 |
| **Rewardful** | 联盟营销 |
| **Beehiiv** | 邮件营销 |
| **Google Identity Services** | Google OAuth 登录 |

---

## 3. API 架构

### 3.1 基础信息
- **API 域名**：`https://readdy.ai/api/*`
- **CDN 域名**：`https://public.readdy.ai` (媒体资源)
- **静态资源**：`https://static.readdy.ai/static/*`
- **认证方式**：Bearer Token (JWT)，通过 Cookie `authorization` 传递
- **请求格式**：RESTful JSON

### 3.2 统一响应格式
```json
{
  "code": "OK" | "UnAuthorized" | "...",
  "data": { ... },
  "meta": {
    "time": 1786468998522,
    "request_id": "751dd610-da83-4c6a-8cd5-531145be2b95",
    "message": "",
    "detail": null
  }
}
```

### 3.3 API 端点清单

#### 账户与认证
| 端点 | 说明 |
|------|------|
| `GET /api/account/info` | 账户信息（用户、角色、实验组） |
| `GET /api/account/subscription` | 订阅状态与额度 |
| `GET /api/account/invitees/info` | 邀请人信息与积分 |
| `GET /api/account/media_share_record` | 媒体分享记录 |

#### 配置与功能开关
| 端点 | 说明 |
|------|------|
| `GET /api/public/toggles` | 全局功能开关 |
| `GET /api/conf` | 环境配置（CDN、环境名、用户桶） |

#### 项目与模板
| 端点 | 说明 |
|------|------|
| `GET /api/page_gen/project/list` | 项目列表 |
| `GET /api/public/v2/project/template/list` | 模板列表 (v2) |
| `GET /api/v2/project/template/interaction/list` | 模板交互记录 |
| `GET /api/v2/project/member/roles` | 项目成员角色 |

#### 客户与白标
| 端点 | 说明 |
|------|------|
| `GET /api/white_label/clients/list` | 白标客户列表 |
| `GET /api/user_client/list` | 用户客户列表 |

#### 其他
| 端点 | 说明 |
|------|------|
| `GET /api/build_form/status` | AI 建站构建状态 |
| `GET /api/msg/count` | 未读消息计数 |
| `GET /api/wpapi/wordpress-entry-access` | WordPress 入口权限 |

### 3.4 功能开关 (Feature Toggles)
| 开关 | 状态 | 说明 |
|------|------|------|
| freeCredit350Experiment | false | 350 免费积分实验 |
| mediaShare | **true** | 媒体分享 |
| paywallEditExperiment | **true** | 付费墙编辑实验 |
| projectOnboardingExperiment | false | 项目引导实验 |
| publishTipsExperiment | **true** | 发布提示实验 |
| referralRegisterGiveCredits | **true** | 推荐注册送积分 |
| scottsdaleAct | **true** | Scottsdale 活动 |
| yearlyOneTimeCreditExperiment | **true** | 年度一次性积分 |

---

## 4. 认证体系

### Clerk 集成
- Clerk ID: `readdy_3HfJyoFLwMo4pmqzfm87rVpugUY` (前缀 `readdy_` 表明自定义 Clerk 实例)
- Google OAuth 为主要登录方式
- JWT Token 存储在 Cookie `authorization` 和 LocalStorage `readdy_access_token`
- Token 结构: `{userId, email, clerkId, firstName, ...}`

### 存储键值
| 存储位置 | Key | 说明 |
|----------|-----|------|
| Cookie | `authorization` | Bearer JWT token |
| LocalStorage | `readdy_access_token` | JWT 完整 token |
| LocalStorage | `readdy_generate_count` | 已生成网站数 (1) |
| LocalStorage | `readdy_locale` | 语言设置 (en) |
| LocalStorage | `readdy_clear_time` | 清除时间戳 |
| LocalStorage | `readdy_official_site_action_id` | 操作追踪 ID |
| sessionStorage | `readdy_sessionId` | 会话 ID |

---

## 5. 订阅与积分系统

### 当前账户状态
| 项 | 值 |
|----|-----|
| 计划 | Free (v3) |
| 月度积分 | 250 credits |
| 已用积分 | 250 / 250 (已用完) |
| 活动积分 | 0 |
| 计费周期 | monthly |
| 额外站点 | 0 |

### 定价等级（从页面可知）
- Free: $0/mo (仅浏览，250 credits)
- Starter: $15/mo
- Pro: $24/mo
- Agency: $72/mo

---

## 6. Dashboard UI 结构

### 顶部导航
```
[Readdy Logo] [Upgrade] [New Website] [White Label] [Clients] 
[Client Billing] [AI-Readable Sites NEW] [Skills] [Projects] 
[Outreach For agencies] [Free Credits 3250] [Community] 
[Affiliate] [用户头像+姓名]
```

### 主操作区（Hero）
- "Get Your Website in Minutes"
- [Start from Scratch] - 从零开始
- [Start from Website Link] - 从链接导入
- [Make My Site AI-Readable] - AI 优化
- [More] - 更多选项
- 上传名片功能

### 模板 Tab 栏
- **Templates** (当前选中)
- Special Effects
- My Collections

### 模板分类 (20 个)
1. New
2. Popular
3. Real Estate & Home Services
4. Professional Services
5. E-Commerce
6. Art & Design
7. Photography
8. Portfolio & CV
9. Fashion & Beauty
10. Fitness & Wellness
11. Food & Restaurants
12. Travel & Tourism
13. Weddings & Events
14. Education
15. Community & Non-Profits
16. Entertainment & Media
17. Hobbies & Lifestyle
18. Startups & SaaS Solutions
19. Industrial
20. All industries

### 模板卡片结构
- 预览缩略图
- 模板名称
- 特性标签 (With animation / Multi pages 等)
- [Preview] 按钮
- [Add to collection] 按钮
- 无限滚动加载 (useScrollFetch)

---

## 7. 截图清单

| 文件 | 说明 |
|------|------|
| temp\readdy_dashboard.png | Dashboard 全景 (Popular 分类 + 模板列表) |
| temp\readdy_all_industries.png | All industries 全分类视图 |

---

## 8. 关键架构特征总结

1. **纯 SPA 架构**：Vue 3 + Vite 单页应用，无 SSR
2. **自研 UI 系统**：非第三方 UI 库，采用 Radix Vue 风格的 Headless 组件模式
3. **Clerk 认证**：JWT Bearer Token + Cookie 双存储
4. **Go 后端**：部署在 AWS CloudFront + 自托管数据库
5. **积分系统**：每月 250 免费积分，增值功能需付费解锁
6. **模板市场**：269 个模板卡片，20 个分类，支持预览、收藏、无限滚动
7. **AI 建站流程**：填写表单 → AI 生成 → 编辑器（带付费墙）
8. **白标/代理商功能**：White Label、Client Billing、多客户管理
9. **丰富的数据追踪**：PostHog + GA4 + Facebook + Swan + Rewardful + Beehiiv

---

## 9. 与 Buildora 移植的差异点

| 维度 | Readdy | Buildora (已知) |
|------|--------|----------------|
| 框架 | Vue 3 + Vite | 原生 JS (单 HTML) |
| 认证 | Clerk + JWT | 无认证 (RLS 全开放) |
| 后端 | Go + 自托管 DB | Supabase BaaS |
| 订阅 | Stripe 计费 | localStorage 积分 |
| 模板 | 269 个 + 20 分类 | 6 种类型 |
| AI 建站 | 有（含付费墙） | 有（通用模板） |
| 多租户 | 白标 + 代理商 | 不支持 |
*（内容由AI生成，仅供参考）*
