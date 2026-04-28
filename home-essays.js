(() => {
  const layout = document.querySelector(".essays-layout");
  if (!layout) return;

  const feature = layout.querySelector(".essay-feature");
  const list = layout.querySelector(".essay-list");
  if (!feature || !list) return;

  const featureMeta = feature.querySelector(".meta");
  const featureTitleLink = feature.querySelector("h3 a");
  const featureExcerpt = feature.querySelector("p:not(.meta)");
  const featureReadMore = feature.querySelector(".essay-feature-link");

  const listLinks = Array.from(list.querySelectorAll("a.essay-link"));
  if (listLinks.length === 0) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  const parseMetaDate = (metaText) => {
    const text = (metaText ?? "").trim();
    const match = text.match(/^(\d{4})[./-](\d{2})[./-](\d{2})/);
    if (!match) return null;
    const iso = `${match[1]}-${match[2]}-${match[3]}`;
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return { iso, value: date.getTime() };
  };

  const readLinkData = (link) => {
    const meta = link.querySelector(".essay-meta")?.textContent?.trim() ?? "";
    const title = link.querySelector(".essay-title")?.textContent?.trim() ?? "";
    const excerpt = link.querySelector(".essay-excerpt")?.textContent?.trim() ?? "";
    const href = link.getAttribute("href") ?? "";
    const dateInfo = parseMetaDate(meta);
    return {
      link,
      meta,
      title,
      excerpt,
      href,
      dateValue: dateInfo?.value ?? 0,
    };
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  const syncIndexes = () => {
    const items = Array.from(list.querySelectorAll(".essay-item"));
    items.forEach((item, idx) => {
      const indexEl = item.querySelector(".essay-index");
      if (indexEl) indexEl.textContent = pad2(idx + 1);
    });
  };

  const featureSet = (data) => {
    if (!data) return;
    if (!featureMeta || !featureTitleLink || !featureExcerpt || !featureReadMore) return;

    featureMeta.textContent = data.meta;
    featureTitleLink.textContent = data.title;
    featureTitleLink.setAttribute("href", data.href);
    featureExcerpt.textContent = data.excerpt;
    featureReadMore.setAttribute("href", data.href);

    if (!reduceMotion) {
      feature.classList.remove("is-switching");
      // Force reflow to restart animation.
      void feature.offsetWidth;
      feature.classList.add("is-switching");
    }
  };

  const setActive = (activeLink) => {
    const allLinks = Array.from(list.querySelectorAll("a.essay-link"));
    allLinks.forEach((link) => {
      link.removeAttribute("aria-current");
      link.closest(".essay-item")?.classList.remove("is-active");
    });

    activeLink.setAttribute("aria-current", "true");
    activeLink.closest(".essay-item")?.classList.add("is-active");
  };

  const sortByDateDesc = () => {
    const items = Array.from(list.querySelectorAll(".essay-item"));
    const models = items.map((item, originalIndex) => {
      const link = item.querySelector("a.essay-link");
      const data = link ? readLinkData(link) : null;
      return { item, data, originalIndex };
    });

    const hasAnyDate = models.some((m) => (m.data?.dateValue ?? 0) > 0);
    if (!hasAnyDate) return;

    models.sort((a, b) => {
      const av = a.data?.dateValue ?? 0;
      const bv = b.data?.dateValue ?? 0;
      if (bv !== av) return bv - av;
      return a.originalIndex - b.originalIndex;
    });

    models.forEach((m) => list.appendChild(m.item));
    syncIndexes();
  };

  sortByDateDesc();

  const linksAfterSort = Array.from(list.querySelectorAll("a.essay-link"));
  const first = linksAfterSort[0];
  if (first) {
    const firstData = readLinkData(first);
    featureSet(firstData);
    setActive(first);
  }

  // Progressive enhancement:
  // - Desktop: hover switches preview.
  // - Keyboard: focus switches preview.
  const onActivate = (event) => {
    const link = event.currentTarget;
    if (!(link instanceof HTMLAnchorElement)) return;
    const data = readLinkData(link);
    featureSet(data);
    setActive(link);
  };

  linksAfterSort.forEach((link) => {
    link.addEventListener("pointerenter", onActivate, { passive: true });
    link.addEventListener("focus", onActivate);
  });

  // Optional: arrow-key navigation in the list.
  list.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const active = list.querySelector('a.essay-link[aria-current="true"]');
    const links = Array.from(list.querySelectorAll("a.essay-link"));
    const idx = active ? links.indexOf(active) : -1;
    if (idx === -1) return;

    const nextIdx = event.key === "ArrowDown" ? Math.min(idx + 1, links.length - 1) : Math.max(idx - 1, 0);
    const next = links[nextIdx];
    if (!next) return;

    event.preventDefault();
    next.focus();
  });
})();
