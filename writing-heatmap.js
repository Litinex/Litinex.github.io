(() => {
  const mount = document.querySelector("[data-writing-heatmap]");
  if (!mount) return;

  const summaryEl = mount.querySelector("[data-writing-heatmap-summary]");
  const legendEl = mount.querySelector("[data-writing-heatmap-legend]");
  const monthsEl = mount.querySelector("[data-writing-heatmap-months]");
  const daysEl = mount.querySelector("[data-writing-heatmap-days]");
  const gridEl = mount.querySelector("[data-writing-heatmap-grid]");
  const tooltipEl = mount.querySelector("[data-writing-heatmap-tooltip]");

  const posts = Array.isArray(window.__BLOG_POSTS__) ? window.__BLOG_POSTS__ : [];
  if (!gridEl || posts.length === 0) {
    mount.hidden = true;
    return;
  }

  const pad2 = (value) => String(value).padStart(2, "0");

  const localTodayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  };

  const normalizeDateKey = (value) => {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return `${match[1]}-${match[2]}-${match[3]}`;
  };

  const parseKeyToUtcDate = (key) => {
    const normalized = normalizeDateKey(key);
    if (!normalized) return null;
    const [y, m, d] = normalized.split("-").map((part) => Number(part));
    if (!y || !m || !d) return null;
    const date = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const utcDateToKey = (date) => {
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  };

  const addUtcDays = (date, days) => {
    const copy = new Date(date.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  };

  const maxKey = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
  };

  const counts = new Map();
  const titlesByDate = new Map();
  let latestPostKey = null;

  posts.forEach((post) => {
    const key = normalizeDateKey(post?.date);
    if (!key) return;
    latestPostKey = maxKey(latestPostKey, key);
    counts.set(key, (counts.get(key) || 0) + 1);

    const title = String(post?.title || "").trim();
    if (title) {
      const list = titlesByDate.get(key) || [];
      list.push(title);
      titlesByDate.set(key, list);
    }
  });

  const endKey = maxKey(localTodayKey(), latestPostKey);
  const endDate = parseKeyToUtcDate(endKey);
  if (!endDate) {
    mount.hidden = true;
    return;
  }

  const rangeDays = 365;
  const rawStartDate = addUtcDays(endDate, -(rangeDays - 1));
  const rawStartKey = utcDateToKey(rawStartDate);

  const gridStartDate = (() => {
    const copy = new Date(rawStartDate.getTime());
    const dow = copy.getUTCDay(); // 0: Sun, 6: Sat
    copy.setUTCDate(copy.getUTCDate() - dow);
    return copy;
  })();

  const gridEndDate = (() => {
    const copy = new Date(endDate.getTime());
    const dow = copy.getUTCDay();
    copy.setUTCDate(copy.getUTCDate() + (6 - dow));
    return copy;
  })();

  const days = [];
  for (
    let cursor = new Date(gridStartDate.getTime());
    cursor.getTime() <= gridEndDate.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const key = utcDateToKey(cursor);
    const count = counts.get(key) || 0;
    const inRange = key >= rawStartKey && key <= endKey;
    days.push({ key, count, inRange });
  }

  const weeks = Math.ceil(days.length / 7);

  const monthLabels = new Array(weeks).fill("");
  days.forEach((day, index) => {
    if (!day.inRange) return;
    const date = parseKeyToUtcDate(day.key);
    if (!date) return;
    if (date.getUTCDate() !== 1) return;
    const weekIndex = Math.floor(index / 7);
    if (monthLabels[weekIndex]) return;
    monthLabels[weekIndex] = `${date.getUTCMonth() + 1}月`;
  });
  if (!monthLabels[0]) {
    monthLabels[0] = `${gridStartDate.getUTCMonth() + 1}月`;
  }

  const daysLabels = ["", "一", "", "三", "", "五", ""];

  const maxCount = days.reduce((max, item) => Math.max(max, item.count), 0);
  const levelForCount = (count) => {
    if (count <= 0) return 0;
    if (count >= 4) return 4;
    return count;
  };

  const totalPosts = posts.length;
  const activeDays = Array.from(counts.values()).filter((value) => value > 0).length;
  if (summaryEl) {
    summaryEl.textContent = `过去一年写了 ${totalPosts} 篇文章 · ${activeDays} 天有更新`;
  }

  if (legendEl) {
    legendEl.innerHTML = "";
    for (let i = 0; i <= 4; i += 1) {
      const swatch = document.createElement("span");
      swatch.className = `writing-heatmap-swatch writing-heatmap-level-${i}`;
      swatch.setAttribute("aria-hidden", "true");
      legendEl.appendChild(swatch);
    }
  }

  if (monthsEl) {
    monthsEl.innerHTML = "";
    monthLabels.forEach((label) => {
      const span = document.createElement("span");
      span.className = "writing-heatmap-month";
      span.textContent = label;
      monthsEl.appendChild(span);
    });
  }

  if (daysEl) {
    daysEl.innerHTML = "";
    daysLabels.forEach((label) => {
      const span = document.createElement("span");
      span.className = "writing-heatmap-weekday";
      span.textContent = label;
      daysEl.appendChild(span);
    });
  }

  gridEl.innerHTML = "";
  gridEl.style.setProperty("--writing-heatmap-weeks", String(weeks));

  days.forEach((day) => {
    const level = levelForCount(day.count);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `writing-heatmap-cell writing-heatmap-level-${level}`;
    button.dataset.date = day.key;
    button.dataset.count = String(day.count);

    if (!day.inRange) {
      button.classList.add("is-outside-range");
      button.disabled = true;
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
    } else {
      const label =
        day.count > 0
          ? `${day.key} 写了 ${day.count} 篇文章`
          : `${day.key} 没有写文章`;
      button.setAttribute("aria-label", label);
    }

    gridEl.appendChild(button);
  });

  if (!tooltipEl) return;

  function formatTooltip(dateKey, count) {
    if (!dateKey) return "";
    const safeCount = Number.isFinite(count) ? count : 0;
    if (safeCount <= 0) return `${dateKey} · 没有写文章`;

    const titles = titlesByDate.get(dateKey) || [];
    if (titles.length === 0) return `${dateKey} · 写了 ${safeCount} 篇文章`;

    const maxTitles = 3;
    const shown = titles.slice(0, maxTitles);
    const rest = titles.length - shown.length;
    const suffix = rest > 0 ? ` 等 ${titles.length} 篇` : "";
    return `${dateKey} · ${shown.join(" / ")}${suffix}`;
  }

  function hideTooltip() {
    tooltipEl.hidden = true;
    tooltipEl.textContent = "";
  }

  function showTooltipForCell(cell) {
    if (!cell || cell.disabled) return;
    const dateKey = String(cell.dataset.date || "");
    const count = Number.parseInt(String(cell.dataset.count || "0"), 10);

    tooltipEl.textContent = formatTooltip(dateKey, Number.isFinite(count) ? count : 0);
    tooltipEl.hidden = false;

    const rect = cell.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    const margin = 10;
    const preferredLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
    const clampedLeft = Math.max(margin, Math.min(window.innerWidth - tooltipRect.width - margin, preferredLeft));

    const placeAbove = rect.top - tooltipRect.height - 12 >= margin;
    const top = placeAbove ? rect.top - tooltipRect.height - 12 : rect.bottom + 12;

    tooltipEl.style.left = `${Math.round(clampedLeft)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
  }

  gridEl.addEventListener("pointerenter", (event) => {
    const cell = event.target instanceof Element ? event.target.closest(".writing-heatmap-cell") : null;
    if (!cell) return;
    showTooltipForCell(cell);
  });

  gridEl.addEventListener("pointermove", (event) => {
    const cell = event.target instanceof Element ? event.target.closest(".writing-heatmap-cell") : null;
    if (!cell) return;
    showTooltipForCell(cell);
  });

  gridEl.addEventListener("pointerleave", () => {
    hideTooltip();
  });

  gridEl.addEventListener("focusin", (event) => {
    const cell = event.target instanceof Element ? event.target.closest(".writing-heatmap-cell") : null;
    if (!cell) return;
    showTooltipForCell(cell);
  });

  gridEl.addEventListener("focusout", () => {
    hideTooltip();
  });

  window.addEventListener("scroll", hideTooltip, { passive: true });
  window.addEventListener("resize", hideTooltip);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideTooltip();
    }
  });
})();

