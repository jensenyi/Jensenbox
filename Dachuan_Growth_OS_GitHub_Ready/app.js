(() => {
  const state = window.CONTENT_FACTORY_STATE || {};
  const uiState = state.ui || {};
  const latestRun = state.latestRun || {};

  const app = document.getElementById("app");
  const topHeader = document.getElementById("topHeader");
  const sidebarNavigation = document.getElementById("sidebarNavigation");
  const mainContent = document.getElementById("mainContent");
  const contextTaskPanel = document.getElementById("contextTaskPanel");
  const advancedDrawer = document.getElementById("advancedDrawer");
  const toastEl = document.getElementById("toast");

  const modeStorageKey = "content_factory_mode";
  const newsTabStorageKey = "content_factory_news_tab";
  const localStateStorageKey = "content_factory_local_state";
  const topicShuffleSeedKey = "content_factory_topic_shuffle_seed";
  const topicReserveSize = 100;
  const topicDisplaySize = 30;

  const routes = [
    { path: "/dashboard", label: "总控台" },
    { path: "/intelligence", label: "情报与选题池" },
    { path: "/production", label: "脚本车间" },
    { path: "/creative-workshop", label: "创意车间" },
    { path: "/creative-community", label: "创意社区" },
    { path: "/distribution", label: "多平台分发" },
    { path: "/assets", label: "内容资产库" },
    { path: "/analytics", label: "数据复盘" },
    { path: "/settings", label: "规则与系统" }
  ];

  const fallbackReferenceItems = [
    {
      id: "fallback-brand-1",
      title: "小红书品牌种草正在从达人投放转向真实场景内容",
      summary: "适合拆解品牌如何用用户场景、评论区反馈和产品体验形成可复制的内容资产。",
      sourceName: "内容工厂 品牌新闻",
      sourceUrl: "#",
      categories: ["brand", "campaign", "xiaohongshu"],
      sourceType: "manual",
      fetchedAt: new Date().toISOString(),
      freshnessScore: 88,
      relevanceScore: 92,
      trustScore: 70,
      noveltyScore: 78,
      actionabilityScore: 86
    },
    {
      id: "fallback-brand-2",
      title: "AI 搜索改变品牌内容：FAQ、案例和对比内容更容易被引用",
      summary: "适合转化为 GEO 内容资产，重点补齐品牌事实、用户问题和可验证案例。",
      sourceName: "内容工厂 GEO 观察",
      sourceUrl: "#",
      categories: ["brand", "geo", "ai"],
      sourceType: "manual",
      fetchedAt: new Date().toISOString(),
      freshnessScore: 84,
      relevanceScore: 94,
      trustScore: 72,
      noveltyScore: 82,
      actionabilityScore: 88
    },
    {
      id: "fallback-brand-3",
      title: "新品传播不再只拼曝光，品牌需要把卖点拆成短视频连续钩子",
      summary: "适合生成抖音脚本、小红书图文和朋友圈传播版本。",
      sourceName: "内容工厂 增长案例",
      sourceUrl: "#",
      categories: ["brand", "campaign", "short_video"],
      sourceType: "manual",
      fetchedAt: new Date().toISOString(),
      freshnessScore: 82,
      relevanceScore: 90,
      trustScore: 70,
      noveltyScore: 76,
      actionabilityScore: 90
    },
    {
      id: "fallback-viral-1",
      title: "抖音爆款内容更吃第一秒冲突：反常识、强结果、强情绪",
      summary: "适合拆成 15 秒口播、30 秒快闪和评论区二创选题。",
      sourceName: "内容工厂 每日爆款",
      sourceUrl: "#",
      categories: ["viral", "douyin", "platform", "short_video"],
      sourceType: "manual",
      fetchedAt: new Date().toISOString(),
      freshnessScore: 90,
      relevanceScore: 88,
      trustScore: 68,
      noveltyScore: 80,
      actionabilityScore: 92
    },
    {
      id: "fallback-viral-2",
      title: "小红书热门笔记更适合用清单、避坑、真实体验做内容入口",
      summary: "适合转化为品牌种草、知识分享和产品场景化表达。",
      sourceName: "内容工厂 小红书热点",
      sourceUrl: "#",
      categories: ["viral", "xiaohongshu", "platform"],
      sourceType: "manual",
      fetchedAt: new Date().toISOString(),
      freshnessScore: 88,
      relevanceScore: 90,
      trustScore: 68,
      noveltyScore: 78,
      actionabilityScore: 90
    },
    {
      id: "fallback-viral-3",
      title: "评论区正在成为选题池：用户一句吐槽就能拆出内容钩子",
      summary: "适合创意社区聚合后转入脚本车间，生成观点、案例和执行建议。",
      sourceName: "内容工厂 社区洞察",
      sourceUrl: "#",
      categories: ["viral", "community", "consumer"],
      sourceType: "manual",
      fetchedAt: new Date().toISOString(),
      freshnessScore: 86,
      relevanceScore: 86,
      trustScore: 68,
      noveltyScore: 84,
      actionabilityScore: 88
    }
  ];

  const pipelineSteps = [
    ["input", "01 输入"],
    ["research", "02 研究"],
    ["competitor", "03 竞品"],
    ["ideas", "04 选题"],
    ["selected_ideas", "05 确认前三"],
    ["scripts", "06 脚本"],
    ["visuals", "07 视觉"],
    ["quality_report", "08 质检"],
    ["geo_assets", "09 资产"],
    ["publish_plan", "10 发布"],
    ["review", "11 复盘"]
  ];

  const currentBatchPromise = fetchJson("./data/batches/current-batch.json", {});
  const summaryPromise = fetchJson("./data/fresh-content/latest-summary.json", {});
  const poolPromise = fetchJson("./data/fresh-content/reference-pool.json", []);
  const historyPromise = fetchJson("./data/fresh-content/run-history.json", []);

  const memory = {
    batch: null,
    summary: null,
    pool: [],
    history: [],
    local: loadLocalState()
  };
  let newsCarouselTimer = null;

  function fetchJson(url, fallback) {
    if (typeof fetch !== "function") return Promise.resolve(fallback);
    return fetch(url).then((res) => (res.ok ? res.json() : fallback)).catch(() => fallback);
  }

  function postJson(url, payload) {
    if (typeof fetch !== "function") return Promise.reject(new Error("当前浏览器不支持生成请求。"));
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.detail || data.error || `request_failed_${res.status}`);
      }
      return data;
    });
  }

  function loadLocalState() {
    try {
      return JSON.parse(localStorage.getItem(localStateStorageKey) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveLocalState(patch) {
    memory.local = { ...memory.local, ...patch, updatedAt: new Date().toISOString() };
    localStorage.setItem(localStateStorageKey, JSON.stringify(memory.local));
    return memory.local;
  }

  function makeLocalId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function localList(name) {
    return Array.isArray(memory.local[name]) ? memory.local[name].slice() : [];
  }

  function referencePool() {
    return Array.isArray(memory.pool) && memory.pool.length ? memory.pool.slice() : fallbackReferenceItems.slice();
  }

  function creativeReferenceKey(mode) {
    return mode === "video" ? "creativeVideoReferences" : "creativeImageReferences";
  }

  function currentCreativeReferences(mode) {
    return localList(creativeReferenceKey(mode)).slice(0, 3);
  }

  function repairMojibake(value) {
    const text = String(value || "");
    if (!/[ÃÂäåçèéæïã�]/.test(text)) return text;
    try {
      const bytes = new Uint8Array(Array.from(text, (char) => char.charCodeAt(0) & 255));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      return /[\u4e00-\u9fff]/.test(decoded) ? decoded : text;
    } catch {
      return text;
    }
  }

  function escapeHtml(value) {
    return repairMojibake(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  function currentMode() {
    return localStorage.getItem(modeStorageKey) || "simple";
  }

  function currentNewsTab() {
    const queryTab = new URLSearchParams(location.search).get("tab");
    if (queryTab === "brand" || queryTab === "viral") return queryTab;
    return localStorage.getItem(newsTabStorageKey) || "brand";
  }

  function setNewsTab(value) {
    localStorage.setItem(newsTabStorageKey, value);
    render();
  }

  function setMode(value) {
    localStorage.setItem(modeStorageKey, value);
    render();
  }

  function navigate(path) {
    if (location.pathname === path) return;
    history.pushState({}, "", path);
    render();
  }

  function formatDateTime(value) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace("T", " ").replace(/\.\d+/, "").slice(0, 16);
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date).replace(/\//g, "-");
  }

  function createFallbackPoster(item, variant) {
    const title = escapeHtml((displayTitle(item) || (variant === "viral" ? "今日爆点" : "品牌新闻")).slice(0, 24));
    const source = escapeHtml(cleanText(item.sourceName || "内容工厂").slice(0, 18));
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${variant === "viral" ? "#162032" : "#18162a"}"/>
            <stop offset="52%" stop-color="${variant === "viral" ? "#17445a" : "#50304f"}"/>
            <stop offset="100%" stop-color="#071421"/>
          </linearGradient>
          <radialGradient id="glow" cx="30%" cy="24%" r="56%">
            <stop offset="0%" stop-color="${variant === "viral" ? "#7ef0ff" : "#ff7cc8"}" stop-opacity="0.48"/>
            <stop offset="100%" stop-color="#46d7ff" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="675" rx="42" fill="url(#bg)"/>
        <rect width="1200" height="675" rx="42" fill="url(#glow)"/>
        <g opacity="0.14">
          <path d="M0 112H1200M0 224H1200M0 336H1200M0 448H1200M0 560H1200" stroke="#a9efff"/>
          <path d="M150 0V675M300 0V675M450 0V675M600 0V675M750 0V675M900 0V675M1050 0V675" stroke="#a9efff"/>
        </g>
        <g transform="translate(700 88) rotate(-8)">
          <rect x="0" y="0" width="360" height="450" rx="38" fill="url(#card)" stroke="#ffffff" stroke-opacity="0.18"/>
          <rect x="42" y="58" width="176" height="20" rx="10" fill="#b8f4ff" opacity="0.52"/>
          <rect x="42" y="104" width="268" height="18" rx="9" fill="#ffffff" opacity="0.22"/>
          <rect x="42" y="144" width="218" height="18" rx="9" fill="#ffffff" opacity="0.16"/>
          <circle cx="246" cy="316" r="64" fill="${variant === "viral" ? "#62e3ff" : "#ff95c8"}" opacity="0.42"/>
        </g>
        <g transform="translate(96 120)">
          <circle cx="118" cy="118" r="96" fill="${variant === "viral" ? "#43d2ff" : "#ff7cbb"}" opacity="0.22"/>
          <circle cx="202" cy="226" r="58" fill="#ffffff" opacity="0.12"/>
          <path d="M42 322C140 246 246 250 350 324" fill="none" stroke="#8df0ff" stroke-width="8" opacity="0.34"/>
        </g>
        <g transform="translate(92 448)">
          <rect x="0" y="-74" width="760" height="158" rx="30" fill="#03111f" opacity="0.58"/>
          <text x="34" y="-20" fill="#dff7ff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${source}</text>
          <text x="34" y="42" fill="#ffffff" font-family="Arial, sans-serif" font-size="54" font-weight="900">${title}</text>
        </g>
      </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function normalizeImageUrl(url) {
    const value = cleanText(url).split("|")[0];
    if (!/^https?:\/\//i.test(value)) return "";
    if (/(logo|avatar|icon|favicon|qrcode|qr|placeholder|spacer|sprite)/i.test(value)) return "";
    return value;
  }

  function pickImage(item, variant) {
    const candidates = [
      item.coverImage,
      item.imageUrl,
      item.thumbnail,
      item.heroImage,
      item.ogImage,
      item.mediaImage
    ].filter(Boolean);
    const selected = candidates.map(normalizeImageUrl).find(Boolean);
    return selected || createFallbackPoster(item, variant);
  }

  function cleanText(value) {
    return repairMojibake(value).replace(/\s+/g, " ").trim();
  }

  function hasBrokenEncoding(value) {
    return /[ÃÂäåçèéæïã�]/.test(String(value || ""));
  }

  function isDisplayableItem(item) {
    const text = `${(item && item.title) || ""} ${(item && item.summary) || ""} ${(item && item.sourceName) || ""}`;
    return text.trim() && !hasBrokenEncoding(text);
  }

  function displayTitle(item) {
    return cleanText(item && item.title)
      .replace(/\s*[|｜]\s*(SocialBeta|Morketing|虎嗅|36氪|新榜)\s*$/i, "")
      .replace(/\s*-\s*(Yahoo Finance|Google News)\s*$/i, "");
  }

  function displaySummary(item) {
    return cleanText((item && (item.summary || item.originalSummary)) || "暂无摘要，建议打开来源核验后再转化。");
  }

  function hasPlatformViralSignal(item) {
    const source = cleanText(item && item.sourceName);
    const categories = Array.isArray(item && item.categories) ? item.categories.join(" ") : "";
    const text = `${(item && item.title) || ""} ${(item && item.summary) || ""} ${source}`;
    return /\b(viral|douyin|xiaohongshu)\b/i.test(categories) || /(抖音热点榜|小红书热榜|抖音|小红书|热榜|爆款|热点)/i.test(text);
  }

  function hasBrandNewsSignal(item) {
    const source = cleanText(item && item.sourceName);
    const categories = Array.isArray(item && item.categories) ? item.categories.join(" ") : "";
    const text = `${(item && item.title) || ""} ${(item && item.summary) || ""} ${source}`;
    return /\b(brand|campaign)\b/i.test(categories) || /(品牌|案例|营销|Campaign|Morketing|SocialBeta)/i.test(text);
  }

  function brandExpertScore(item) {
    const categories = Array.isArray(item && item.categories) ? item.categories.join(" ") : "";
    const text = `${(item && item.title) || ""} ${(item && item.summary) || ""} ${(item && item.sourceName) || ""}`;
    let score = Number((item && (item.expertScore || item.relevanceScore || item.actionabilityScore)) || 60);
    if (/\b(douyin|xiaohongshu|viral)\b/i.test(categories)) score += 18;
    if (/\b(brand|campaign)\b/i.test(categories)) score += 12;
    if (/(抖音|小红书|热榜|爆款|热点|种草|评论区|流量|挑战|模板|钩子)/i.test(text)) score += 12;
    if (/(品牌|营销|增长|转化|出海|联名|新品|商业化)/i.test(text)) score += 10;
    return Math.min(score, 100);
  }

  function isBrandItem(item) {
    if (hasPlatformViralSignal(item) && !hasBrandNewsSignal(item)) return false;
    const source = cleanText(item.sourceName);
    const categories = Array.isArray(item.categories) ? item.categories.join(" ") : "";
    const text = `${item.title || ""} ${item.summary || ""} ${source}`;
    if (/(抖音热点|小红书热点|平台热点)/i.test(source)) return false;
    return /(品牌案例|营销资讯|morketing|数英|广告门)/i.test(source) || /\b(brand|campaign)\b/i.test(categories) || /(品牌|案例|campaign|联名|出海)/i.test(text);
  }

  function isViralItem(item) {
    if (hasPlatformViralSignal(item)) return true;
    if (hasBrandNewsSignal(item)) return false;
    const source = cleanText(item.sourceName);
    const categories = Array.isArray(item.categories) ? item.categories.join(" ") : "";
    const text = `${item.title || ""} ${item.summary || ""} ${source}`;
    if (/(品牌案例|营销资讯)/i.test(source)) return false;
    return /(抖音热点|小红书热点|平台热点|虎嗅|36氪|新榜)/i.test(source) || /\b(platform|short_video|consumer)\b/i.test(categories) || /(抖音|小红书|快手|微博|热搜|热点|流量|爆款)/i.test(text);
  }

  function byFreshness(a, b) {
    return new Date(b.publishedAt || b.fetchedAt || 0) - new Date(a.publishedAt || a.fetchedAt || 0);
  }

  function topicFocus(item) {
    const categories = Array.isArray(item && item.categories) ? item.categories.join(" ") : "";
    const text = `${(item && item.title) || ""} ${(item && item.summary) || ""} ${(item && item.sourceName) || ""}`;
    if (/(品牌|营销|campaign|brand|联名|出海|新品|商业化|转化)/i.test(text) || /\b(brand|campaign)\b/i.test(categories)) return "品牌类";
    if (/(教程|方法|攻略|知识|科普|解释|拆解|怎么|如何|指南)/i.test(text)) return "知识类";
    if (/(分享|体验|日常|生活|旅行|美食|穿搭|好物|种草|笔记)/i.test(text)) return "分享类";
    if (/(潮流|热点|热榜|爆款|挑战|年轻人|趋势|流行|明星|赛事)/i.test(text) || /\b(viral|douyin|xiaohongshu)\b/i.test(categories)) return "潮流类";
    if (/(抖音|小红书|平台|流量|算法|搜索|内容生态)/i.test(text) || /\b(platform|short_video)\b/i.test(categories)) return "平台类";
    return "观察类";
  }

  function topicPriorityLabel(item) {
    const text = `${(item && item.title) || ""} ${(item && item.summary) || ""} ${(item && item.sourceName) || ""}`;
    if (/(品牌|营销|增长|转化|GEO|AI搜索|消费品牌|内容玩法|商业模式|小红书|抖音|种草|爆款|新媒体)/i.test(text)) return "优先";
    if (/(赛事|天气|辟谣|民航|普通社会|体育|票价)/i.test(text)) return "可借势/非优先";
    return "观察";
  }

  function topicPriorityRank(item) {
    const label = topicPriorityLabel(item);
    if (label === "优先") return 3;
    if (label === "观察") return 2;
    return 1;
  }

  function topicShuffleSeed() {
    return Number(localStorage.getItem(topicShuffleSeedKey) || "0");
  }

  function seededRank(item, index, seed) {
    const key = `${item.id || ""}|${item.sourceUrl || ""}|${item.title || ""}|${seed}`;
    let hash = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) + index / 100000;
  }

  function getTopicReserve() {
    const communityIdeas = localList("communityIdeas").map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      sourceName: "创意社区",
      sourceUrl: "#",
      publishedAt: item.createdAt,
      fetchedAt: item.createdAt,
      categories: ["brand", "community", "idea"],
      duplicateStatus: "unique",
      verificationStatus: "source_verified",
      contentStatus: "reviewing"
    }));
    const source = [...communityIdeas, ...referencePool()];
    return source
      .filter((item) => item && (item.title || item.summary))
      .filter(isDisplayableItem)
      .sort((a, b) => (topicPriorityRank(b) - topicPriorityRank(a)) || (brandExpertScore(b) - brandExpertScore(a)) || byFreshness(a, b))
      .slice(0, topicReserveSize);
  }

  function getNewsItems(kind) {
    const source = referencePool();
    const filtered = source
      .filter(isDisplayableItem)
      .filter((item) => (kind === "brand" ? isBrandItem(item) : isViralItem(item)))
      .sort((a, b) => (brandExpertScore(b) - brandExpertScore(a)) || byFreshness(a, b));
    const unique = [];
    const seen = new Set();
    for (const item of filtered) {
      const key = (item.sourceUrl || item.title || "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
      if (unique.length >= 6) break;
    }
    return unique;
  }

  function getIntelligenceItems() {
    const seed = topicShuffleSeed();
    return getTopicReserve()
      .map((item, index) => ({ item, rank: seededRank(item, index, seed) }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, topicDisplaySize)
      .map(({ item }, index) => ({
        id: item.id || `ref-${index + 1}`,
        title: displayTitle(item) || "未命名参考",
        summary: cleanText(item.summary || item.updateSummary || ""),
        sourceName: cleanText(item.sourceName || "内容工厂"),
        sourceUrl: item.sourceUrl || "#",
        publishedAt: item.publishedAt || item.fetchedAt || "",
        fetchedAt: item.fetchedAt || item.publishedAt || "",
        focus: topicFocus(item),
        priority: topicPriorityLabel(item),
        duplicateStatus: item.duplicateStatus || "unique",
        verificationStatus: item.verificationStatus || "source_verified",
        contentStatus: item.contentStatus || "reviewing"
      }));
  }

  function renderNewsShowcase(kind, isBanner = false) {
    const items = getNewsItems(kind);
    if (!items.length) {
      return `<section class="panel news-panel"><div class="empty-state">今日还没有可展示的${kind === "brand" ? "品牌新闻" : "每日爆款"}。</div></section>`;
    }
    return `
      <section class="panel news-panel ${isBanner ? "news-panel-banner" : ""}">
        <div class="section-head">
          <div>
            <h2>${isBanner ? (kind === "brand" ? "品牌新闻" : "每日爆款") : `今天值得先看的 ${items.length} 条`}</h2>
          </div>
          <div class="tab-row compact">
            <button class="tab-button ${kind === "brand" ? "is-active" : ""}" data-news-tab="brand">品牌新闻</button>
            <button class="tab-button ${kind === "viral" ? "is-active" : ""}" data-news-tab="viral">每日爆款</button>
          </div>
        </div>
        <div class="news-carousel-shell">
          <button class="news-carousel-arrow prev" type="button" data-carousel-dir="-1" aria-label="上一条">‹</button>
          <div class="news-carousel" aria-label="${kind === "brand" ? "品牌新闻滚动列表" : "每日爆款滚动列表"}">
            ${items.map((item, index) => renderFeatureCard(item, kind, index === 0)).join("")}
          </div>
          <button class="news-carousel-arrow next" type="button" data-carousel-dir="1" aria-label="下一条">›</button>
        </div>
        ${isBanner ? `
          <div class="banner-quick-actions">
            <button class="primary-button compact" data-route="/intelligence">进入选题池</button>
            <button class="ghost-button" data-route="/production">进入脚本车间</button>
          </div>` : ""}
      </section>`;
  }

  function renderFeatureCard(item, kind, isHero) {
    const href = item.sourceUrl || "#";
    const image = pickImage(item, kind);
    const fallbackImage = createFallbackPoster(item, kind);
    const title = displayTitle(item);
    const summary = cleanText(item.summary || item.updateSummary || "");
    const meta = `${cleanText(item.sourceName || "内容工厂")} | ${formatDateTime(item.publishedAt || item.fetchedAt)}`;
    return `
      <a class="news-card ${isHero ? "news-card-hero" : "news-card-side"}" href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">
        <div class="news-card-image-wrap" style="background-image:url('${fallbackImage}')">
          <img class="news-card-image" src="${image}" data-fallback="${fallbackImage}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHtml(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="if(this.naturalWidth<80){this.onload=null;this.src=this.dataset.fallback}" />
        </div>
        <div class="news-card-overlay"></div>
        <div class="news-card-copy">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(summary)}</p>
          <small>${escapeHtml(meta)}</small>
        </div>
      </a>`;
  }

  function renderMiniCard(item, kind) {
    const href = item.sourceUrl || "#";
    const image = pickImage(item, kind);
    const title = displayTitle(item);
    const source = cleanText((item.sourceName || "内容工厂").replace(/\s+/g, " ")).replace(/品牌案例|小红书热点|平台热点|营销资讯/g, "").trim() || "内容工厂";
    const meta = `${source} · ${formatDateTime(item.publishedAt || item.fetchedAt).slice(5, 16)}`;
    return `
      <a class="mini-news-card" href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">
        <img class="mini-news-thumb" src="${image}" data-fallback="${createFallbackPoster(item, kind)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHtml(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="if(this.naturalWidth<80){this.onload=null;this.src=this.dataset.fallback}" />
        <div class="mini-news-copy">
          <span>${escapeHtml(meta)}</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
      </a>`;
  }

  function renderTopHeader() {
    const route = routes.find((item) => item.path === normalizePath(location.pathname)) || routes[0];
    topHeader.innerHTML = `
      <div class="header-brand">
        <span class="brand-mark">内容工厂</span>
        <div>
          <strong>${route.label}</strong>
        </div>
      </div>`;
  }

  function renderSidebar() {
    sidebarNavigation.innerHTML = `
      <div class="sidebar-head">
        <h2>大川内容工厂</h2>
      </div>
      <nav class="sidebar-links">
        ${routes.map((item) => `<button class="sidebar-link ${normalizePath(location.pathname) === item.path ? "is-active" : ""}" data-route="${item.path}">${item.label}</button>`).join("")}
      </nav>
      <div class="sidebar-foot">
        <span>模型等级</span>
        <strong>${uiState.modelLabel || "L3 策略增强"}</strong>
        <small>${uiState.modelName || "deepseek-chat"}</small>
      </div>`;
  }

  function renderContextPanel() {
    const latestCreative = localList("creativeJobs").find((item) => item.status === "completed");
    const distributionCount = localList("distributionQueue").length;
    const assetCount = localList("creativeAssets").length;
    const reserveCount = getTopicReserve().length;
    contextTaskPanel.innerHTML = `
      <section class="panel side-panel">
        <div class="section-head compact-head">
          <div>
            <p class="eyebrow">内容资产</p>
            <h3>生产状态</h3>
          </div>
        </div>
        <div class="task-highlight">
          <strong>${latestCreative ? escapeHtml(shortText(latestCreative.title, 24)) : "暂无最新成品"}</strong>
          <p>${latestCreative ? "最近生成的图片/视频可继续进入分发和资产复用。" : "先从选题池或创意车间产出一个可复用内容资产。"}</p>
        </div>
        <div class="status-list">
          <div><span>待分发</span><strong>${distributionCount}</strong></div>
          <div><span>本地资产</span><strong>${assetCount}</strong></div>
          <div><span>选题储备</span><strong>${Math.min(reserveCount, topicReserveSize)}</strong></div>
        </div>
      </section>`;
  }

  function renderDashboard() {
    return renderNewsShowcase(currentNewsTab(), true);
  }

  function renderProduction() {
    const batch = memory.batch || {};
    const completed = new Set(batch.completedSteps || []);
    const productionPlatform = memory.local.productionPlatform || "抖音 / 视频号";
    const productionTone = memory.local.productionTone || "操盘手视角";
    const selectedIdeas = [
      ...((((batch.outputs || {}).artifacts || {}).selected_ideas) || []),
      ...((memory.local.productionQueue || []).map((item) => ({
        title: item.title,
        summary: item.summary || "已从选题池加入本地加工队列。",
        angle: "本地加工队列"
      })))
    ];
    const localQueueCount = Array.isArray(memory.local.productionQueue) ? memory.local.productionQueue.length : 0;
    const latestCreative = localList("creativeJobs").find((item) => item.status === "completed");
    return `
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">脚本生产</p>
            <h2>脚本车间</h2>
          </div>
        </div>
        <div class="status-strip">
          <div><span>已确认选题</span><strong>${selectedIdeas.length}</strong></div>
          <div><span>本地加工池</span><strong>${localQueueCount}</strong></div>
          <div><span>脚本产出</span><strong>${completed.has("scripts") ? "可用" : "待生成"}</strong></div>
          <div><span>最近成品</span><strong>${latestCreative ? "已生成" : "暂无"}</strong></div>
        </div>
      </section>
      <section class="panel split-panel">
        <div>
          <div class="section-head compact-head"><h3>已确认选题</h3></div>
          <div class="selection-grid">
            ${selectedIdeas.map((item) => `<article class="selection-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary || "")}</p><small>${escapeHtml(item.angle || "增长切口")}</small></article>`).join("") || `<div class="empty-state">当前还没有已确认选题。</div>`}
          </div>
        </div>
        <div>
          <div class="section-head compact-head"><h3>一键生成</h3></div>
          <div class="generation-input">
            <label>
              <span>输入内容</span>
              <textarea id="generationInput" placeholder="示例：品牌/产品是什么？发生了什么热点？目标平台是抖音还是小红书？你想要脚本、图文、GEO 还是质检？"></textarea>
            </label>
            <div class="input-example">
              <p>建议输入：事件背景 + 品牌/产品 + 目标人群 + 平台 + 想要的输出。</p>
              <button type="button" class="ghost-button" data-action="fill-generation-example">填入示例</button>
            </div>
            <div class="generation-options">
              <label><input type="checkbox" value="script" checked /> 短视频脚本</label>
              <label><input type="checkbox" value="visual" checked /> 视觉方案</label>
              <label><input type="checkbox" value="xiaohongshu" /> 小红书图文</label>
              <label><input type="checkbox" value="geo" /> GEO / FAQ</label>
              <label><input type="checkbox" value="hook" checked /> 标题钩子</label>
              <label><input type="checkbox" value="platform" checked /> 平台版本</label>
              <label><input type="checkbox" value="risk" checked /> 风险质检</label>
            </div>
            <div class="generation-selects">
              <div class="choice-group" data-choice-group="platform">
                <span>平台</span>
                ${["抖音 / 视频号", "小红书", "公众号", "全平台"].map((name) => `<button type="button" class="choice-chip ${productionPlatform === name ? "active" : ""}" data-choice-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")}
              </div>
              <div class="choice-group" data-choice-group="tone">
                <span>语气</span>
                ${["操盘手视角", "增长拆解", "案例复盘", "犀利观点"].map((name) => `<button type="button" class="choice-chip ${productionTone === name ? "active" : ""}" data-choice-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")}
              </div>
            </div>
          </div>
          <div class="action-grid">
            <button class="action-card primary-action" type="button" data-action="generate-draft"><strong>立即生成</strong><span>按上方输入和勾选需求，直接产出可用草稿</span></button>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="section-head compact-head">
          <h3>生成结果看板</h3>
          <button class="ghost-button" data-action="copy-output">复制结果</button>
        </div>
        <div class="result-board" id="generationResult">
          <article class="result-block"><span>标题</span><strong>先判断，再生产：把热点变成可执行增长内容</strong></article>
          <article class="result-block"><span>开头钩子</span><p>多数内容不是缺热点，而是缺“为什么现在做、怎么转化”的商业判断。</p></article>
          <article class="result-block"><span>短视频脚本</span><p>用 3 秒结论开场，15 秒拆案例，20 秒给执行建议，结尾引导进入选题池复盘。</p></article>
          <article class="result-block"><span>视觉提示词</span><p>深蓝科技中台界面，真实新闻卡片，中文大标题，品牌增长数据光效。</p></article>
        </div>
      </section>`;
  }

  function renderIntelligence() {
    const items = getIntelligenceItems();
    const reserve = getTopicReserve();
    const recommended = items.slice(0, 3);
    return `
      <section class="panel">
        <div class="section-head">
          <div>
            <h2>今日候选选题池</h2>
          </div>
          <button class="primary-button" data-action="refresh-news">随机换一批</button>
        </div>
        <div class="status-strip">
          <div><span>当前展示</span><strong>${items.length}</strong></div>
          <div><span>今日储备</span><strong>${Math.min(reserve.length, topicReserveSize)}</strong></div>
          <div><span>待审核</span><strong>${items.filter((item) => item.contentStatus !== "approved").length}</strong></div>
          <div><span>已核验</span><strong>${items.filter((item) => item.verificationStatus !== "unverified").length}</strong></div>
          <div><span>重复合并</span><strong>${items.filter((item) => item.duplicateStatus !== "unique").length}</strong></div>
        </div>
        <div class="recommend-strip">
          ${recommended.map((item, index) => `
            <article class="recommend-card">
              <span>推荐 ${index + 1} · ${escapeHtml(item.focus)} · ${escapeHtml(item.priority)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.summary || "高相关、高时效，适合进入 Top 3 复核。")}</p>
              <div>
                <button class="ghost-button" data-action="add-to-production" data-topic="${escapeHtml(item.title)}">加入加工池</button>
                <a class="table-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer noopener">看来源</a>
              </div>
            </article>`).join("")}
        </div>
        <div class="table-wrap intelligence-table-wrap">
          <table class="data-table intelligence-table">
            <thead>
              <tr>
                <th>候选选题</th>
                <th>来源</th>
                <th>发布时间</th>
                <th>类目</th>
                <th>去重</th>
                <th>审核</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(item.title)}</strong>
                    <div class="table-subtext">${escapeHtml(item.summary || "等待补充摘要")}</div>
                    <a class="table-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer noopener">查看来源</a>
                  </td>
                  <td>${escapeHtml(item.sourceName)}</td>
                  <td>${escapeHtml(formatDateTime(item.publishedAt))}</td>
                  <td><span class="score-pill">${escapeHtml(`${item.focus} · ${item.priority}`)}</span></td>
                  <td><span class="status-pill ${item.duplicateStatus}">${escapeHtml(item.duplicateStatus)}</span></td>
                  <td><span class="status-pill ${item.contentStatus}">${escapeHtml(item.contentStatus)}</span></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderAssets() {
    const savedAssets = localList("creativeAssets");
    const assets = [
      ["脚本库", "沉淀短视频脚本、口播稿和分镜结构。"],
      ["标题库", "沉淀高点击标题、钩子和开头句。"],
      ["视觉提示词", "沉淀封面、海报、分镜和生成提示词。"],
      ["GEO / FAQ", "沉淀 AI 搜索友好的问答与结构化内容。"]
    ];
    return `
      <section class="panel">
        <div class="section-head"><div><h2>内容资产库</h2></div></div>
        <div class="asset-entry-grid">
          ${assets.map(([title, desc]) => `
            <article class="asset-entry-card">
              <strong>${title}</strong>
              <p>${desc}</p>
              <button class="ghost-button" data-route="/production">从当前批次沉淀</button>
            </article>`).join("")}
        </div>
        <div class="section-head compact-head"><h3>本地创意资产</h3></div>
        <div class="workbench-grid">
          ${savedAssets.slice(0, 6).map((item) => `
            <article class="workbench-card">
              <span>${escapeHtml(item.type || "创意资产")}</span>
              <strong>${escapeHtml(item.title || "未命名资产")}</strong>
              <p>${escapeHtml(item.summary || "已保存到浏览器本地资产库。")}</p>
              <small>${escapeHtml(formatDateTime(item.updatedAt || item.createdAt))}</small>
            </article>`).join("") || `<div class="empty-state">还没有本地创意资产。可从创意车间或创意社区保存。</div>`}
        </div>
      </section>`;
  }

  function renderDistribution() {
    const queue = localList("distributionQueue");
    const tasks = ["视频号版本", "小红书图文", "公众号长文", "朋友圈短文"];
    return `
      <section class="panel">
        <div class="section-head">
          <div><h2>多平台分发</h2></div>
          <button class="primary-button" data-action="approve-distribution">批准进入分发</button>
        </div>
        <div class="workbench-grid">
          ${queue.slice(0, 4).map((item) => `
            <article class="workbench-card">
              <span>本地待分发</span>
              <strong>${escapeHtml(item.title || "未命名创意")}</strong>
              <p>${escapeHtml(item.summary || "来自创意车间，本地分发队列状态。")}</p>
              <small>${escapeHtml(item.platform || "待定平台")} · ${escapeHtml(formatDateTime(item.createdAt))}</small>
            </article>`).join("")}
          ${tasks.map((name, index) => `
            <article class="workbench-card">
              <span>${index < 2 ? "待适配" : "待审批"}</span>
              <strong>${name}</strong>
              <p>标题、封面、发布时间和平台风险需要确认后再发布。</p>
              <div><button class="ghost-button" data-action="adapt-platform">生成适配版</button><button class="ghost-button" data-action="quality-check">检查风险</button></div>
            </article>`).join("")}
        </div>
      </section>`;
  }

  function currentCreativeMode() {
    return memory.local.creativeMode || "image";
  }

  function renderChoiceFold(title, group, items) {
    const selected = memory.local[group] || items[0] || "";
    return `
      <div class="choice-fold" data-choice-fold="${escapeHtml(group)}">
        <button type="button" class="choice-fold-summary" data-choice-fold-target="${escapeHtml(group)}" onpointerdown="window.contentFactoryToggleChoiceFold && window.contentFactoryToggleChoiceFold(this); event.preventDefault(); event.stopPropagation();">
          <span>${escapeHtml(title)}：</span>
          <b data-choice-summary="${escapeHtml(group)}">${escapeHtml(selected)}</b>
          <em>展开</em>
        </button>
        <div class="choice-group choice-fold-options" data-choice-group="${escapeHtml(group)}">
          ${items.map((name) => `<button type="button" class="choice-chip ${selected === name ? "active" : ""}" data-choice-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")}
        </div>
      </div>`;
  }

  function renderCreativeWorkshop() {
    const mode = currentCreativeMode();
    const jobs = localList("creativeJobs");
    const latest = jobs.find((job) => job.mode === mode);
    const seed = memory.local.creativeSeed || "";
    const isVideo = mode === "video";
    const references = currentCreativeReferences(mode);
    return `
      <section class="panel creative-workshop-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">多模态生产</p>
            <h2>创意车间</h2>
            <p>输入创意、参考图和平台要求，右侧直接查看生成成品，并继续进入分发或资产沉淀。</p>
          </div>
          <div class="tab-actions">
            <button class="ghost-button ${mode === "image" ? "active" : ""}" data-action="set-creative-mode" data-mode="image">文生图</button>
            <button class="ghost-button ${mode === "video" ? "active" : ""}" data-action="set-creative-mode" data-mode="video">文生视频</button>
          </div>
        </div>
        <div class="split-panel">
          <div>
            <div class="section-head compact-head"><h3>${isVideo ? "文生视频输入" : "文生图输入"}</h3></div>
            <div class="generation-input">
              <label>
                <span>文字输入</span>
                <textarea id="creativeInput" placeholder="示例：帮我为「AI 内容工厂」生成一条小红书封面图 / 抖音 30s 视频。主题：品牌如何用热点提升信任和转化。目标人群：创业者、品牌操盘手。希望风格：科技感、商业质感、中文信息层级清楚。">${escapeHtml(seed)}</textarea>
              </label>
              ${renderCreativeReferenceInput(mode, references)}
              <div class="generation-selects">
                ${renderChoiceFold("风格", "creativeStyle", isVideo ? ["高能快剪", "商业纪录片", "科技感", "街头潮流", "知识型老板视角"] : ["潮流杂志", "商业质感", "强视觉海报", "极简科技", "品牌大片", "街头视觉"])}
                ${renderChoiceFold("适配平台", "creativePlatform", isVideo ? ["抖音", "小红书", "视频号", "通用"] : ["小红书", "抖音", "视频号", "公众号", "通用"])}
                ${renderChoiceFold(isVideo ? "视频参数" : "用途", "creativeUse", isVideo ? ["15s 口播", "30s 快闪", "60s 案例拆解", "品牌观点", "产品种草"] : ["封面", "配图", "海报", "长图", "品牌视觉"])}
              </div>
              <button class="primary-button" data-action="generate-creative" data-mode="${escapeHtml(mode)}">${isVideo ? "渲染视频" : "生成图片"}</button>
            </div>
          </div>
          <div>
            <div class="section-head compact-head"><h3>成品展示</h3></div>
            <div id="creativeResult" class="result-board creative-result">
              ${latest ? renderCreativeJob(latest) : renderCreativeEmptyOutput(mode)}
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderCreativeEmptyOutput(mode) {
    const isVideo = mode === "video";
    return `
      <article class="creative-output-card">
        <div class="creative-output-frame ${isVideo ? "video-frame" : "image-frame"}">
          <div class="creative-output-placeholder">
          ${isVideo ? "视频成品会在这里预览。" : "图片成品会在这里预览。"}
          </div>
        </div>
        <div class="creative-output-meta"><strong>等待生成</strong><span>填写左侧内容后开始生成。</span></div>
      </article>`;
  }

  function renderCreativeReferenceInput(mode, references) {
    const disabled = references.length >= 3 ? "disabled" : "";
    const counter = `${references.length}/3`;
    return `
      <div class="reference-uploader">
        <div class="reference-uploader-head">
          <label class="reference-add ${disabled ? "disabled" : ""}">
            <input type="file" accept="image/*" multiple data-reference-input data-mode="${escapeHtml(mode)}" ${disabled} />
            <span>+</span>
            <strong>添加参考图</strong>
          </label>
          <p>最多添加 3 张参考图，用于锁定风格、构图和色调。${counter}</p>
        </div>
        <div class="reference-preview-list">
          ${references.map((item) => `
            <figure class="reference-preview">
              <img src="${escapeHtml(item.dataUrl)}" alt="${escapeHtml(item.name || "参考图")}" />
              <figcaption>${escapeHtml(shortText(item.name || "参考图", 14))}</figcaption>
              <button type="button" data-action="remove-reference-image" data-mode="${escapeHtml(mode)}" data-ref-id="${escapeHtml(item.id)}" aria-label="移除参考图">×</button>
            </figure>`).join("") || `<span class="reference-empty">可添加封面、构图、色调或主体参考。</span>`}
        </div>
      </div>`;
  }

  function renderCreativeJob(job) {
    const isVideo = job.mode === "video";
    const statusText = {
      running: isVideo ? "正在渲染 HyperFrames 视频..." : "正在生成图片...",
      completed: isVideo ? "已生成真实视频成品" : "已生成真实图片成品",
      failed: "生成失败"
    }[job.status] || "等待生成";
    const media = job.status === "completed" && job.assetUrl
      ? (isVideo
        ? `<video class="creative-output-media" src="${escapeHtml(job.assetUrl)}" controls playsinline></video>`
        : `<img class="creative-output-media" src="${escapeHtml(job.assetUrl)}" alt="${escapeHtml(job.title)}" />`)
      : `<div class="creative-output-placeholder">${job.status === "failed" ? escapeHtml(job.error || "生成服务暂不可用，请稍后重试。") : escapeHtml(statusText)}</div>`;
    return `
      <article class="creative-output-card">
        <div class="creative-output-frame ${isVideo ? "video-frame" : "image-frame"}">${media}</div>
        <div class="creative-output-meta">
          <strong>${escapeHtml(statusText)}</strong>
          <span>${escapeHtml(job.status === "failed" ? (job.error || "生成服务暂不可用，请稍后重试。") : job.platformAdvice)}</span>
        </div>
        <div class="creative-output-actions">
          ${job.status === "completed" && job.assetUrl ? `<a class="ghost-button" href="${escapeHtml(job.assetUrl)}" target="_blank" rel="noreferrer noopener">${isVideo ? "打开视频" : "查看大图"}</a>` : ""}
          ${job.status === "completed" && job.assetUrl ? `<a class="ghost-button" href="${escapeHtml(job.assetUrl)}" download>${isVideo ? "下载 MP4" : "下载 PNG"}</a>` : ""}
          <button class="ghost-button" data-action="creative-to-distribution" data-job-id="${escapeHtml(job.id)}">加入分发队列</button>
          <button class="ghost-button" data-action="creative-save-asset" data-job-id="${escapeHtml(job.id)}">保存到资产库</button>
        </div>
      </article>`;
  }

  function renderCreativeCommunity() {
    const feed = getCommunityFeed();
    const channel = currentCommunityChannel();
    const channels = [
      ["all", "全部"],
      ["brand", "品牌/新媒体"],
      ["douyin", "抖音"],
      ["xiaohongshu", "小红书"],
      ["community", "社区讨论"]
    ];
    return `
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">公开中文信号聚合</p>
            <h2>创意社区</h2>
            <p>汇总品牌、新媒体、抖音、小红书等公开中文信号，提炼情绪、机会和可转化选题。</p>
          </div>
          <button class="primary-button" data-action="sync-community-feed">同步公开信号</button>
        </div>
        <div class="community-channel-row">
          ${channels.map(([id, label]) => `<button type="button" class="community-channel ${channel === id ? "active" : ""}" data-action="set-community-channel" data-channel="${id}">${label}</button>`).join("")}
        </div>
      </section>
      <section class="panel community-feed-panel">
        <div class="section-head compact-head">
          <h3>社区洞察</h3>
          <span class="muted-note">今日公开信号已进入机会筛选</span>
        </div>
        <div class="community-feed-list">
          ${feed.map((item) => renderCommunityFeedItem(item)).join("") || `<div class="empty-state">当前没有匹配的公开社区信号。请先在情报池同步参考内容，或用下方补充入口手动导入。</div>`}
        </div>
      </section>
      <section class="panel">
        <details class="manual-community-import">
          <summary>手动补充帖子 / 评论 / 链接</summary>
          <div class="split-panel manual-community-body">
            <div class="generation-input">
              <label><span>补充内容</span><textarea id="communityInput" placeholder="可选补充：粘贴公开帖子、评论、链接、品牌案例或热点线索。建议只使用公开信息。"></textarea></label>
              <label><span>来源链接或备注</span><input id="communityLink" class="text-input" placeholder="可选：公开链接、来源说明、平台名称" /></label>
              <div class="choice-group" data-choice-group="communityPlatform">
                <span>来源平台</span>
                ${["小红书", "抖音", "视频号", "公众号", "品牌案例", "其他"].map((name, index) => `<button type="button" class="choice-chip ${index === 0 ? "active" : ""}" data-choice-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")}
              </div>
              <button class="ghost-button" data-action="analyze-community">生成补充洞察</button>
            </div>
            <div class="community-note">
              <strong>使用建议</strong>
              <p>补充内容会转成洞察、选题或脚本线索；正式使用前仍需核验来源和表达风险。</p>
            </div>
          </div>
        </details>
      </section>`;
  }

  function renderCommunityItem(item) {
    return `
      <article class="workbench-card community-card">
        <span>${escapeHtml(item.platform)} · ${escapeHtml(item.sentiment)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.summary)}</p>
        <ul class="insight-list">
          <li>关注原因：${escapeHtml(item.reason)}</li>
          <li>评论洞察：${escapeHtml(item.commentInsight)}</li>
          <li>品牌机会：${escapeHtml(item.opportunity)}</li>
          <li>风险点：${escapeHtml(item.risk)}</li>
        </ul>
        <div class="button-row">
          <button class="ghost-button" data-action="community-to-idea" data-community-id="${escapeHtml(item.id)}">加入选题池</button>
          <button class="ghost-button" data-action="community-to-script" data-community-id="${escapeHtml(item.id)}">转入脚本工厂</button>
          <button class="ghost-button" data-action="community-to-workshop" data-community-id="${escapeHtml(item.id)}">转入创意车间</button>
          <button class="ghost-button" data-action="community-save-asset" data-community-id="${escapeHtml(item.id)}">沉淀为资产</button>
        </div>
      </article>`;
  }

  function currentCommunityChannel() {
    return memory.local.communityChannel || "all";
  }

  function communityPlatform(item) {
    const source = cleanText(item && item.sourceName);
    const categories = Array.isArray(item && item.categories) ? item.categories.join(" ") : "";
    const text = `${source} ${(item && item.title) || ""} ${(item && item.summary) || ""}`;
    if (/小红书|xiaohongshu/i.test(text) || /\bxiaohongshu\b/i.test(categories)) return "小红书";
    if (/抖音|douyin/i.test(text) || /\bdouyin\b/i.test(categories)) return "抖音";
    if (/知乎|豆瓣|天涯|社区|评论|讨论|openai/i.test(text)) return "社区讨论";
    if (/Morketing|SocialBeta|数英|广告门|营销|品牌/i.test(text)) return "品牌/新媒体";
    return source || "公开来源";
  }

  function communitySignalFromReference(item) {
    const title = displayTitle(item);
    const summary = displaySummary(item);
    const platform = communityPlatform(item);
    const focus = topicFocus(item);
    const priority = topicPriorityLabel(item);
    const layer = priority === "可借势/非优先"
      ? "弱相关借势"
      : (/AI|GEO|搜索/i.test(`${title} ${summary}`) ? "AI/GEO"
        : (hasBrandNewsSignal(item) ? "品牌案例" : (hasPlatformViralSignal(item) ? "平台热点" : "社会热点借势")));
    const heat = Math.round(Number(item.freshnessScore || 70) * 0.35 + Number(item.relevanceScore || 70) * 0.35 + Number(item.actionabilityScore || 60) * 0.3);
    const sentiment = /(翻车|吐槽|争议|风险|贵|差|避雷|下滑)/i.test(`${title} ${summary}`) ? "争议/风险情绪" : "高关注讨论";
    const isViral = hasPlatformViralSignal(item);
    const isBrand = hasBrandNewsSignal(item);
    return {
      id: item.id || item.sourceUrl || title,
      platform,
      layer,
      priority,
      title,
      summary,
      sourceUrl: item.sourceUrl || "#",
      heat,
      sentiment,
      reason: `${layer} · ${focus} · ${priority}，适合判断是否转成内容机会。`,
      commentInsight: isViral ? "优先看开头冲突、跟拍空间、评论区重复提问和二创门槛。" : (isBrand ? "优先看品牌动作、用户信任点、场景触发和可复制执行细节。" : "只提炼情绪和借势角度，不作为主线选题。"),
      opportunity: isViral ? "适合转成抖音/小红书热点拆解、封面钩子或短视频脚本。" : (isBrand ? "适合转成品牌案例拆解、增长观点、GEO 问答或新媒体选题。" : "可作为开头借势，不建议单独进入 Top 3。"),
      risk: priority === "可借势/非优先" ? "弱相关内容不得同权重进入正式生产，只能作为借势素材。" : (item.verificationStatus === "fact_checked" ? "来源已标记核验，发布前仍需复查事实口径。" : "公开信号未完全核验，不能直接搬运原文或当作事实结论。"),
      nextAction: "加入选题池、转脚本车间或转创意车间。"
    };
  }

  function getCommunityFeed() {
    const channel = currentCommunityChannel();
    const source = referencePool();
    const matched = source
      .filter(isDisplayableItem)
      .filter((item) => hasPlatformViralSignal(item) || hasBrandNewsSignal(item) || /(知乎|豆瓣|天涯|社区|评论|讨论|OpenAI|新媒体|抖音|小红书)/i.test(`${item.title || ""} ${item.summary || ""} ${item.sourceName || ""}`))
      .map(communitySignalFromReference)
      .filter((item) => {
        if (channel === "brand") return /品牌|新媒体/.test(item.platform);
        if (channel === "douyin") return item.platform === "抖音";
        if (channel === "xiaohongshu") return item.platform === "小红书";
        if (channel === "community") return /社区|知乎|豆瓣|天涯|OpenAI/i.test(item.platform);
        return true;
      })
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 18);
    return [...localList("communityItems"), ...matched];
  }

  function renderCommunityFeedItem(item) {
    return `
      <article class="community-post-card">
        <div class="community-post-head">
          <span>${escapeHtml(item.layer || item.platform)}</span>
          <b>热度 ${escapeHtml(item.heat || "--")}</b>
        </div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.summary)}</p>
        <div class="community-post-meta">
          <span>${escapeHtml(item.sentiment)}</span>
          <span>${escapeHtml(item.reason)}</span>
        </div>
        <ul class="insight-list">
          <li>评论洞察：${escapeHtml(item.commentInsight)}</li>
          <li>品牌机会：${escapeHtml(item.opportunity)}</li>
          <li>风险点：${escapeHtml(item.risk)}</li>
        </ul>
        <div class="button-row">
          ${item.sourceUrl && item.sourceUrl !== "#" ? `<a class="ghost-button" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">看原信号</a>` : ""}
          <button class="ghost-button" data-action="community-to-idea" data-community-id="${escapeHtml(item.id)}">加入选题池</button>
          <button class="ghost-button" data-action="community-to-script" data-community-id="${escapeHtml(item.id)}">转入脚本车间</button>
          <button class="ghost-button" data-action="community-to-workshop" data-community-id="${escapeHtml(item.id)}">转入创意车间</button>
        </div>
      </article>`;
  }

  function setCommunityChannel(el) {
    saveLocalState({ communityChannel: el.dataset.channel || "all" });
    render();
  }

  async function syncCommunityFeed(el) {
    if (el.disabled) return;
    el.disabled = true;
    try {
      const latestPool = await fetchJson("./data/fresh-content/reference-pool.json?t=" + Date.now(), []);
      if (Array.isArray(latestPool)) {
        memory.pool = latestPool;
        toast("已同步本地公开参考池，社区信息流已更新。");
        render();
      } else {
        toast("同步失败：参考池格式不可用。");
      }
    } finally {
      el.disabled = false;
    }
  }

  function shortText(value, length = 78) {
    const text = cleanText(value);
    return text.length > length ? `${text.slice(0, length)}...` : text;
  }

  function findLocalItem(listName, id) {
    return localList(listName).find((item) => item.id === id);
  }

  function findCommunitySignal(id) {
    return localList("communityItems").find((item) => item.id === id) || getCommunityFeed().find((item) => item.id === id);
  }

  function setCreativeMode(el) {
    saveLocalState({ creativeMode: el.dataset.mode === "video" ? "video" : "image" });
    render();
    toast(`已切换到${el.dataset.mode === "video" ? "文生视频" : "文生图"}`);
  }

  function handleReferenceFiles(input) {
    const mode = input.dataset.mode === "video" ? "video" : "image";
    const key = creativeReferenceKey(mode);
    const current = currentCreativeReferences(mode);
    const files = Array.from(input.files || []).filter((file) => file && file.type.startsWith("image/"));
    if (!files.length) return;
    const slots = Math.max(0, 3 - current.length);
    if (!slots) {
      toast("最多只能添加 3 张参考图。");
      return;
    }
    const selected = files.slice(0, slots);
    Promise.all(selected.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: makeLocalId("ref"),
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: String(reader.result || ""),
        createdAt: new Date().toISOString()
      });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    }))).then((items) => {
      const next = [...current, ...items.filter(Boolean)].slice(0, 3);
      saveLocalState({ [key]: next });
      render();
      toast(`已添加 ${next.length}/3 张本地参考图，用于生成成品的视觉约束。`);
    });
  }

  function removeReferenceImage(el) {
    const mode = el.dataset.mode === "video" ? "video" : "image";
    const key = creativeReferenceKey(mode);
    const next = currentCreativeReferences(mode).filter((item) => item.id !== el.dataset.refId);
    saveLocalState({ [key]: next });
    render();
    toast("已移除参考图。");
  }

  function referenceInfluence(mode, references) {
    if (!references.length) return "未添加参考图，本次只基于文字输入生成成品。";
    const names = references.map((item) => item.name || "参考图").join("、");
    if (mode === "video") {
      return `已纳入 ${references.length} 张本地参考图：${names}。专家分析会借鉴其主体、色调和构图，用于分镜、B-roll、封面帧和字幕信息层级建议；这些图片未上传模型。`;
    }
    return `已纳入 ${references.length} 张本地参考图：${names}。Prompt 会借鉴其主体、构图、色调和视觉密度，用于封面/海报方向；这些图片未上传模型。`;
  }

  async function generateCreative(el) {
    const mode = el.dataset.mode === "video" ? "video" : "image";
    const input = cleanText(document.getElementById("creativeInput") && document.getElementById("creativeInput").value);
    if (!input) return toast("请先输入选题、脚本、产品信息或品牌案例。");
    if (el.disabled) return;
    const style = selectedChoiceValue("creativeStyle", mode === "video" ? "高能快剪" : "潮流杂志");
    const platform = selectedChoiceValue("creativePlatform", "通用");
    const use = selectedChoiceValue("creativeUse", mode === "video" ? "30s 快闪" : "封面");
    const references = currentCreativeReferences(mode);
    const referenceNote = referenceInfluence(mode, references);
    const title = `${mode === "video" ? "视频成品" : "图片成品"}：${shortText(input, 32)}`;
    const analysis = mode === "video"
      ? `前 3 秒需要直接抛冲突或结论；中段保留一个案例动作和一个商业判断；删掉铺垫形容词，补充 B-roll：产品/场景/评论区/数据卡。${references.length ? " 参考图用于统一主体、色调和封面帧。" : ""}`
      : `核心观点需要落在一个视觉中心；情绪钩子适合用“对比、冲突、结果”表达；避免空泛科技词，推荐方向：强标题封面、案例拆解海报、品牌质感图。${references.length ? " 参考图用于约束主体、构图和色调。" : ""}`;
    const prompt = mode === "video"
      ? `HyperFrames 渲染｜${use}｜${style}｜${platform}：开场大字钩子 -> 案例画面/信息卡 -> 三段观点字幕 -> 行动建议收束。字幕重点：为什么现在做、用户情绪、品牌可复制动作。转场：快速推拉、卡片滑入、数据闪白。${references.length ? "参考图约束：主体连续、色调统一、封面帧沿用参考构图。" : ""}`
      : `Image prompt｜${use}｜${style}｜${platform}：中文大标题，真实内容运营中台感，品牌增长视角，清晰信息层级，主体视觉聚焦“${shortText(input, 24)}”，深蓝科技质感，高对比，避免侵权人物和受保护素材复刻。${references.length ? "参考图约束：借鉴主体、构图、色调与视觉密度，不复刻受保护素材。" : ""}`;
    const job = {
      id: makeLocalId("creative"),
      mode,
      title,
      input,
      style,
      platform,
      use,
      analysis,
      prompt,
      referenceNote,
      referenceCount: references.length,
      referenceNames: references.map((item) => item.name || "参考图"),
      platformAdvice: `${platform}版本：首屏先给结论，标题少于 18 字，保留品牌判断和用户动作，不直接搬运外部原文。`,
      status: "running",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveLocalState({ creativeJobs: [job, ...localList("creativeJobs")].slice(0, 30), creativeSeed: input });
    render();
    toast(mode === "video" ? "开始渲染 HyperFrames 视频..." : "开始生成图片...");
    el.disabled = true;
    try {
      const endpoint = mode === "video" ? "/api/creative/video" : "/api/creative/image";
      const result = await postJson(endpoint, {
        input,
        style,
        platform,
        use,
        analysis,
        prompt,
        references: references.map((item) => ({ name: item.name, type: item.type, size: item.size }))
      });
      const completed = {
        ...job,
        status: "completed",
        assetUrl: result.url,
        assetPath: result.path,
        renderProjectPath: result.projectPath || "",
        model: result.model || (mode === "video" ? "hyperframes" : "image"),
        updatedAt: new Date().toISOString()
      };
      saveLocalState({ creativeJobs: [completed, ...localList("creativeJobs").filter((item) => item.id !== job.id)].slice(0, 30) });
      render();
      toast(mode === "video" ? "视频已渲染完成，右侧可播放。" : "图片已生成完成，右侧可预览。");
    } catch (error) {
      const failed = {
        ...job,
        status: "failed",
        error: error && error.message ? error.message : "生成失败",
        updatedAt: new Date().toISOString()
      };
      saveLocalState({ creativeJobs: [failed, ...localList("creativeJobs").filter((item) => item.id !== job.id)].slice(0, 30) });
      render();
      toast(mode === "video" ? "视频渲染失败，请查看右侧错误。" : "图片生成失败，请查看右侧错误。");
    } finally {
      el.disabled = false;
    }
  }

  function creativeToDistribution(el) {
    const job = findLocalItem("creativeJobs", el.dataset.jobId);
    if (!job) return toast("未找到这条创意产出。");
    if (job.status !== "completed" || !job.assetUrl) return toast("请先生成真实图片/视频成品，再加入分发。");
    const item = { id: makeLocalId("dist"), sourceId: job.id, title: job.title, summary: job.platformAdvice, platform: job.platform, type: job.mode, assetUrl: job.assetUrl, assetPath: job.assetPath || "", createdAt: new Date().toISOString(), status: "local_pending" };
    saveLocalState({ distributionQueue: [item, ...localList("distributionQueue")].slice(0, 30) });
    toast("已加入本地多平台分发队列。");
  }

  function saveCreativeAsset(el) {
    const job = findLocalItem("creativeJobs", el.dataset.jobId);
    if (!job) return toast("未找到这条创意产出。");
    if (job.status !== "completed" || !job.assetUrl) return toast("请先生成真实图片/视频成品，再保存资产。");
    const asset = { id: makeLocalId("asset"), sourceId: job.id, title: job.title, summary: job.prompt, type: job.mode === "video" ? "视频成品" : "图片成品", assetUrl: job.assetUrl, assetPath: job.assetPath || "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveLocalState({ creativeAssets: [asset, ...localList("creativeAssets")].slice(0, 50) });
    toast("已保存到浏览器本地资产库，可在内容资产库查看。");
  }

  function analyzeCommunity() {
    const raw = cleanText(document.getElementById("communityInput") && document.getElementById("communityInput").value);
    if (!raw) return toast("请先粘贴帖子、评论、链接、品牌案例或热点。");
    const platform = selectedChoiceValue("communityPlatform", "其他");
    const link = cleanText(document.getElementById("communityLink") && document.getElementById("communityLink").value);
    const title = `${platform}机会：${shortText(raw, 28)}`;
    const item = {
      id: makeLocalId("community"),
      platform,
      link,
      title,
      raw,
      summary: shortText(raw, 120),
      sentiment: /吐槽|贵|差|翻车|失望|离谱|避雷/.test(raw) ? "负面/风险情绪" : "正向/讨论情绪",
      reason: "出现了用户情绪、平台语境或品牌动作，适合转化为内容选题而不是直接搬运原文。",
      commentInsight: "优先观察评论里的重复问题、反差表达和真实使用场景。",
      opportunity: "可转成观点内容、案例拆解、短视频钩子或品牌信任资产。",
      risk: "外部内容需二次创作，发布前核验事实、来源和隐私边界。",
      nextAction: "人工筛选后转入选题池、脚本工厂或创意车间。",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveLocalState({ communityItems: [item, ...localList("communityItems")].slice(0, 50) });
    render();
    toast("已生成本地社区洞察。");
  }

  function communityToIdea(el) {
    const item = findCommunitySignal(el.dataset.communityId);
    if (!item) return toast("未找到这条社区洞察。");
    saveLocalState({ communityIdeas: [{ id: makeLocalId("idea"), title: item.title, summary: item.opportunity, sourceId: item.id, createdAt: new Date().toISOString() }, ...localList("communityIdeas")].slice(0, 30) });
    toast("已加入本地选题池，需人工确认后进入正式 Top 3。");
  }

  function communityToScript(el) {
    const item = findCommunitySignal(el.dataset.communityId);
    if (!item) return toast("未找到这条社区洞察。");
    saveLocalState({ productionQueue: [{ title: item.title, summary: item.summary, angle: "创意社区洞察", addedAt: new Date().toISOString() }, ...localList("productionQueue")].slice(0, 30) });
    toast("已转入本地脚本加工队列。");
    navigate("/production");
  }

  function communityToWorkshop(el) {
    const item = findCommunitySignal(el.dataset.communityId);
    if (!item) return toast("未找到这条社区洞察。");
    saveLocalState({ creativeSeed: `${item.title}\n${item.summary}\n品牌机会：${item.opportunity}`, creativeMode: "image" });
    toast("已转入创意车间输入区。");
    navigate("/creative-workshop");
  }

  function communitySaveAsset(el) {
    const item = findCommunitySignal(el.dataset.communityId);
    if (!item) return toast("未找到这条社区洞察。");
    saveLocalState({ creativeAssets: [{ id: makeLocalId("asset"), sourceId: item.id, title: item.title, summary: item.opportunity, type: "社区洞察", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...localList("creativeAssets")].slice(0, 50) });
    toast("已沉淀为本地社区洞察资产。");
  }

  function renderAnalytics() {
    return `
      <section class="panel">
        <div class="section-head">
          <div><h2>数据复盘</h2></div>
          <button class="primary-button" data-action="create-review">生成复盘结论</button>
        </div>
        <div class="status-strip">
          <div><span>点击率</span><strong>待录入</strong></div>
          <div><span>完播率</span><strong>待录入</strong></div>
          <div><span>互动率</span><strong>待录入</strong></div>
          <div><span>转化线索</span><strong>待录入</strong></div>
        </div>
        <div class="workbench-grid">
          <article class="workbench-card"><strong>爆款样本</strong><p>记录表现最好的内容，沉淀可复用标题、结构和视觉。</p><button class="ghost-button" data-route="/assets">沉淀到资产库</button></article>
          <article class="workbench-card"><strong>低效样本</strong><p>标记低点击、低完播或证据不足内容，避免规则污染。</p><button class="ghost-button" data-action="create-review">生成改进建议</button></article>
          <article class="workbench-card"><strong>规则建议</strong><p>这里只能提交建议，最终规则升级仍需总控批准。</p><button class="ghost-button" data-action="approve-rule">提交总控审核</button></article>
        </div>
      </section>`;
  }

  function renderSettings() {
    return `
      <section class="panel">
        <div class="section-head"><div><h2>规则与系统</h2></div></div>
        <div class="workbench-grid">
          <article class="workbench-card"><span>模型</span><strong>${escapeHtml(uiState.modelLabel || "DeepSeek L3 策略增强")}</strong><p>密钥只允许后端使用，前端不展示完整 Key。</p><button class="ghost-button" data-action="test-service">测试连接</button></article>
          <article class="workbench-card"><span>来源</span><strong>公开来源池</strong><p>新闻、平台热点和品牌案例先进入参考池，不自动生产。</p><button class="ghost-button" data-route="/intelligence">管理来源</button></article>
          <article class="workbench-card"><span>治理</span><strong>人工审批闸门</strong><p>Top 3、质检、发布和规则升级都必须人工确认。</p><button class="ghost-button" data-route="/production">查看流程</button></article>
        </div>
      </section>`;
  }

  function renderSimplePage(title, desc) {
    return `<section class="panel"><div class="section-head"><div><h2>${title}</h2></div></div><div class="empty-state">${desc}</div></section>`;
  }

  function selectedGenerationNeeds() {
    return Array.from(document.querySelectorAll(".generation-options input:checked")).map((input) => input.value);
  }

  function selectedChoiceValue(group, fallback) {
    const checked = document.querySelector(`[data-choice-group="${group}"] input:checked`);
    if (checked) return cleanText(checked.value || checked.parentElement.innerText);
    const active = document.querySelector(`[data-choice-group="${group}"] .choice-chip.active`);
    return active ? cleanText(active.dataset.choiceValue || active.innerText) : fallback;
  }

  function setChoice(el) {
    const group = el.closest("[data-choice-group]");
    if (!group) return;
    const value = cleanText(el.dataset.choiceValue || el.innerText);
    group.querySelectorAll(".choice-chip").forEach((chip) => {
      chip.classList.toggle("active", cleanText(chip.dataset.choiceValue || chip.innerText) === value);
    });
    const summary = document.querySelector(`[data-choice-summary="${group.dataset.choiceGroup}"]`);
    if (summary) summary.textContent = value;
    if (group.dataset.choiceGroup) saveLocalState({ [group.dataset.choiceGroup]: value });
    if (group.dataset.choiceGroup === "platform") saveLocalState({ productionPlatform: value });
    if (group.dataset.choiceGroup === "tone") saveLocalState({ productionTone: value });
    const fold = el.closest(".choice-fold");
    if (fold) {
      const label = fold.querySelector(".choice-fold-summary em");
      if (label) label.textContent = "已选";
    }
    toast(`已选择：${cleanText(el.dataset.choiceValue || el.innerText)}`);
  }

  function moveNewsCarousel(direction = 1) {
    const carousel = document.querySelector(".news-carousel");
    if (!carousel) return;
    const cards = Array.from(carousel.querySelectorAll(".news-card"));
    if (cards.length < 2) return;
    const currentIndex = cards.reduce((best, card, index) => {
      const distance = Math.abs(card.offsetLeft - carousel.scrollLeft);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Infinity }).index;
    const nextIndex = (currentIndex + direction + cards.length) % cards.length;
    carousel.scrollTo({ left: cards[nextIndex].offsetLeft, behavior: "auto" });
  }

  function toggleChoiceFold(el) {
    const fold = el.closest(".choice-fold");
    if (!fold) return;
    const options = fold.querySelector(".choice-fold-options");
    const label = fold.querySelector(".choice-fold-summary em");
    if (!options) return;
    const willOpen = options.hidden;
    options.hidden = !willOpen;
    fold.classList.toggle("is-open", willOpen);
    if (label) label.textContent = willOpen ? "收起" : "展开";
  }

  function startNewsCarousel() {
    window.clearInterval(newsCarouselTimer);
    const carousel = document.querySelector(".news-carousel");
    if (!carousel || carousel.querySelectorAll(".news-card").length < 2) return;
    newsCarouselTimer = window.setInterval(() => moveNewsCarousel(1), 4200);
  }

  function setRadioChoice(el) {
    const group = el.closest("[data-choice-group]");
    const input = el.matches("input") ? el : el.querySelector("input");
    if (!group || !input) return;
    const apply = () => {
      input.checked = true;
      group.querySelectorAll("label.choice-chip").forEach((chip) => {
        chip.classList.toggle("active", chip.contains(input));
      });
    };
    apply();
    window.setTimeout(apply, 0);
    toast(`已选择：${cleanText(input.value)}`);
  }

  function fillGenerationExample() {
    const input = document.getElementById("generationInput");
    if (!input) return;
    input.value = "案例：某咖啡品牌借势夏季通勤场景推出低糖新品，主打年轻白领和小红书种草人群。目标：生成小红书图文和抖音短视频脚本，强调品牌增长、用户痛点、场景钩子和可执行建议。需要同时输出风险质检和 GEO/FAQ。";
    toast("已填入示例，可以直接点立即生成。");
  }

  function firstConfirmedTopic() {
    const batch = memory.batch || {};
    const selected = [
      ...((((batch.outputs || {}).artifacts || {}).selected_ideas) || []),
      ...((memory.local.productionQueue || []).map((item) => ({ title: item.title, summary: item.summary || "" })))
    ];
    return selected[0] || {};
  }

  function resultBlock(label, body, strong = false) {
    return `<article class="result-block"><span>${escapeHtml(label)}</span>${strong ? `<strong>${escapeHtml(body)}</strong>` : `<p>${escapeHtml(body)}</p>`}</article>`;
  }

  function inferBrief(seed, platform) {
    const text = cleanText(seed);
    const brandMatch = text.match(/(?:品牌|产品|案例|为|「)([A-Za-z0-9\u4e00-\u9fa5· x×]{2,18})(?:」|借势|推出|生成|，|。| |$)/);
    const audienceMatch = text.match(/(?:目标人群|人群|面向|给)(?:：|:)?\s*([^。；;，,]{3,28})/);
    return {
      brand: cleanText(brandMatch && brandMatch[1]) || "这个品牌",
      audience: cleanText(audienceMatch && audienceMatch[1]) || "创业者、品牌操盘手和内容负责人",
      event: shortText(text.replace(/^案例[:：]?/, ""), 42),
      platform
    };
  }

  function renderGeneratedDraft() {
    const input = cleanText(document.getElementById("generationInput") && document.getElementById("generationInput").value);
    const platform = selectedChoiceValue("platform", "全平台");
    const tone = selectedChoiceValue("tone", "操盘手视角");
    const needs = selectedGenerationNeeds();
    const topic = firstConfirmedTopic();
    const seed = input || cleanText(`${topic.title || ""} ${topic.summary || ""}`) || "围绕当前已确认选题，输出一版可直接进入修改的内容草稿。";
    const result = document.getElementById("generationResult");
    if (!result) return;
    const brief = inferBrief(seed, platform);
    const core = shortText(brief.event, 58);
    const blocks = [
      resultBlock("标题", `${brief.brand}这次为什么值得拆：${core}`, true)
    ];
    if (needs.includes("hook")) blocks.push(resultBlock("开头钩子", `${brief.audience}最该看的不是“${brief.brand}火没火”，而是它把哪个用户情绪变成了可转化的内容入口。`));
    if (needs.includes("script")) blocks.push(resultBlock("短视频脚本", `0-3秒：抛结论：“${brief.brand}这次不是蹭热点，而是在抢一个增长入口。” 3-15秒：交代事件：${core}。15-35秒：用${tone}拆三点：用户为什么愿意停留、平台为什么愿意分发、普通品牌能复用哪一步。35-45秒：给执行建议：把同类评论区问题整理成 3 个选题，先做一条低成本验证。`));
    if (needs.includes("xiaohongshu")) blocks.push(resultBlock("小红书图文", `封面：${brief.brand}这次做对了什么？正文四段：我看到的动作 / ${brief.audience}为什么会被打中 / 普通品牌怎么抄作业 / 哪些表达不能照搬。`));
    if (needs.includes("visual")) blocks.push(resultBlock("视觉方案", `${platform}信息流：用“${brief.brand} + 一个强判断”做主标题，配真实案例/产品/评论区截图感素材，右侧放 3 个中文要点卡：情绪、平台、转化。`));
    if (needs.includes("geo")) blocks.push(resultBlock("GEO / FAQ", `核心问答：${brief.brand}这次说明了什么内容增长趋势？为什么适合${brief.audience}参考？中小团队如何用 1 条视频、1 张图文、1 个 FAQ 复用？`));
    if (needs.includes("platform")) blocks.push(resultBlock("平台版本", `${platform}版本：小红书突出“案例启发+可复制清单”；抖音突出“反常识开头+快节奏观点”；视频号突出“老板视角+信任背书”；公众号保留完整复盘。`));
    if (needs.includes("risk")) blocks.push(resultBlock("风险质检", `发布前核验${brief.brand}名称、事件时间、来源链接和数据口径；不承诺效果，不把平台热度等同于商业结果，不直接搬运外部标题和评论原文。`));
    result.innerHTML = blocks.join("");
    saveLocalState({ lastGeneratedDraft: { input: seed, platform, tone, needs, generatedAt: new Date().toISOString() } });
    toast("已按输入和需求生成内容草稿，结果已保存在本地状态。");
  }

  window.contentFactoryGenerateDraft = renderGeneratedDraft;
  window.contentFactoryFillExample = fillGenerationExample;
  window.contentFactorySetChoice = setChoice;
  window.contentFactoryToggleChoiceFold = toggleChoiceFold;

  function markActionDone(el, message) {
    const card = el.closest(".workbench-card,.asset-entry-card,.result-block,.panel");
    if (card) card.setAttribute("data-status", message);
    toast(message);
  }

  function copyOutput() {
    const result = document.getElementById("generationResult");
    const text = result ? result.innerText.trim() : "";
    if (!text) return toast("当前没有可复制的结果。");
    navigator.clipboard.writeText(text).then(
      () => toast("结果已复制。"),
      () => toast("复制失败，请手动选择结果文本。")
    );
  }

  function saveCurrentBatch(el) {
    const batch = memory.batch || {};
    saveLocalState({
      savedBatch: {
        id: batch.id || latestRun.run_id || "RUN-UNSET",
        currentPipelineStep: batch.currentPipelineStep || "scripts",
        savedAt: new Date().toISOString()
      }
    });
    return markActionDone(el, `已保存到浏览器本地状态：${localStateStorageKey}`);
  }

  function addToProduction(el) {
    const title = cleanText(el.dataset.topic || (el.closest("article") && el.closest("article").innerText) || "未命名选题");
    const queue = Array.isArray(memory.local.productionQueue) ? memory.local.productionQueue.slice() : [];
    if (!queue.some((item) => item.title === title)) queue.unshift({ title, addedAt: new Date().toISOString() });
    saveLocalState({ productionQueue: queue.slice(0, 30) });
    markActionDone(el, "已加入本地加工队列，可在脚本车间查看。");
    return navigate("/production");
  }

  function shuffleTopicDisplay(el) {
    localStorage.setItem(topicShuffleSeedKey, String(Date.now()));
    toast("已从今日 100 条储备中随机换一批 30 个候选。");
    render();
  }

  function handleAction(action, el) {
    if (action === "save-batch") return saveCurrentBatch(el);
    if (action === "add-to-production") return addToProduction(el);
    if (action === "refresh-news") return shuffleTopicDisplay(el);
    if (action === "copy-output") return copyOutput();
    if (action === "fill-generation-example") return fillGenerationExample();
    if (action === "generate-draft") return renderGeneratedDraft();
    if (action === "set-creative-mode") return setCreativeMode(el);
    if (action === "remove-reference-image") return removeReferenceImage(el);
    if (action === "generate-creative") return generateCreative(el);
    if (action === "creative-to-distribution") return creativeToDistribution(el);
    if (action === "creative-save-asset") return saveCreativeAsset(el);
    if (action === "analyze-community") return analyzeCommunity();
    if (action === "community-to-idea") return communityToIdea(el);
    if (action === "community-to-script") return communityToScript(el);
    if (action === "community-to-workshop") return communityToWorkshop(el);
    if (action === "community-save-asset") return communitySaveAsset(el);
    if (action === "set-community-channel") return setCommunityChannel(el);
    if (action === "sync-community-feed") return syncCommunityFeed(el);
    if (action === "toggle-choice-fold") return toggleChoiceFold(el);
    if (action === "save-batch") return markActionDone(el, "当前批次已保存到本地状态。");
    if (action === "add-to-production") { markActionDone(el, "已加入加工池：前端已记录，正式写入批次需后端保存。"); return navigate("/production"); }
    if (action === "approve-distribution") return markActionDone(el, "已标记：允许进入分发待办。");
    if (action === "adapt-platform") return markActionDone(el, "已生成平台适配待办。");
    if (action === "quality-check") return markActionDone(el, "已完成一次风险检查标记。");
    if (action === "create-review") return markActionDone(el, "已生成复盘建议草稿。");
    if (action === "approve-rule") return markActionDone(el, "已提交规则建议，等待总控确认。");
    if (action === "test-service") return markActionDone(el, "前端连接正常，DeepSeek 密钥状态请以后端为准。");
  }

  document.addEventListener("click", (event) => {
    const radioChoiceEl = event.target && event.target.closest && event.target.closest("label.choice-chip");
    if (radioChoiceEl && radioChoiceEl.querySelector("input[type='radio']")) {
      event.preventDefault();
      setRadioChoice(radioChoiceEl);
      return;
    }
    const choiceEl = event.target && event.target.closest && event.target.closest("button.choice-chip");
    if (choiceEl) {
      event.preventDefault();
      setChoice(choiceEl);
      return;
    }
    const carouselEl = event.target && event.target.closest && event.target.closest("[data-carousel-dir]");
    if (carouselEl) {
      event.preventDefault();
      event.stopPropagation();
      moveNewsCarousel(Number(carouselEl.dataset.carouselDir || 1));
      return;
    }
    const actionEl = event.target && event.target.closest && event.target.closest("[data-action]");
    if (actionEl) {
      event.preventDefault();
      handleAction(actionEl.getAttribute("data-action"), actionEl);
    }
  }, true);

  document.addEventListener("change", (event) => {
    const input = event.target && event.target.closest && event.target.closest("[data-reference-input]");
    if (input) handleReferenceFiles(input);
  });

  function renderMain() {
    const path = normalizePath(location.pathname);
    if (path === "/production") return renderProduction();
    if (path === "/intelligence") return renderIntelligence();
    if (path === "/creative-workshop") return renderCreativeWorkshop();
    if (path === "/creative-community") return renderCreativeCommunity();
    if (path === "/distribution") return renderDistribution();
    if (path === "/assets") return renderAssets();
    if (path === "/analytics" || path === "/review") return renderAnalytics();
    if (path === "/settings") return renderSettings();
    return renderDashboard();
  }

  function normalizePath(path) {
    if (!path || path === "/") return "/dashboard";
    return path;
  }

  function bindEvents() {
    document.querySelectorAll("[data-route]").forEach((el) => {
      el.addEventListener("click", () => navigate(el.getAttribute("data-route")));
    });
    document.querySelectorAll("[data-news-tab]").forEach((el) => {
      el.addEventListener("click", () => setNewsTab(el.getAttribute("data-news-tab")));
    });
    document.querySelectorAll("[data-carousel-dir]").forEach((el) => {
      el.addEventListener("click", () => moveNewsCarousel(Number(el.dataset.carouselDir || 1)));
    });
    document.querySelectorAll("[data-mode]").forEach((el) => {
      el.addEventListener("click", () => setMode(el.getAttribute("data-mode")));
    });
    document.querySelectorAll("[data-action='open-news']").forEach((el) => {
      el.addEventListener("click", () => {
        if (normalizePath(location.pathname) !== "/dashboard") navigate("/dashboard");
        setNewsTab(currentNewsTab());
      });
    });
    document.querySelectorAll("button.choice-chip").forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        setChoice(el);
      });
    });
    document.querySelectorAll(".choice-fold-summary").forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        toggleChoiceFold(el);
      });
    });
    document.querySelectorAll("button[onclick*='contentFactoryFillExample']").forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        fillGenerationExample();
      });
    });
    document.querySelectorAll("button[onclick*='contentFactoryGenerateDraft']").forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        renderGeneratedDraft();
      });
    });
    document.querySelectorAll("img[data-fallback]").forEach((img) => {
      img.addEventListener("error", () => {
        if (img.src !== img.dataset.fallback) img.src = img.dataset.fallback;
      }, { once: true });
    });
  }

  function render() {
    document.body.dataset.mode = currentMode();
    renderTopHeader();
    renderSidebar();
    try {
      mainContent.innerHTML = renderMain();
    } catch (error) {
      mainContent.innerHTML = `<section class="panel"><div class="empty-state">页面渲染失败：${escapeHtml(error && error.message ? error.message : error)}</div></section>`;
    }
    renderContextPanel();
    advancedDrawer.hidden = true;
    bindEvents();
    startNewsCarousel();
  }

  Promise.all([currentBatchPromise, summaryPromise, poolPromise, historyPromise]).then(([batch, summary, pool, history]) => {
    memory.batch = batch || {};
    memory.summary = summary || {};
    memory.pool = Array.isArray(pool) ? pool : [];
    memory.history = Array.isArray(history) ? history : [];
    render();
  });

  window.addEventListener("popstate", render);
})();



