(() => {
  if (!document.body.classList.contains("article-page")) return;

  const safeText = (value) => (typeof value === "string" ? value.trim() : "");

  const posts = Array.isArray(window.__BLOG_POSTS__)
    ? window.__BLOG_POSTS__.filter((post) => safeText(post?.href) && safeText(post?.title))
    : [];

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

  function seriesIndex(post) {
    const raw = post?.series?.index;
    const parsed = Number.isFinite(raw) ? raw : Number.parseInt(String(raw || ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sortOldestFirst(items) {
    return items.slice().sort((a, b) => {
      const dateDiff = dateValue(a?.date) - dateValue(b?.date);
      if (dateDiff !== 0) return dateDiff;

      const aSeries = safeText(a?.series?.id);
      const bSeries = safeText(b?.series?.id);
      if (aSeries && aSeries === bSeries) {
        return seriesIndex(a) - seriesIndex(b);
      }

      return safeText(a?.title).localeCompare(safeText(b?.title), "zh-Hans-CN");
    });
  }

  function currentPostKey() {
    const pathname = String(window.location?.pathname || "").replace(/\\/g, "/");
    const file = pathname.split("/").filter(Boolean).pop() || "";
    return file.endsWith(".html") ? `posts/${file}` : "";
  }

  function postLinkFromHere(post) {
    const href = safeText(post?.href);
    if (!href) return "";

    const pathname = String(window.location?.pathname || "").replace(/\\/g, "/");
    const inPostsDirectory = pathname.includes("/posts/");
    if (!inPostsDirectory) return href;

    const file = href.split("/").filter(Boolean).pop();
    return file || href;
  }

  function renderArticlePagination() {
    if (posts.length === 0) return;

    const nav = document.querySelector(".article-pagination");
    if (!nav) return;

    const ordered = sortOldestFirst(posts);
    const currentHref = currentPostKey();
    const currentIndex = ordered.findIndex((post) => safeText(post.href) === currentHref);
    if (currentIndex < 0) return;

    const previousPost = ordered[currentIndex - 1] || null;
    const nextPost = ordered[currentIndex + 1] || null;

    function buildLink(post, direction) {
      const isPrevious = direction === "prev";
      const className = `article-pagination-link article-pagination-link-${isPrevious ? "prev" : "next"}`;
      const arrow = document.createElement("span");
      arrow.className = "article-pagination-link-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = isPrevious ? "←" : "→";

      const text = document.createElement("span");
      text.className = "article-pagination-link-text";

      if (!post) {
        const disabled = document.createElement("span");
        disabled.className = `${className} is-disabled`;
        disabled.setAttribute("aria-disabled", "true");
        text.textContent = isPrevious ? "已经是最早一篇" : "已经是最新一篇";
        disabled.append(arrow, text);
        if (!isPrevious) {
          disabled.append(text, arrow);
        }
        return disabled;
      }

      const link = document.createElement("a");
      link.className = className;
      link.href = postLinkFromHere(post);
      text.textContent = `${isPrevious ? "上一篇" : "下一篇"}：${safeText(post.title)}`;

      if (isPrevious) {
        link.append(arrow, text);
      } else {
        link.append(text, arrow);
      }

      return link;
    }

    nav.innerHTML = "";
    nav.append(buildLink(previousPost, "prev"), buildLink(nextPost, "next"));
  }

  function renderReadingProgress() {
    if (document.querySelector("[data-reading-progress]")) return;

    const progress = document.createElement("div");
    progress.className = "article-read-progress";
    progress.setAttribute("aria-hidden", "true");
    progress.setAttribute("data-reading-progress", "");

    const bar = document.createElement("span");
    progress.appendChild(bar);
    document.body.prepend(progress);

    let ticking = false;

    function update() {
      ticking = false;
      const root = document.documentElement;
      const scrollTop = window.scrollY || root.scrollTop || 0;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, scrollTop / max));
      bar.style.transform = `scaleX(${ratio})`;
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
  }

  function slugBase(text) {
    return safeText(text)
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
  }

  function ensureUniqueId(element, text, usedIds, fallbackIndex) {
    const existing = safeText(element.id);
    if (existing) {
      usedIds.add(existing);
      return existing;
    }

    const base = slugBase(text) || `section-${fallbackIndex + 1}`;
    let id = base;
    let counter = 2;
    while (usedIds.has(id) || document.getElementById(id)) {
      id = `${base}-${counter}`;
      counter += 1;
    }

    element.id = id;
    usedIds.add(id);
    return id;
  }

  function isStrongOnlyParagraph(element) {
    if (!element || element.tagName !== "P") return false;
    const children = Array.from(element.children);
    if (children.length !== 1 || children[0].tagName !== "STRONG") return false;
    return safeText(element.textContent).length > 0;
  }

  function strongParagraphLevel(text) {
    return /^\d+\s*[.．、]/.test(safeText(text)) ? 3 : 2;
  }

  function collectTocTargets(articleBody) {
    const targets = [];

    Array.from(articleBody.children).forEach((element) => {
      if (/^H[2-6]$/.test(element.tagName)) {
        targets.push({
          element,
          text: safeText(element.textContent),
          level: Number(element.tagName.slice(1)),
        });
        return;
      }

      if (isStrongOnlyParagraph(element)) {
        const text = safeText(element.textContent);
        element.classList.add("article-section-heading");
        targets.push({
          element,
          text,
          level: strongParagraphLevel(text),
        });
      }
    });

    return targets.filter((target) => target.text);
  }

  async function copyToClipboard(text) {
    const value = safeText(text);
    if (!value) return false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        // Fall through to the legacy path.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";

    try {
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      return Boolean(document.execCommand("copy"));
    } catch (error) {
      return false;
    } finally {
      textarea.remove();
    }
  }

  function addHeadingAnchor(target, title, id) {
    if (target.querySelector(":scope > .heading-anchor")) return;

    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${id}`;
    anchor.textContent = "#";
    anchor.setAttribute("aria-label", `复制“${title}”的小节链接`);

    anchor.addEventListener("click", async (event) => {
      event.preventDefault();
      const url = new URL(window.location.href);
      url.hash = id;
      window.history.replaceState({}, "", url.toString());

      const copied = await copyToClipboard(url.toString());
      anchor.dataset.copied = copied ? "true" : "false";
      window.setTimeout(() => {
        delete anchor.dataset.copied;
      }, 1400);
    });

    target.appendChild(anchor);
  }

  function renderTableOfContents() {
    const shell = document.querySelector(".article-shell");
    const header = document.querySelector(".article-header");
    const articleBody = document.querySelector(".article-body");
    if (!shell || !header || !articleBody) return;

    const targets = collectTocTargets(articleBody);
    if (targets.length === 0) return;

    const usedIds = new Set();
    const entries = targets.map((target, index) => {
      const id = ensureUniqueId(target.element, target.text, usedIds, index);
      addHeadingAnchor(target.element, target.text, id);
      return { ...target, id };
    });

    const toc = document.createElement("nav");
    toc.className = "article-toc";
    toc.setAttribute("aria-label", "文章目录");

    const heading = document.createElement("div");
    heading.className = "article-toc-heading";

    const kicker = document.createElement("p");
    kicker.className = "section-kicker";
    kicker.textContent = "Contents";

    const title = document.createElement("h2");
    title.className = "article-toc-title";
    title.textContent = "目录";

    heading.append(kicker, title);
    toc.appendChild(heading);

    const list = document.createElement("ol");
    list.className = "article-toc-list";

    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = `article-toc-item article-toc-level-${Math.min(Math.max(entry.level, 2), 6)}`;

      const link = document.createElement("a");
      link.href = `#${entry.id}`;
      link.textContent = entry.text;
      link.dataset.tocTarget = entry.id;

      item.appendChild(link);
      list.appendChild(item);
    });

    toc.appendChild(list);
    header.insertAdjacentElement("afterend", toc);

    const links = Array.from(toc.querySelectorAll("[data-toc-target]"));
    let ticking = false;

    function setActive(id) {
      links.forEach((link) => {
        const active = link.getAttribute("data-toc-target") === id;
        if (active) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function updateActiveLink() {
      ticking = false;
      const threshold = 120;
      let current = entries[0];

      entries.forEach((entry) => {
        const rect = entry.element.getBoundingClientRect();
        if (rect.top <= threshold) {
          current = entry;
        }
      });

      if (current) {
        setActive(current.id);
      }
    }

    function requestActiveUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveLink);
    }

    updateActiveLink();
    window.addEventListener("scroll", requestActiveUpdate, { passive: true });
    window.addEventListener("resize", requestActiveUpdate);

    if (window.location.hash) {
      const initialId = decodeURIComponent(window.location.hash.slice(1));
      const target = document.getElementById(initialId);
      if (target) {
        window.setTimeout(() => {
          target.scrollIntoView({ block: "start" });
          setActive(initialId);
        }, 0);
      }
    }
  }

  renderArticlePagination();
  renderReadingProgress();
  renderTableOfContents();
})();
