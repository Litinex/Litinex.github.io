(() => {
  const STORAGE_KEY = "fuwari.learning.v1";
  const SAVE_DELAY = 1200;
  const posts = Array.isArray(window.__BLOG_POSTS__) ? window.__BLOG_POSTS__ : [];
  const safeText = (value) => (typeof value === "string" ? value.trim() : "");

  function emptyState() {
    return { version: 1, posts: {} };
  }

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.version !== 1 || typeof parsed.posts !== "object" || !parsed.posts) {
        return emptyState();
      }
      return { version: 1, posts: { ...parsed.posts } };
    } catch (error) {
      return emptyState();
    }
  }

  function writeState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  }

  function currentPost() {
    const file = String(window.location.pathname || "").replace(/\\/g, "/").split("/").pop();
    return posts.find((post) => safeText(post.href).split("/").pop() === file) || null;
  }

  function postLinkFromCurrentPage(post) {
    const href = safeText(post && post.href);
    if (!href) return "";
    return document.body.classList.contains("article-page") ? href.split("/").pop() : href;
  }

  function seriesPosts(post) {
    const seriesId = safeText(post && post.series && post.series.id);
    if (!seriesId) return [];
    return posts
      .filter((candidate) => safeText(candidate.series && candidate.series.id) === seriesId)
      .slice()
      .sort((a, b) => Number(a.series.index) - Number(b.series.index));
  }

  function completedCount(items, state) {
    return items.reduce((count, post) => count + (state.posts[post.id]?.completed ? 1 : 0), 0);
  }

  function headingAtViewport(articleBody) {
    const headings = Array.from(articleBody.querySelectorAll("h2[id], h3[id], h4[id], h5[id], h6[id], .article-section-heading[id]"));
    let current = headings[0] || null;
    headings.forEach((heading) => {
      if (heading.getBoundingClientRect().top <= 150) current = heading;
    });
    return current;
  }

  function progressRatio() {
    const root = document.documentElement;
    const max = Math.max(1, root.scrollHeight - window.innerHeight);
    return Math.min(1, Math.max(0, (window.scrollY || root.scrollTop || 0) / max));
  }

  function renderResumePrompt(post, record, header) {
    if (!record || record.completed || Number(record.progress) < 0.08 || Number(record.progress) >= 0.96) return;
    if (header.nextElementSibling?.matches("[data-resume-reading]")) return;

    const prompt = document.createElement("aside");
    prompt.className = "resume-reading-card";
    prompt.setAttribute("data-resume-reading", "");
    prompt.setAttribute("aria-label", "继续上次阅读");

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "继续上次阅读";
    const detail = document.createElement("span");
    const percent = Math.round(Number(record.progress) * 100);
    detail.textContent = record.headingTitle ? `上次读到“${record.headingTitle}” · ${percent}%` : `上次阅读进度 ${percent}%`;
    copy.append(title, detail);

    const actions = document.createElement("div");
    actions.className = "resume-reading-actions";
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "button button-primary button-compact";
    resume.textContent = "继续阅读";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "button button-secondary button-compact";
    dismiss.textContent = "从头阅读";
    actions.append(resume, dismiss);
    prompt.append(copy, actions);
    header.insertAdjacentElement("afterend", prompt);

    resume.addEventListener("click", () => {
      const heading = record.headingId ? document.getElementById(record.headingId) : null;
      if (heading) {
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({ top: max * Number(record.progress || 0), behavior: "smooth" });
      }
      prompt.remove();
    });
    dismiss.addEventListener("click", () => prompt.remove());
  }

  function renderArticleLearningCard(post, state, onToggle) {
    const pagination = document.querySelector(".article-pagination");
    if (!pagination || document.querySelector("[data-learning-card]")) return null;

    const items = seriesPosts(post);
    const record = state.posts[post.id] || {};
    const card = document.createElement("section");
    card.className = "article-learning-card";
    card.setAttribute("data-learning-card", "");

    const header = document.createElement("div");
    header.className = "article-learning-heading";
    const copy = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "section-kicker";
    kicker.textContent = items.length > 0 ? "Learning Progress" : "Reading Progress";
    const title = document.createElement("h2");
    title.textContent = items.length > 0 ? safeText(post.series.name) : "阅读记录";
    copy.append(kicker, title);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = `learning-complete-button${record.completed ? " is-complete" : ""}`;
    toggle.setAttribute("aria-pressed", record.completed ? "true" : "false");
    toggle.textContent = record.completed ? "✓ 已完成" : "标记为已完成";
    toggle.addEventListener("click", () => onToggle(!record.completed));
    header.append(copy, toggle);
    card.appendChild(header);

    if (items.length > 0) {
      const done = completedCount(items, state);
      const progress = document.createElement("div");
      progress.className = "series-learning-progress";
      const summary = document.createElement("p");
      summary.textContent = `系列进度 ${done} / ${items.length} · 当前第 ${Number(post.series.index)} 节`;
      const track = document.createElement("div");
      track.className = "series-learning-track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${safeText(post.series.name)}系列完成进度`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", String(items.length));
      track.setAttribute("aria-valuenow", String(done));
      const fill = document.createElement("span");
      fill.style.transform = `scaleX(${items.length ? done / items.length : 0})`;
      track.appendChild(fill);
      progress.append(summary, track);
      card.appendChild(progress);
    } else {
      const note = document.createElement("p");
      note.className = "article-learning-note";
      note.textContent = "完成状态仅保存在当前浏览器。";
      card.appendChild(note);
    }

    pagination.insertAdjacentElement("beforebegin", card);
    return card;
  }

  function initArticlePage() {
    const post = currentPost();
    const articleBody = document.querySelector(".article-body");
    const header = document.querySelector(".article-header");
    if (!post || !safeText(post.id) || !articleBody || !header) return;

    document.body.dataset.postId = post.id;
    articleBody.dataset.postId = post.id;
    let state = readState();
    const initialRecord = state.posts[post.id] || null;
    renderResumePrompt(post, initialRecord, header);

    let card = null;
    const renderCard = () => {
      card?.remove();
      card = renderArticleLearningCard(post, state, (completed) => {
        const existing = state.posts[post.id] || {};
        state.posts[post.id] = { ...existing, completed, lastReadAt: new Date().toISOString() };
        writeState(state);
        renderCard();
      });
    };
    renderCard();

    let saveTimer = 0;
    let hasReadingInteraction = false;
    const persist = () => {
      saveTimer = 0;
      const heading = headingAtViewport(articleBody);
      const existing = state.posts[post.id] || {};
      state.posts[post.id] = {
        ...existing,
        headingId: heading?.id || "",
        headingTitle: safeText(heading?.textContent).replace(/#$/, "").trim(),
        progress: progressRatio(),
        firstReadAt: existing.firstReadAt || new Date().toISOString(),
        lastReadAt: new Date().toISOString(),
      };
      writeState(state);
    };
    const scheduleSave = () => {
      hasReadingInteraction = true;
      if (saveTimer) return;
      saveTimer = window.setTimeout(persist, SAVE_DELAY);
    };

    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.addEventListener("pagehide", () => {
      if (hasReadingInteraction) persist();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && hasReadingInteraction) persist();
    });
  }

  function renderHomepageContinueCard() {
    const content = document.querySelector(".home-page .content-column");
    const anchor = content?.querySelector("#activity");
    if (!content || !anchor || document.querySelector("[data-continue-learning]")) return;

    const state = readState();
    const candidates = posts
      .filter((post) => safeText(post.id) && post.series && state.posts[post.id])
      .sort((a, b) => safeText(state.posts[b.id].lastReadAt).localeCompare(safeText(state.posts[a.id].lastReadAt)));
    const current = candidates[0] || posts.find((post) => post.series && Number(post.series.index) === 1);
    if (!current) return;

    const items = seriesPosts(current);
    const done = completedCount(items, state);
    const record = state.posts[current.id] || {};
    const card = document.createElement("section");
    card.className = "content-card continue-learning-card fuwari-card";
    card.setAttribute("data-continue-learning", "");

    const heading = document.createElement("div");
    heading.className = "continue-learning-heading";
    const copy = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "section-kicker";
    kicker.textContent = candidates.length > 0 ? "Continue Learning" : "Start Learning";
    const title = document.createElement("h2");
    title.textContent = safeText(current.series.name);
    copy.append(kicker, title);
    const count = document.createElement("strong");
    count.textContent = `${done} / ${items.length}`;
    heading.append(copy, count);

    const description = document.createElement("p");
    description.className = "continue-learning-description";
    description.textContent = candidates.length > 0
      ? `继续阅读：${safeText(current.title)}${record.progress ? ` · ${Math.round(record.progress * 100)}%` : ""}`
      : `${items.length} 篇文章，从基础开始学习。`;

    const link = document.createElement("a");
    link.className = "button button-primary";
    link.href = postLinkFromCurrentPage(current);
    link.textContent = candidates.length > 0 ? "继续阅读" : "开始学习";
    card.append(heading, description, link);
    anchor.insertAdjacentElement("beforebegin", card);
  }

  if (document.body.classList.contains("article-page")) initArticlePage();
  if (document.body.classList.contains("home-page")) renderHomepageContinueCard();
})();
