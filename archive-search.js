(() => {
  const searchInput = document.querySelector("[data-archive-search]");
  const clearButton = document.querySelector("[data-archive-search-clear]");
  const listElement = document.querySelector("[data-archive-list]");
  const emptyElement = document.querySelector("[data-archive-empty]");
  const countElement = document.querySelector("[data-archive-search-count]");

  if (!searchInput || !listElement) {
    return;
  }

  const items = Array.from(listElement.querySelectorAll("li"));
  const itemTexts = items.map((item) => String(item.textContent || "").trim().toLowerCase());

  function normalizeQuery(value) {
    return String(value || "").trim();
  }

  function queryTokens(value) {
    return normalizeQuery(value).toLowerCase().split(/\s+/).filter(Boolean);
  }

  function setUrlQuery(value) {
    try {
      const url = new URL(window.location.href);
      const normalized = normalizeQuery(value);
      if (normalized) {
        url.searchParams.set("q", normalized);
      } else {
        url.searchParams.delete("q");
      }
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      // Ignore URL rewrite failures (e.g. file://)
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

  function applyFilter(rawQuery) {
    const normalized = normalizeQuery(rawQuery);
    const tokens = queryTokens(normalized);
    const total = items.length;
    let visibleCount = 0;

    items.forEach((item, index) => {
      const text = itemTexts[index] || "";
      const matched = tokens.length === 0 || tokens.every((token) => text.includes(token));
      item.hidden = !matched;
      if (matched) {
        visibleCount += 1;
      }
    });

    if (countElement) {
      countElement.textContent =
        tokens.length === 0 ? `共 ${total} 篇文章` : `找到 ${visibleCount} / ${total} 篇文章`;
    }

    if (clearButton) {
      clearButton.hidden = tokens.length === 0;
    }

    if (emptyElement) {
      emptyElement.hidden = visibleCount !== 0;
    }

    setUrlQuery(normalized);
  }

  if (clearButton) {
    clearButton.addEventListener("click", (event) => {
      event.preventDefault();
      searchInput.value = "";
      applyFilter("");
      setFocus(searchInput);
    });
  }

  searchInput.addEventListener("input", () => {
    applyFilter(searchInput.value);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    searchInput.value = "";
    applyFilter("");
  });

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
