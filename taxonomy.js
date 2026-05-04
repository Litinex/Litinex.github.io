(() => {
  const rawPosts = window.__BLOG_POSTS__;
  const posts = Array.isArray(rawPosts) ? rawPosts.filter(Boolean) : [];
  if (posts.length === 0) return;

  const rootPathname = String(window.location?.pathname || "").replace(/\\/g, "/");
  const inPostsDirectory = rootPathname.includes("/posts/");
  const archiveHref = inPostsDirectory ? "../archive.html" : "archive.html";

  function safeText(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizeTag(tag) {
    return safeText(tag).trim();
  }

  function uniqueStrings(items) {
    const seen = new Set();
    const result = [];
    items.forEach((item) => {
      const value = safeText(item).trim();
      if (!value) return;
      if (seen.has(value)) return;
      seen.add(value);
      result.push(value);
    });
    return result;
  }

  function formatDateCompact(isoDate) {
    const raw = safeText(isoDate).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return raw;
    return `${match[1]}.${match[2]}.${match[3]}`;
  }

  function getCurrentPostKey() {
    const pathname = String(window.location?.pathname || "").replace(/\\/g, "/");
    const segments = pathname.split("/").filter(Boolean);
    const file = segments[segments.length - 1] || "";
    if (!file.endsWith(".html")) return "";
    return `posts/${file}`;
  }

  function findPostByHref(href) {
    const key = safeText(href).trim();
    if (!key) return null;
    return posts.find((post) => safeText(post.href) === key) || null;
  }

  function postTags(post) {
    const raw = post && Array.isArray(post.tags) ? post.tags : [];
    return uniqueStrings(raw.map(normalizeTag));
  }

  function tagToQuery(tag) {
    // Keep it simple so it works with the existing archive search:
    // we include tag chips as plain text inside list items.
    return encodeURIComponent(normalizeTag(tag));
  }

  function seriesMeta(post) {
    const raw = post?.series;
    if (!raw || typeof raw !== "object") return null;
    const id = safeText(raw.id).trim();
    const name = safeText(raw.name).trim();
    const index = Number.isFinite(raw.index) ? Math.trunc(raw.index) : Number.parseInt(String(raw.index || ""), 10);
    if (!id || !name || !Number.isFinite(index) || index <= 0) return null;
    return { id, name, index };
  }

  function seriesPosts(seriesId) {
    const id = safeText(seriesId).trim();
    if (!id) return [];
    const matches = posts
      .map((post) => {
        const meta = seriesMeta(post);
        if (!meta || meta.id !== id) return null;
        return { post, index: meta.index };
      })
      .filter(Boolean);

    matches.sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      // Fallback to newest first if same index.
      const ad = safeText(a.post?.date);
      const bd = safeText(b.post?.date);
      if (ad !== bd) return bd.localeCompare(ad);
      return safeText(a.post?.title).localeCompare(safeText(b.post?.title));
    });

    return matches.map((item) => item.post);
  }

  function postLinkFromHere(post) {
    const href = safeText(post?.href);
    if (!href) return "";
    if (!inPostsDirectory) return href;
    const file = href.split("/").filter(Boolean).pop();
    return file ? file : href;
  }

  function buildTagChip(tag, { hrefPrefix = "" } = {}) {
    const label = normalizeTag(tag);
    if (!label) return null;
    const link = document.createElement("a");
    link.className = "tag-chip";
    link.href = `${hrefPrefix}${archiveHref}?q=${tagToQuery(label)}`;
    link.textContent = label;
    link.setAttribute("data-tag", label);
    return link;
  }

  function renderArticleTaxonomy() {
    if (!document.body.classList.contains("article-page")) return;

    const currentKey = getCurrentPostKey();
    const currentPost = findPostByHref(currentKey);
    if (!currentPost) return;

    const header = document.querySelector(".article-header");
    const metaLine = header?.querySelector(".meta");
    if (!header) return;

    const tags = postTags(currentPost);
    const series = seriesMeta(currentPost);

    if (!series && tags.length === 0) {
      return;
    }

    const taxonomy = document.createElement("div");
    taxonomy.className = "article-taxonomy";
    taxonomy.setAttribute("data-article-taxonomy", "");

    if (series) {
      const seriesList = seriesPosts(series.id);
      const total = seriesList.length;
      const seriesRow = document.createElement("div");
      seriesRow.className = "article-series-row";

      const label = document.createElement("span");
      label.className = "article-series-label";
      label.textContent = "系列";

      const nameLink = document.createElement("a");
      nameLink.className = "article-series-name";
      nameLink.href = `${archiveHref}?q=${encodeURIComponent(series.name)}`;
      nameLink.textContent = series.name;

      const progress = document.createElement("span");
      progress.className = "article-series-progress";
      progress.textContent = `第 ${series.index} 篇 / 共 ${total} 篇`;

      seriesRow.append(label, nameLink, progress);
      taxonomy.appendChild(seriesRow);
    }

    if (tags.length > 0) {
      const tagsRow = document.createElement("div");
      tagsRow.className = "article-tags-row";

      const tagsLabel = document.createElement("span");
      tagsLabel.className = "article-tags-label";
      tagsLabel.textContent = "标签";
      tagsRow.appendChild(tagsLabel);

      const list = document.createElement("div");
      list.className = "tag-list";
      tags.forEach((tag) => {
        const chip = buildTagChip(tag);
        if (chip) list.appendChild(chip);
      });
      tagsRow.appendChild(list);

      taxonomy.appendChild(tagsRow);
    }

    if (metaLine && typeof metaLine.insertAdjacentElement === "function") {
      metaLine.insertAdjacentElement("afterend", taxonomy);
    } else {
      header.appendChild(taxonomy);
    }

    if (series) {
      renderSeriesCard({ currentPost, series });
    }

    renderRelatedPosts({ currentPost });
  }

  function renderSeriesCard({ currentPost, series }) {
    const shell = document.querySelector(".article-shell");
    const pagination = shell?.querySelector(".article-pagination");
    if (!shell) return;

    const seriesList = seriesPosts(series.id);
    if (seriesList.length <= 1) return;

    const currentIndex = seriesList.findIndex((p) => safeText(p.href) === safeText(currentPost.href));
    if (currentIndex < 0) return;

    const card = document.createElement("section");
    card.className = "article-series-card";
    card.setAttribute("aria-label", "系列阅读");
    card.setAttribute("data-series-card", "");

    const heading = document.createElement("div");
    heading.className = "article-series-card-heading";
    heading.innerHTML = `
      <p class="section-kicker">Series</p>
      <h2 class="article-series-card-title">系列阅读</h2>
    `;
    card.appendChild(heading);

    const nav = document.createElement("div");
    nav.className = "article-series-nav";

    const prev = seriesList[currentIndex - 1] || null;
    const next = seriesList[currentIndex + 1] || null;

    const buildNavLink = (post, direction) => {
      if (!post) {
        const span = document.createElement("span");
        span.className = "article-series-nav-link is-disabled";
        span.setAttribute("aria-disabled", "true");
        span.textContent = direction === "prev" ? "本篇是系列第一篇" : "本篇是系列最后一篇";
        return span;
      }

      const link = document.createElement("a");
      link.className = `article-series-nav-link article-series-nav-link-${direction}`;
      link.href = postLinkFromHere(post);
      link.innerHTML = `
        <span class="article-series-nav-kicker">${direction === "prev" ? "上一篇" : "下一篇"}</span>
        <span class="article-series-nav-title">${safeText(post.title)}</span>
      `;
      return link;
    };

    nav.append(buildNavLink(prev, "prev"), buildNavLink(next, "next"));
    card.appendChild(nav);

    const list = document.createElement("ol");
    list.className = "article-series-list";
    list.setAttribute("aria-label", "系列文章列表");
    seriesList.forEach((post) => {
      const item = document.createElement("li");
      item.className = "article-series-list-item";
      if (safeText(post.href) === safeText(currentPost.href)) {
        item.classList.add("is-current");
      }
      const link = document.createElement("a");
      link.href = postLinkFromHere(post);
      link.textContent = safeText(post.title);
      item.appendChild(link);
      list.appendChild(item);
    });
    card.appendChild(list);

    if (pagination && typeof pagination.insertAdjacentElement === "function") {
      pagination.insertAdjacentElement("beforebegin", card);
    } else {
      shell.appendChild(card);
    }
  }

  function relatedScore(a, b) {
    // a = current, b = candidate
    if (!a || !b) return 0;
    if (safeText(a.href) && safeText(a.href) === safeText(b.href)) return 0;

    let score = 0;

    const sa = seriesMeta(a);
    const sb = seriesMeta(b);
    if (sa && sb && sa.id === sb.id) {
      score += 100;
      const distance = Math.abs(sa.index - sb.index);
      score += Math.max(0, 18 - distance * 6);
    }

    const tagsA = new Set(postTags(a).map((t) => t.toLowerCase()));
    const tagsB = postTags(b).map((t) => t.toLowerCase());
    const shared = tagsB.filter((t) => tagsA.has(t)).length;
    score += shared * 20;

    if (safeText(a.category) && safeText(a.category) === safeText(b.category)) {
      score += 10;
    }

    return score;
  }

  function renderRelatedPosts({ currentPost }) {
    const shell = document.querySelector(".article-shell");
    const pagination = shell?.querySelector(".article-pagination");
    if (!shell || !pagination) return;

    const candidates = posts
      .filter((post) => safeText(post?.href) && safeText(post.href) !== safeText(currentPost.href))
      .map((post) => ({ post, score: relatedScore(currentPost, post) }))
      .filter((item) => item.score > 0);

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ad = safeText(a.post?.date);
      const bd = safeText(b.post?.date);
      if (ad !== bd) return bd.localeCompare(ad);
      return safeText(a.post?.title).localeCompare(safeText(b.post?.title));
    });

    const top = candidates.slice(0, 5).map((item) => item.post);
    if (top.length === 0) return;

    const section = document.createElement("section");
    section.className = "article-related";
    section.setAttribute("aria-label", "相关文章推荐");
    section.setAttribute("data-related-posts", "");

    section.innerHTML = `
      <div class="article-related-heading">
        <p class="section-kicker">Related</p>
        <h2 class="article-related-title">相关文章</h2>
      </div>
    `;

    const list = document.createElement("ol");
    list.className = "article-related-list";
    list.setAttribute("aria-label", "相关文章列表");

    top.forEach((post) => {
      const item = document.createElement("li");
      item.className = "article-related-item";

      const link = document.createElement("a");
      link.className = "article-related-link";
      link.href = postLinkFromHere(post);

      const title = document.createElement("div");
      title.className = "article-related-titleline";
      title.textContent = safeText(post.title);

      const meta = document.createElement("div");
      meta.className = "article-related-meta";
      const date = formatDateCompact(post.date);
      const category = safeText(post.category);
      meta.textContent = [date, category].filter(Boolean).join(" · ");

      link.append(title, meta);
      item.appendChild(link);

      const tags = postTags(post);
      if (tags.length > 0) {
        const tagsEl = document.createElement("div");
        tagsEl.className = "article-related-tags tag-list";
        tags.slice(0, 5).forEach((tag) => {
          const chip = buildTagChip(tag);
          if (chip) tagsEl.appendChild(chip);
        });
        item.appendChild(tagsEl);
      }

      list.appendChild(item);
    });

    section.appendChild(list);

    pagination.insertAdjacentElement("beforebegin", section);
  }

  function renderArchiveTaxonomy() {
    const list = document.querySelector("[data-archive-list]");
    if (!list) return;

    const items = Array.from(list.querySelectorAll("li"));
    if (items.length === 0) return;

    const byHref = new Map(posts.map((post) => [safeText(post.href), post]));

    items.forEach((item) => {
      const link = item.querySelector("a[href]");
      if (!link) return;

      const rawHref = safeText(link.getAttribute("href"));
      if (!rawHref) return;

      const key = rawHref.startsWith("posts/") ? rawHref : `posts/${rawHref.split("/").pop()}`;
      const post = byHref.get(key);
      if (!post) return;

      const tags = postTags(post);
      const series = seriesMeta(post);
      if (!series && tags.length === 0) return;

      const wrap = document.createElement("div");
      wrap.className = "archive-taxonomy";

      if (series) {
        const seriesEl = document.createElement("span");
        seriesEl.className = "archive-series";
        seriesEl.textContent = `系列：${series.name}`;
        wrap.appendChild(seriesEl);
      }

      if (tags.length > 0) {
        const tagsEl = document.createElement("div");
        tagsEl.className = "archive-tags tag-list";
        tags.slice(0, 8).forEach((tag) => {
          const chip = buildTagChip(tag, { hrefPrefix: "" });
          if (chip) tagsEl.appendChild(chip);
        });
        wrap.appendChild(tagsEl);
      }

      item.appendChild(wrap);
    });

    // Let users click a tag chip to fill the search box (feels more "filter-like").
    const searchInput = document.querySelector("[data-archive-search]");
    if (searchInput) {
      list.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest("a.tag-chip") : null;
        if (!target) return;
        const tag = safeText(target.getAttribute("data-tag"));
        if (!tag) return;
        event.preventDefault();
        searchInput.value = tag;
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        try {
          searchInput.focus({ preventScroll: true });
        } catch (error) {
          searchInput.focus();
        }
      });
    }

    renderArchiveSidebarPanel(searchInput);
  }

  function renderArchiveSidebarPanel(searchInput) {
    const sidebar = document.querySelector(".archive-sidebar");
    if (!sidebar) return;
    if (sidebar.querySelector("[data-archive-taxonomy-panel]")) return;

    const anchor = sidebar.querySelector(".archive-search");
    if (!anchor) return;

    const tagCounts = new Map();
    const seriesCounts = new Map();

    posts.forEach((post) => {
      postTags(post).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });

      const meta = seriesMeta(post);
      if (!meta) return;

      const existing = seriesCounts.get(meta.id) || { id: meta.id, name: meta.name, count: 0 };
      existing.name = meta.name;
      existing.count += 1;
      seriesCounts.set(meta.id, existing);
    });

    const tagEntries = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag)));

    const seriesEntries = Array.from(seriesCounts.values()).sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)
    );

    if (tagEntries.length === 0 && seriesEntries.length === 0) return;

    const panel = document.createElement("div");
    panel.className = "archive-taxonomy-panel";
    panel.setAttribute("data-archive-taxonomy-panel", "");

    const buildBlock = (kicker, titleText) => {
      const block = document.createElement("div");
      block.className = "archive-taxonomy-block";

      const kickerEl = document.createElement("p");
      kickerEl.className = "section-kicker";
      kickerEl.textContent = kicker;

      const title = document.createElement("h3");
      title.className = "archive-taxonomy-title";
      title.textContent = titleText;

      block.append(kickerEl, title);
      return block;
    };

    if (seriesEntries.length > 0) {
      const block = buildBlock("Series", "系列");
      const list = document.createElement("div");
      list.className = "archive-taxonomy-list tag-list";

      seriesEntries.forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tag-chip tag-chip-button";
        button.setAttribute("data-taxonomy-query", entry.name);

        const text = document.createElement("span");
        text.className = "tag-chip-text";
        text.textContent = entry.name;

        const count = document.createElement("span");
        count.className = "tag-chip-count";
        count.textContent = String(entry.count);

        button.append(text, count);
        list.appendChild(button);
      });

      block.appendChild(list);
      panel.appendChild(block);
    }

    if (tagEntries.length > 0) {
      const block = buildBlock("Tags", "标签");
      const list = document.createElement("div");
      list.className = "archive-taxonomy-list tag-list";

      tagEntries.forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tag-chip tag-chip-button";
        button.setAttribute("data-taxonomy-query", entry.tag);

        const text = document.createElement("span");
        text.className = "tag-chip-text";
        text.textContent = entry.tag;

        const count = document.createElement("span");
        count.className = "tag-chip-count";
        count.textContent = String(entry.count);

        button.append(text, count);
        list.appendChild(button);
      });

      block.appendChild(list);
      panel.appendChild(block);
    }

    panel.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-taxonomy-query]") : null;
      if (!target) return;
      const query = safeText(target.getAttribute("data-taxonomy-query"));
      if (!query || !searchInput) return;
      event.preventDefault();
      searchInput.value = query;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      try {
        searchInput.focus({ preventScroll: true });
      } catch (error) {
        searchInput.focus();
      }
    });

    anchor.insertAdjacentElement("afterend", panel);
  }

  renderArchiveTaxonomy();
  renderArticleTaxonomy();
})();
