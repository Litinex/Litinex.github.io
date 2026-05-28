(() => {
  const layout = document.querySelector(".essays-layout");
  if (!layout) return;

  const list = layout.querySelector(".essay-list");
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

  const formatDateCompact = (value) => {
    const normalized = normalizeDate(value);
    return normalized ? normalized.replaceAll("-", ".") : safeText(value);
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
    const raw = list.dataset.homeEssaysMax || layout.dataset.homeEssaysMax || "5";
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  })();

  const posts = Array.isArray(window.__BLOG_POSTS__)
    ? window.__BLOG_POSTS__.filter((post) => safeText(post?.href) && safeText(post?.title))
    : [];

  if (posts.length === 0) {
    return;
  }

  const pad2 = (n) => String(n).padStart(2, "0");

  list.innerHTML = "";

  sortNewestFirst(posts)
    .slice(0, pageSize)
    .forEach((post, index) => {
      const item = document.createElement("li");
      item.className = "essay-item";
      item.classList.toggle("is-latest", index === 0);
      item.dataset.postHref = safeText(post.href);

      const link = document.createElement("a");
      link.className = "essay-link";
      link.href = safeText(post.href);

      const indexEl = document.createElement("span");
      indexEl.className = "essay-index";
      indexEl.textContent = pad2(index + 1);

      const body = document.createElement("span");
      body.className = "essay-body";

      const meta = document.createElement("span");
      meta.className = "essay-meta";
      meta.textContent = [formatDateCompact(post.date), safeText(post.category)].filter(Boolean).join(" · ");

      const title = document.createElement("span");
      title.className = "essay-title";
      title.textContent = safeText(post.title);

      const excerpt = document.createElement("span");
      excerpt.className = "essay-excerpt";
      excerpt.textContent = safeText(post.excerpt);

      body.append(meta, title, excerpt);
      link.append(indexEl, body);
      item.appendChild(link);
      list.appendChild(item);
    });
})();
