/* =========================================================
   页面脚本：视图切换 / 导航 / 首屏动效 / 大事记 / 作品页交互
   内容全部写在 index.html 里，这里只做交互增强：
   关掉 JS 也能读到完整的文字（见 index.html 的 <noscript>）。
   ========================================================= */

/* 每个视图对应的浏览器标题 */
const TITLES = {
  home: 'LOONG STUDIO · 萌新的小工具窝',
  about: '关于我 · LOONG STUDIO',
  products: '作品集 · LOONG STUDIO'
};

/* ---------------- 首屏：进场动效只跑一次 ---------------- */

(function initHero() {
  const slide = document.querySelector('.hero-slide');
  const mission = document.querySelector('.mission');
  if (!slide) return;

  // 进场：两帧后再上类，transition 才有起点；图与文字在「同一帧」一起淡入
  const enter = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    slide.classList.add('is-active');
    if (mission) mission.classList.add('is-run');
  }));

  // ---------- 首屏背景 ----------
  // 两种模式：
  //  ① 有 data-api-bg → 用外部随机图 API（每次刷新换一张）
  //  ② 没有 data-api-bg → 从 data-local-bgs 的本地图池里随机取一张
  // 先预加载，等就绪再一起淡入（避免"图晚到、先空一阵再硬闪"）；API 失败/超时也回退本地图池。
  const api = slide.dataset.apiBg;

  // 本地图池：英文逗号分隔，可放任意多张；都没配就退回默认单张
  const LOCAL = (slide.dataset.localBgs || '/image/hero.webp')
    .split(',').map(s => s.trim()).filter(Boolean);

  let settled = false;
  let timer = null;
  const done = () => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    enter();
  };
  const setBg = url => { slide.style.backgroundImage = 'url("' + url + '")'; };

  // 随机起点；多张时记住上次用的那张，尽量不连着重复
  function pickLocal() {
    let i = Math.floor(Math.random() * LOCAL.length);
    if (LOCAL.length > 1) {
      let last = -1;
      try { last = parseInt(localStorage.getItem('ls-hero-idx'), 10); } catch (e) {}
      let guard = 0;
      while (i === last && guard++ < 12) i = Math.floor(Math.random() * LOCAL.length);
      try { localStorage.setItem('ls-hero-idx', String(i)); } catch (e) {}
    }
    return i;
  }

  // 依次试本地图：某张 404 就自动换下一张；全都不行就保持背景色、照常进场
  function loadLocal(start, step) {
    const n = step || 0;
    const url = LOCAL[(start + n) % LOCAL.length];
    const img = new Image();
    img.onload = () => { if (settled) return; setBg(url); done(); };
    img.onerror = () => {
      if (settled) return;
      if (n + 1 < LOCAL.length) loadLocal(start, n + 1);
      else done();
    };
    img.src = url;
  }

  // ② 本地模式
  if (!api) { loadLocal(pickLocal()); return; }

  // ① API 模式：成功才用 API 图；失败或 2.5s 超时回退本地图池
  let gaveUp = false;
  const fallback = () => {
    if (gaveUp || settled) return;
    gaveUp = true;
    loadLocal(pickLocal());
  };
  timer = setTimeout(fallback, 2500);

  const url = api + (api.indexOf('?') >= 0 ? '&' : '?') + 'rand=' + Date.now();
  const probe = new Image();
  probe.onload = () => { if (settled || gaveUp) return; setBg(url); done(); };
  probe.onerror = fallback;
  probe.src = url;
})();

/* ---------------- 导航：首屏透明 / 滚动实底 / 移动端菜单 ---------------- */

(function initHeader() {
  const header = document.getElementById('header');
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  if (!header) return;

  // 没有通栏大图的视图导航常驻实底
  const hasHero = !!document.querySelector('.hero');

  let lastState = null;
  let menuOpen = false;

  function onScroll() {
    const body = document.body;
    const isHome = body.classList.contains('view-home');
    const isProducts = body.classList.contains('view-products');
    // 首屏和作品页都是通栏大图，导航保持透明；其余视图实底
    // 窄屏作品页是「图在上、字在下」的浅色排版，导航改用实底，否则白字看不见
    const overImage = hasHero && (isHome || (isProducts && window.innerWidth > 900));

    let solid;
    if (!overImage || menuOpen) {
      solid = true;
    } else if (!isHome) {
      // 作品页整页都是大图，不管滚到哪都保持透明
      solid = false;
    } else {
      // 首页：上下各留一段缓冲，滚动在 20~80px 之间来回时不会反复闪
      const y = window.scrollY;
      if (y > 80) solid = true;
      else if (y < 20) solid = false;
      else solid = lastState === true;
    }

    if (solid !== lastState) {
      header.classList.toggle('is-solid', solid);
      lastState = solid;
    }
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menuOpen = open;
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
      onScroll();
    });
    nav.addEventListener('click', e => {
      // 没有二级菜单，点任何一项都只是关掉菜单交给路由处理
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        menuOpen = false;
        toggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-open');
        onScroll();
      }
    });
  }
})();

/* ---------------- 视图：/（首页）与 /works（作品页） ---------------- */

(function initViews() {
  // /about 是首页里「关于我们」那一段的别名，/products 是 /works 的旧地址
  const ROUTES = { '/': 'home', '/about': 'home', '/works': 'products', '/products': 'products' };
  const NAV_HREF = { home: null, products: '/works' };

  function viewOf(path) {
    const clean = (path || '/').replace(/\/+$/, '') || '/';
    return ROUTES[clean] || 'home';
  }

  // 手机端菜单开着时切视图，顺带把它收掉
  function closeMenu() {
    const nav = document.getElementById('nav');
    const toggle = document.getElementById('navToggle');
    if (nav && toggle && nav.classList.contains('is-open')) toggle.click();
  }

  // 导航只有 关于我们 / 作品 / 博客，主页靠左侧品牌位回
  function highlight() {
    let active = null;
    if (document.body.classList.contains('view-products')) {
      active = NAV_HREF.products;
    } else {
      const about = document.getElementById('about');
      const passed = about && about.getBoundingClientRect().top <= window.innerHeight * 0.4;
      active = passed ? '#about' : null;
    }
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('href') === active);
    });
  }

  function apply(path, hash, smooth) {
    closeMenu();

    // 直接访问 /about 时落到关于我们那一段
    if (path.replace(/\/+$/, '') === '/about' && !hash) hash = '#about';

    const view = viewOf(path);
    document.body.classList.remove('view-home', 'view-products');
    document.body.classList.add('view-' + view);

    // 标题跟着视图走：作品页 / 关于我们 / 首页各一条
    document.title = view === 'products'
      ? TITLES.products
      : (hash === '#about' ? TITLES.about : TITLES.home);

    const behavior = smooth ? 'smooth' : 'auto';
    const id = (hash || '').slice(1);
    const target = id ? document.getElementById(id) : null;

    // display 刚改过，这里读到的已经是新布局
    if (target) {
      target.scrollIntoView({ behavior, block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior });
    }

    highlight();
    window.dispatchEvent(new Event('scroll'));
  }

  function go(url, smooth) {
    const u = new URL(url, location.origin);
    const next = u.pathname + u.hash;
    if (next !== location.pathname + location.hash) {
      history.pushState(null, '', next);
    }
    apply(u.pathname, u.hash, smooth);
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href || href === '#') return;                        // 占位链接
    if (/^(https?:|mailto:|tel:)/i.test(href)) return;         // 外链
    if (href[0] !== '/' && href[0] !== '#') return;            // 相对文件名等

    // 页内锚点（关于我）：作品页里 .about 是被隐藏的，要先切回主页视图再定位
    if (href[0] === '#') {
      const id = href.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) { window.scrollTo({ top: 0, behavior: 'smooth' }); e.preventDefault(); return; }
      // 不在主页视图（如在作品页）：切回主页让 .about 显示出来，再平滑滚过去
      if (!document.body.classList.contains('view-home')) {
        if ((location.pathname.replace(/\/+$/, '') || '/') !== '/') history.pushState(null, '', '/');
        document.body.classList.remove('view-products');
        document.body.classList.add('view-home');
        document.title = TITLES.home;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      e.preventDefault();
      return;
    }

    e.preventDefault();
    go(href, true);
  });

  // 首次进入按地址栏决定视图
  apply(location.pathname, location.hash, false);

  // 主页里滚动时在「主页 / 关于我们」之间切换高亮
  let hlTick = false;
  window.addEventListener('scroll', () => {
    if (hlTick) return;
    hlTick = true;
    requestAnimationFrame(() => { hlTick = false; highlight(); });
  }, { passive: true });

  // 浏览器前进 / 后退
  window.addEventListener('popstate', () => {
    apply(location.pathname, location.hash, false);
  });
})();

/* ---------------- 大事记：横向时间轴（卡片跟着节点滑） ---------------- */

(function initTimeline() {
  const rail = document.getElementById('tlRail');
  const card = document.getElementById('tlCard');
  const sec = document.getElementById('timeline');
  if (!rail || !card || !sec) return;

  const dateEl = document.getElementById('tlDate');
  const titleEl = document.getElementById('tlTitle');
  const descEl = document.getElementById('tlDesc');

  // 年份和文案都写在 HTML 的节点上，这里只读取，不再生成 DOM
  const nodes = [...rail.querySelectorAll('.tl-node')];
  const EVENTS = nodes.map(node => ({
    year: node.dataset.year || '',
    title: node.dataset.title || '',
    desc: node.dataset.desc || '',
    placeholder: node.dataset.placeholder === '1'
  }));
  if (!EVENTS.length) return;

  const DURATION = 4200;
  let index = 0;
  let timer = null;
  let swapTimer = null;
  let inView = false;
  let hovered = false;

  // 卡片横向对齐到当前节点，并夹在整条时间轴内
  function place() {
    const node = nodes[index];
    if (!node) return;
    const wrapBox = sec.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    const center = box.left - wrapBox.left + box.width / 2;   // 节点中心（相对 .tl）
    const w = card.offsetWidth;
    const x = Math.min(Math.max(center - w / 2, 0), Math.max(0, wrapBox.width - w));
    card.style.setProperty('--x', Math.round(x) + 'px');
  }

  // 先量一遍几条里最高的那张卡，把高度定住，切换时下面的时间轴才不会上下跳
  function measure() {
    card.style.minHeight = '0px';
    let max = 0;
    EVENTS.forEach((e, i) => { render(i); max = Math.max(max, card.offsetHeight); });
    render(index);
    card.style.minHeight = max + 'px';
  }

  function render(i) {
    const e = EVENTS[i];
    dateEl.textContent = e.year;
    titleEl.textContent = e.title;
    descEl.textContent = e.desc;
    // 还没写到的年份：标题淡下去，一眼看出是占位，不是加载失败
    card.classList.toggle('is-empty', !!e.placeholder);
  }

  function setActive(i, animate) {
    index = (i + EVENTS.length) % EVENTS.length;
    nodes.forEach((n, k) => {
      n.classList.toggle('is-active', k === index);
      n.setAttribute('aria-selected', String(k === index));
    });
    place();
    if (animate === false) { render(index); return; }
    // 滑动的同时把文字淡出再淡入
    card.classList.add('is-swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      render(index);
      card.classList.remove('is-swapping');
    }, 170);
  }

  // 只有真实条目的年份才参与自动播放：目前只有 2026，就先停在 2026，
  // 以后在 HTML 里补了新年份，时间轴会自己开始往前走
  const playable = EVENTS.filter(e => !e.placeholder).length;

  function nextIndex(from) {
    for (let k = 1; k <= EVENTS.length; k++) {
      const j = (from + k) % EVENTS.length;
      if (!EVENTS[j].placeholder) return j;
    }
    return from;
  }

  function start() {
    stop();
    if (!inView || hovered || document.hidden || playable < 2) return;
    timer = setInterval(() => setActive(nextIndex(index)), DURATION);
  }
  function stop() {
    clearInterval(timer);
    timer = null;
  }

  rail.addEventListener('click', e => {
    const btn = e.target.closest('.tl-node');
    if (!btn) return;
    setActive(Number(btn.dataset.index));
    start();                       // 手动点过之后重新计时
  });

  [rail, card].forEach(el => {
    el.addEventListener('mouseenter', () => { hovered = true; stop(); });
    el.addEventListener('mouseleave', () => { hovered = false; start(); });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      entries.forEach(en => {
        inView = en.isIntersecting;
        inView ? start() : stop();
      });
    }, { threshold: 0.3 }).observe(sec);
  } else {
    inView = true;
    start();
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  let resizeTick = false;
  window.addEventListener('resize', () => {
    if (resizeTick) return;
    resizeTick = true;
    requestAnimationFrame(() => { resizeTick = false; measure(); place(); });
  });
  window.addEventListener('load', () => { measure(); place(); });

  setActive(0, false);
  measure();
  place();
  setTimeout(() => { measure(); place(); }, 400);   // 字体加载完再对一次
})();

/* ---------------- 进入视口动效 ---------------- */

(function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const siblings = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
      const delay = Math.min(siblings.indexOf(el), 6) * 60;
      setTimeout(() => el.classList.add('is-in'), delay);
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  items.forEach(el => io.observe(el));
})();

/* ---------------- 作品页：进入动效 + 右侧快速跳转 ---------------- */

(function initLinks() {
  const panels = [...document.querySelectorAll('.product')];
  const rail = document.getElementById('productRail');
  if (!panels.length || !rail) return;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    panels.forEach(p => io.observe(p));
  } else {
    panels.forEach(p => p.classList.add('is-in'));
  }

  const railItems = [...rail.querySelectorAll('.rail-item')];

  rail.addEventListener('click', e => {
    const btn = e.target.closest('.rail-item');
    if (!btn) return;
    const panel = panels[Number(btn.dataset.index)];
    // 整屏吸附的页面里用平滑滚动会一路飞过中间几屏，这里直接切到那一屏
    if (panel) panel.scrollIntoView({ behavior: 'auto', block: 'start' });
  });

  let ticking = false;
  let lastIndex = 0;
  const footer = document.querySelector('.footer');

  function update() {
    ticking = false;
    const vh = window.innerHeight;
    const mid = vh * 0.5;
    let activeIndex = -1;

    for (let i = 0; i < panels.length; i++) {
      const rect = panels[i].getBoundingClientRect();
      if (rect.top <= mid && rect.bottom > mid) { activeIndex = i; break; }
    }

    if (activeIndex !== -1) lastIndex = activeIndex;
    railItems.forEach((item, i) => item.classList.toggle('is-active', i === lastIndex));

    // 只让当前这一屏的背景在推近，其余暂停（display:none 时本来也不跑）
    const inProductsView = document.body.classList.contains('view-products');
    panels.forEach((panel, i) => {
      panel.classList.toggle('is-current', inProductsView && i === lastIndex);
    });

    const footerShown = footer && footer.offsetParent !== null;   // 作品页隐藏页脚
    const footerTop = footerShown ? footer.getBoundingClientRect().top : Infinity;
    rail.classList.toggle('is-visible', inProductsView && activeIndex !== -1 && footerTop >= vh);
  }

  // 背景视差：面板相对视口的位置决定背景位移，幅度很小，只做质感
  // 先把 rect 全读出来，再统一写 transform：
  // 边读边写会每个元素强制一次布局，六屏叠起来就是每帧六次
  const bgs = panels.map(p => p.querySelector('.product-bg'));
  let rectCache = [];

  function parallax() {
    // 首页里六块面板是 display:none，读出来全是 0，算它没意义
    if (!document.body.classList.contains('view-products')) return;
    const vh = window.innerHeight;
    for (let i = 0; i < panels.length; i++) rectCache[i] = panels[i].getBoundingClientRect();
    for (let i = 0; i < panels.length; i++) {
      const bg = bgs[i];
      const rect = rectCache[i];
      if (!bg || rect.bottom < -200 || rect.top > vh + 200) continue;
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh;  // -0.5 ~ 0.5
      bg.style.transform = `translate3d(0, ${(-progress * 54).toFixed(2)}px, 0)`;
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      parallax();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
  parallax();
})();

/* ---------------- 黑白电视 / 彩色 CRT 切换（可回退：删掉这段即可） ---------------- */

(function initBwToggle() {
  const root = document.documentElement;          // 类挂在 <html> 上，视图切换只动 <body> 不影响它
  const btn = document.getElementById('bwToggle');
  const label = btn ? btn.querySelector('.bw-toggle__text') : null;
  const KEY = 'ls-theme';

  function apply(on) {
    root.classList.toggle('theme-bw', on);
    if (btn) btn.setAttribute('aria-pressed', String(on));
    if (label) label.textContent = on ? '黑白' : '彩色';
  }

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* 隐私模式读不到就忽略 */ }
  let on = saved === 'bw';
  apply(on);

  if (btn) {
    btn.addEventListener('click', () => {
      on = !root.classList.contains('theme-bw');
      apply(on);
      try { localStorage.setItem(KEY, on ? 'bw' : 'color'); } catch (e) {}
    });
  }
})();

/* ---------------- 首屏一言：即时显示（缓存/本地）+ 后台预取，图文同时出现 ---------------- */

(function initQuote() {
  const quote = document.getElementById('missionQuote');
  const from = document.getElementById('missionFrom');
  if (!quote) return;

  // 本地兜底语录：t 正文 / f 出处（留空不显示出处）
  const FALLBACK = [
    { t: '代码写不完，就先睡觉。', f: '手记' },
    { t: '慢慢来，比较快。', f: '手记' },
    { t: '所有远方，都从脚下开始。', f: '手记' },
    { t: '别急，光会照进来的。', f: '手记' },
    { t: '热爱可抵岁月漫长。', f: '' },
    { t: '星光不问赶路人。', f: '' },
    { t: '路漫漫其修远兮，吾将上下而求索。', f: '屈原《离骚》' }
  ];

  function render(text, src) {
    quote.textContent = text;
    if (from) from.textContent = src ? '—— ' + src : '';
    alignFrom();
  }

  /* 出处贴住标题「最长那一行」的右端（通常就是第一行）：
     中文长句换行后每行长短不一，只写 text-align:right 会让落款漂到整栏最右边、
     离句子很远。这里实测所有行里最靠右的位置，再用 margin-right 把落款推回去对齐。 */
  function alignFrom() {
    if (!from || !from.textContent) return;
    from.style.marginRight = '0px';                  // 先归零，拿到整栏的右边界

    const tr = document.createRange();                // 标题：逐行一个 rect
    tr.selectNodeContents(quote);
    const lines = tr.getClientRects();
    if (!lines.length) return;

    // 取所有行里最靠右的右边界（居中排版时最长的那行才是整段文字的视觉右沿）
    let edgeRight = lines[0].right;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].right > edgeRight) edgeRight = lines[i].right;
    }

    const box = from.getBoundingClientRect();         // 落款整栏的位置
    const fr = document.createRange();                // 落款自身字宽（nowrap，必是一行）
    fr.selectNodeContents(from);
    const frs = fr.getClientRects();
    const textW = frs.length ? (frs[frs.length - 1].right - frs[0].left) : 0;

    const room = Math.max(0, box.right - edgeRight);  // 最长行右侧的空档
    const keep = Math.max(0, box.width - textW);      // 但至少要让落款自己放得下
    from.style.marginRight = Math.min(room, keep) + 'px';
  }

  // 字体加载完、窗口尺寸变化后，每行的位置都会变，重新贴一次
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(alignFrom).catch(() => {});
  }
  let alignRaf = 0;
  window.addEventListener('resize', () => {
    if (alignRaf) return;
    alignRaf = requestAnimationFrame(() => { alignRaf = 0; alignFrom(); });
  });

  // 1) 立刻显示：从「句子池」取队首 —— 保证和背景图同一帧出现
  //    池子里常备几条，所以就算接口偶尔失败、或者连着快速刷新，也能换到新句
  const KEY = 'ls-quote-pool';
  const MAX = 4;                    // 池子最多存几条待显示

  function loadPool() {
    let p = [];
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(raw)) p = raw.filter(q => q && q.t);
    } catch (e) {}
    return p;
  }
  function savePool(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p.slice(0, MAX))); } catch (e) {}
  }
  // 池子太薄就用本地语录补到 2 条；exclude 用来避开刚显示过的那句，防止连刷重复
  function topUp(p, exclude) {
    const seen = {};
    p.forEach(q => { seen[q.t] = 1; });
    if (exclude) seen[exclude] = 1;
    let guard = 0;
    while (p.length < 2 && guard++ < 40) {
      const q = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
      if (!seen[q.t]) { p.push({ t: q.t, f: q.f }); seen[q.t] = 1; }
    }
    return p;
  }

  const pool = topUp(loadPool());
  const now = pool.shift() || { t: '探索代码的无限可能', f: '' };
  render(now.t, now.f);
  savePool(topUp(pool, now.t));     // 存回剩下的，并补到至少 2 条备用

  // 2) 后台补货：新句追加到池尾，供「后续刷新」用（不当场替换，句子不会在眼前跳变）
  if (!('fetch' in window) || !('AbortController' in window)) return;
  const API = 'https://v1.hitokoto.cn/?c=a&c=c&c=e&min_length=6&max_length=18&encode=json';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  fetch(API, { signal: ctrl.signal })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (!d || !d.hitokoto) return;
      const p = topUp(loadPool());                              // 重新读，避免覆盖刚写的
      if (p.length >= MAX) return;                              // 池子满了，这条先不要
      if (p.some(q => q.t === d.hitokoto)) return;              // 去重
      p.push({ t: d.hitokoto, f: d.from || '' });
      savePool(p);
    })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
})();
