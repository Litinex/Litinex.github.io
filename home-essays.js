(() => {
  const list = document.querySelector(".essay-list");
  if (!list) return;

  const safeText = (value) => (typeof value === "string" ? value.trim() : "");

  const normalizeDate = (value) => {
    const text = safeText(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
  };

  const dateValue = (value) => {
    const normalized = normalizeDate(value);
    if (!normalized) return 0;
    const date = new Date(`${normalized}T00:00:00+08:00`);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const formatDate = (value) => {
    const normalized = normalizeDate(value);
    return normalized || safeText(value);
  };

  const seriesIndex = (post) => {
    const raw = post?.series?.index;
    const parsed = Number.isFinite(raw) ? raw : Number.parseInt(String(raw || ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sortNewestFirst = (posts) => {
    return posts.slice().sort((a, b) => {
      const dateDiff = dateValue(b?.date) - dateValue(a?.date);
      if (dateDiff !== 0) return dateDiff;

      const aSeries = safeText(a?.series?.id);
      const bSeries = safeText(b?.series?.id);
      if (aSeries && aSeries === bSeries) {
        return seriesIndex(b) - seriesIndex(a);
      }

      return safeText(a?.title).localeCompare(safeText(b?.title), "zh-Hans-CN");
    });
  };

  const pageSize = (() => {
    const raw = list.dataset.homeEssaysMax || "5";
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  })();

  const posts = Array.isArray(window.__BLOG_POSTS__)
    ? window.__BLOG_POSTS__.filter((post) => safeText(post?.href) && safeText(post?.title))
    : [];
  const postCount = document.querySelector("[data-home-post-count]");
  if (postCount) {
    postCount.textContent = String(posts.length);
  }

  if (posts.length === 0) {
    return;
  }

  // 图标用内联 SVG，避免 ▣ / ▤ / ◇ 这类字形在不同系统上被替换成方块或汉字。
  const META_ICON_PATHS = {
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    folder:
      '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };

  function createMetaIcon(name) {
    const icon = document.createElement("span");
    icon.className = "post-meta-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${META_ICON_PATHS[name] || ""}</svg>`;
    return icon;
  }

  function appendMeta(parent, text, iconName) {
    const item = document.createElement("span");
    item.className = "post-meta-item";

    const label = document.createElement("span");
    label.textContent = text;

    item.append(createMetaIcon(iconName), label);
    parent.appendChild(item);
  }

  function createTagList(tags) {
    const wrap = document.createElement("div");
    wrap.className = "post-tags tag-list";

    tags.slice(0, 4).forEach((tag) => {
      const label = safeText(tag);
      if (!label) return;

      const chip = document.createElement("a");
      chip.className = "tag-chip";
      chip.href = `archive.html?q=${encodeURIComponent(label)}`;
      chip.textContent = label;
      wrap.appendChild(chip);
    });

    return wrap;
  }

  function createPostCard(post, index) {
    const item = document.createElement("li");
    item.className = "essay-item post-card fuwari-card";
    item.classList.toggle("is-latest", index === 0);
    item.dataset.postHref = safeText(post.href);

    const card = document.createElement("div");
    card.className = "post-card-inner";

    const body = document.createElement("span");
    body.className = "post-card-body";

    const title = document.createElement("a");
    title.className = "essay-title post-card-title";
    title.href = safeText(post.href);
    title.textContent = safeText(post.title);

    const meta = document.createElement("span");
    meta.className = "essay-meta post-meta";
    appendMeta(meta, formatDate(post.date), "calendar");
    if (safeText(post.category)) {
      appendMeta(meta, safeText(post.category), "folder");
    }
    if (Number.isFinite(post.words) || Number.isFinite(post.readTime)) {
      const words = Number.isFinite(post.words) ? `${post.words} 字` : "";
      const readTime = Number.isFinite(post.readTime) ? `${post.readTime} 分钟` : "";
      appendMeta(meta, [words, readTime].filter(Boolean).join(" / "), "clock");
    }

    const excerpt = document.createElement("span");
    excerpt.className = "essay-excerpt post-card-excerpt";
    excerpt.textContent = safeText(post.excerpt);

    body.append(title, meta, excerpt);

    const tags = Array.isArray(post.tags) ? post.tags.map(safeText).filter(Boolean) : [];
    if (tags.length > 0) {
      body.appendChild(createTagList(tags));
    }

    const arrow = document.createElement("a");
    arrow.className = "post-card-arrow";
    arrow.href = safeText(post.href);
    arrow.setAttribute("aria-label", `阅读：${safeText(post.title)}`);
    arrow.textContent = "›";

    card.append(body, arrow);
    item.appendChild(card);
    return item;
  }

  list.innerHTML = "";

  sortNewestFirst(posts)
    .slice(0, pageSize)
    .forEach((post, index) => {
      list.appendChild(createPostCard(post, index));
    });
})();
