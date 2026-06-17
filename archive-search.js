(() => {
  const searchInput = document.querySelector("[data-archive-search]");
  const clearButton = document.querySelector("[data-archive-search-clear]");
  const listElement = document.querySelector("[data-archive-list]");
  const emptyElement = document.querySelector("[data-archive-empty]");
  const countElement = document.querySelector("[data-archive-search-count]");
  const paginationElement = document.querySelector("[data-archive-pagination]");
  const paginationPrev = document.querySelector("[data-archive-pagination-prev]");
  const paginationNext = document.querySelector("[data-archive-pagination-next]");
  const paginationPages = document.querySelector("[data-archive-pagination-pages]");

  if (!searchInput || !listElement) {
    return;
  }

  const safeText = (value) => (typeof value === "string" ? value.trim() : "");

  function normalizeDate(value) {
    const text = safeText(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
  }

  function dateValue(value) {
    const normalized = normalizeDate(value);
    if (!normalized) return 0;
    const date = new Date(`${normalized}T00:00:00+08:00`);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function formatDate(value) {
    const normalized = normalizeDate(value);
    return normalized || safeText(value);
  }

  function seriesIndex(post) {
    const raw = post?.series?.index;
    const parsed = Number.isFinite(raw) ? raw : Number.parseInt(String(raw || ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sortNewestFirst(posts) {
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
  }

  function appendMeta(parent, text, iconText) {
    const item = document.createElement("span");
    item.className = "post-meta-item";

    const icon = document.createElement("span");
    icon.className = "post-meta-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = iconText;

    const label = document.createElement("span");
    label.textContent = text;

    item.append(icon, label);
    parent.appendChild(item);
  }

  function createTagList(tags) {
    const wrap = document.createElement("div");
    wrap.className = "post-tags tag-list";

    tags.slice(0, 5).forEach((tag) => {
      const label = safeText(tag);
      if (!label) return;

      const chip = document.createElement("a");
      chip.className = "tag-chip";
      chip.href = `archive.html?q=${encodeURIComponent(label)}`;
      chip.textContent = label;
      chip.setAttribute("data-tag", label);
      wrap.appendChild(chip);
    });

    return wrap;
  }

  function renderArchiveListFromData() {
    const posts = Array.isArray(window.__BLOG_POSTS__)
      ? window.__BLOG_POSTS__.filter((post) => safeText(post?.href) && safeText(post?.title))
      : [];

    if (posts.length === 0) {
      return;
    }

    listElement.innerHTML = "";

    sortNewestFirst(posts).forEach((post) => {
      const item = document.createElement("li");
      item.className = "post-card fuwari-card";

      const href = safeText(post.href);
      const titleText = safeText(post.title);
      const dateText = formatDate(post.date);
      const categoryText = safeText(post.category);
      const tags = Array.isArray(post.tags) ? post.tags.map(safeText).filter(Boolean) : [];
      const seriesName = safeText(post?.series?.name);

      item.dataset.postHref = href;
      item.dataset.searchText = [
        titleText,
        normalizeDate(post.date),
        dateText,
        categoryText,
        safeText(post.excerpt),
        seriesName,
        ...tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const card = document.createElement("div");
      card.className = "post-card-inner";

      const body = document.createElement("span");
      body.className = "post-card-body";

      const title = document.createElement("a");
      title.className = "post-card-title";
      title.href = href;
      title.textContent = titleText;

      const meta = document.createElement("span");
      meta.className = "archive-meta post-meta";
      appendMeta(meta, dateText, "▣");
      if (categoryText) appendMeta(meta, categoryText, "▤");
      if (Number.isFinite(post.words) || Number.isFinite(post.readTime)) {
        const words = Number.isFinite(post.words) ? `${post.words} 字` : "";
        const readTime = Number.isFinite(post.readTime) ? `${post.readTime} 分钟` : "";
        appendMeta(meta, [words, readTime].filter(Boolean).join(" / "), "◇");
      }

      const excerpt = document.createElement("span");
      excerpt.className = "post-card-excerpt";
      excerpt.textContent = safeText(post.excerpt);

      body.append(title, meta, excerpt);

      if (tags.length > 0) {
        body.appendChild(createTagList(tags));
      }

      const arrow = document.createElement("a");
      arrow.className = "post-card-arrow";
      arrow.href = href;
      arrow.setAttribute("aria-label", `阅读：${titleText}`);
      arrow.textContent = "›";

      card.append(body, arrow);
      item.appendChild(card);
      listElement.appendChild(item);
    });
  }

  renderArchiveListFromData();

  const items = Array.from(listElement.querySelectorAll("li"));
  const itemTexts = items.map((item) => {
    const indexed = safeText(item.dataset.searchText);
    return (indexed || safeText(item.textContent)).toLowerCase();
  });
  const pageSize = (() => {
    const raw = safeText(listElement.dataset.archivePageSize);
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
  })();
  const matchedFlags = new Array(items.length).fill(true);
  let matchedCount = items.length;
  let currentPage = 1;
  let currentTokens = [];
  let currentQuery = "";

  function normalizeQuery(value) {
    return safeText(value);
  }

  function queryTokens(value) {
    return normalizeQuery(value).toLowerCase().split(/\s+/).filter(Boolean);
  }

  function setUrlState(query, page) {
    try {
      const url = new URL(window.location.href);
      const normalized = normalizeQuery(query);
      if (normalized) {
        url.searchParams.set("q", normalized);
      } else {
        url.searchParams.delete("q");
      }

      const normalizedPage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
      if (normalizedPage > 1) {
        url.searchParams.set("p", String(normalizedPage));
      } else {
        url.searchParams.delete("p");
      }

      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      // Ignore URL rewrite failures, for example when previewing by file://.
    }
  }

  function setFocus(element) {
    if (!element || typeof element.focus !== "function") {
      return;
    }

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
      return min;
    }
    return Math.min(max, Math.max(min, value));
  }

  function totalPagesFor(count) {
    if (!Number.isFinite(count) || count <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(count / pageSize));
  }

  function buildPageModel(page, totalPages) {
    if (totalPages <= 1) {
      return [];
    }

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const neighborWindow = 1;
    const left = Math.max(2, page - neighborWindow);
    const right = Math.min(totalPages - 1, page + neighborWindow);
    const model = [1];

    if (left > 2) {
      model.push("ellipsis");
    }

    for (let value = left; value <= right; value += 1) {
      model.push(value);
    }

    if (right < totalPages - 1) {
      model.push("ellipsis");
    }

    model.push(totalPages);
    return model;
  }

  function scrollToListTop() {
    if (!listElement || typeof listElement.scrollIntoView !== "function") {
      return;
    }

    try {
      listElement.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      listElement.scrollIntoView(true);
    }
  }

  function renderPagination(totalPages) {
    if (!paginationElement || !paginationPages || !paginationPrev || !paginationNext) {
      return;
    }

    paginationElement.hidden = matchedCount === 0 || totalPages <= 1;
    paginationPrev.disabled = currentPage <= 1;
    paginationNext.disabled = currentPage >= totalPages;

    paginationPages.innerHTML = "";
    const model = buildPageModel(currentPage, totalPages);

    model.forEach((token) => {
      if (token === "ellipsis") {
        const ellipsis = document.createElement("span");
        ellipsis.className = "archive-pagination-ellipsis";
        ellipsis.textContent = "…";
        ellipsis.setAttribute("aria-hidden", "true");
        paginationPages.appendChild(ellipsis);
        return;
      }

      const pageNumber = Number(token);
      if (!Number.isFinite(pageNumber)) {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "archive-page-button";
      button.textContent = String(pageNumber);
      button.setAttribute("data-archive-page", String(pageNumber));
      button.setAttribute("aria-label", `跳转到第 ${pageNumber} 页`);
      if (pageNumber === currentPage) {
        button.setAttribute("aria-current", "page");
      }
      paginationPages.appendChild(button);
    });
  }

  function applyPagination() {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize - 1;
    let visibleIndex = 0;

    items.forEach((item, index) => {
      if (!matchedFlags[index]) {
        item.hidden = true;
        return;
      }

      const shouldShow = visibleIndex >= startIndex && visibleIndex <= endIndex;
      item.hidden = !shouldShow;
      visibleIndex += 1;
    });
  }

  function renderState(options = {}) {
    const total = items.length;
    const totalPages = totalPagesFor(matchedCount);
    currentPage = clamp(currentPage, 1, totalPages);

    applyPagination();
    renderPagination(totalPages);

    if (emptyElement) {
      emptyElement.hidden = matchedCount !== 0;
    }

    if (countElement) {
      let text = currentTokens.length === 0 ? `共 ${total} 篇文章` : `找到 ${matchedCount} / ${total} 篇文章`;
      if (totalPages > 1) {
        text = `${text} · 第 ${currentPage} / ${totalPages} 页`;
      }
      countElement.textContent = text;
    }

    if (clearButton) {
      clearButton.hidden = currentTokens.length === 0;
    }

    if (options.updateUrl) {
      setUrlState(currentQuery, currentPage);
    }

    if (options.scroll) {
      scrollToListTop();
    }
  }

  function applyFilter(rawQuery, options = {}) {
    const normalized = normalizeQuery(rawQuery);
    const tokens = queryTokens(normalized);
    currentQuery = normalized;
    currentTokens = tokens;
    matchedCount = 0;

    items.forEach((item, index) => {
      const text = itemTexts[index] || "";
      const matched = tokens.length === 0 || tokens.every((token) => text.includes(token));
      matchedFlags[index] = matched;
      if (matched) {
        matchedCount += 1;
      }
    });

    if (options.resetPage) {
      currentPage = 1;
    }

    renderState({ updateUrl: true });
  }

  function goToPage(page, options = {}) {
    const totalPages = totalPagesFor(matchedCount);
    const nextPage = clamp(Math.trunc(page), 1, totalPages);
    if (nextPage === currentPage) {
      return;
    }

    currentPage = nextPage;
    renderState({ updateUrl: true, scroll: Boolean(options.scroll) });
  }

  if (clearButton) {
    clearButton.addEventListener("click", (event) => {
      event.preventDefault();
      searchInput.value = "";
      applyFilter("", { resetPage: true });
      setFocus(searchInput);
    });
  }

  searchInput.addEventListener("input", () => {
    applyFilter(searchInput.value, { resetPage: true });
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    searchInput.value = "";
    applyFilter("", { resetPage: true });
  });

  listElement.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a.tag-chip") : null;
    if (!target) return;

    const tag = safeText(target.getAttribute("data-tag") || target.textContent);
    if (!tag) return;

    event.preventDefault();
    searchInput.value = tag;
    applyFilter(tag, { resetPage: true });
    setFocus(searchInput);
  });

  if (paginationPrev) {
    paginationPrev.addEventListener("click", (event) => {
      event.preventDefault();
      goToPage(currentPage - 1, { scroll: true });
    });
  }

  if (paginationNext) {
    paginationNext.addEventListener("click", (event) => {
      event.preventDefault();
      goToPage(currentPage + 1, { scroll: true });
    });
  }

  if (paginationPages) {
    paginationPages.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("button[data-archive-page]") : null;
      if (!target) {
        return;
      }

      const pageValue = Number.parseInt(target.getAttribute("data-archive-page") || "", 10);
      if (!Number.isFinite(pageValue)) {
        return;
      }

      goToPage(pageValue, { scroll: true });
    });
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const initialPage = Number.parseInt(params.get("p") || "", 10);
    if (Number.isFinite(initialPage) && initialPage > 1) {
      currentPage = initialPage;
    }
  } catch (error) {
    // Ignore parsing failures.
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    if (initialQuery) {
      searchInput.value = initialQuery;
    }
  } catch (error) {
    // Ignore parsing failures.
  }

  applyFilter(searchInput.value);
})();
