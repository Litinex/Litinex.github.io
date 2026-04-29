(() => {
  const layout = document.querySelector(".essays-layout");
  if (!layout) return;

  const list = layout.querySelector(".essay-list");
  if (!list) return;

  const parseMetaDate = (metaText) => {
    const text = (metaText ?? "").trim();
    const match = text.match(/^(\d{4})[./-](\d{2})[./-](\d{2})/);
    if (!match) return null;
    const iso = `${match[1]}-${match[2]}-${match[3]}`;
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return { iso, value: date.getTime() };
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  const syncIndexes = () => {
    const items = Array.from(list.querySelectorAll(".essay-item"));
    items.forEach((item, idx) => {
      const indexEl = item.querySelector(".essay-index");
      if (indexEl) indexEl.textContent = pad2(idx + 1);
    });
  };

  const sortByDateDesc = () => {
    const items = Array.from(list.querySelectorAll(".essay-item"));
    const models = items.map((item, originalIndex) => {
      const link = item.querySelector("a.essay-link");
      const meta = link?.querySelector(".essay-meta")?.textContent?.trim() ?? "";
      const dateInfo = parseMetaDate(meta);
      return { item, dateValue: dateInfo?.value ?? 0, originalIndex };
    });

    const hasAnyDate = models.some((m) => (m.dateValue ?? 0) > 0);
    if (!hasAnyDate) return;

    models.sort((a, b) => {
      const av = a.dateValue ?? 0;
      const bv = b.dateValue ?? 0;
      if (bv !== av) return bv - av;
      return a.originalIndex - b.originalIndex;
    });

    models.forEach((m) => list.appendChild(m.item));
    syncIndexes();
  };

  sortByDateDesc();

  const markLatest = () => {
    const items = Array.from(list.querySelectorAll(".essay-item"));
    items.forEach((item, idx) => item.classList.toggle("is-latest", idx === 0));
  };

  markLatest();
})();
