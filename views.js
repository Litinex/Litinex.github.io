(() => {
  const BUSUANZI_SCRIPT_SRC =
    "https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js";

  const COUNTERS = [
    {
      name: "page_pv",
      containerId: "busuanzi_container_page_pv",
      valueId: "busuanzi_value_page_pv",
      label: "浏览量",
      enabled: () => document.body.classList.contains("article-page"),
      mount: () => document.querySelector(".article-header .meta"),
    },
    {
      name: "site_pv",
      containerId: "busuanzi_container_site_pv",
      valueId: "busuanzi_value_site_pv",
      label: "总浏览量",
      enabled: () => true,
      mount: () => document.querySelector(".site-footer p"),
    },
  ];

  function ensureCounter({ containerId, valueId, label }, mountEl) {
    if (!mountEl) return null;
    if (document.getElementById(containerId) || document.getElementById(valueId)) {
      return null;
    }

    const container = document.createElement("span");
    container.id = containerId;
    container.className = "view-count";
    container.hidden = true;

    const separator = document.createElement("span");
    separator.className = "view-count-sep";
    separator.setAttribute("aria-hidden", "true");
    separator.textContent = "·";

    const labelEl = document.createElement("span");
    labelEl.className = "view-count-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.id = valueId;
    valueEl.className = "view-count-number";
    valueEl.textContent = "--";

    container.append(separator, labelEl, valueEl);
    mountEl.appendChild(container);

    return { container, valueEl };
  }

  function loadBusuanziScript() {
    const existing = document.querySelector(
      'script[src*="busuanzi.pure.mini.js"]'
    );
    if (existing) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = BUSUANZI_SCRIPT_SRC;
    script.setAttribute("data-view-counter", "busuanzi");
    document.head.appendChild(script);
  }

  function revealWhenReady(container, valueEl) {
    const initial = valueEl.textContent;
    let attempts = 0;
    const maxAttempts = 20;
    const intervalMs = 250;

    const timer = window.setInterval(() => {
      attempts += 1;
      const value = (valueEl.textContent || "").trim();

      if (value && value !== initial) {
        container.hidden = false;
        window.clearInterval(timer);
        return;
      }

      if (attempts >= maxAttempts) {
        container.remove();
        window.clearInterval(timer);
      }
    }, intervalMs);
  }

  const mountedCounters = COUNTERS.map((counter) => {
    if (!counter.enabled()) return null;
    const mountEl = counter.mount();
    return ensureCounter(counter, mountEl);
  }).filter(Boolean);

  if (mountedCounters.length === 0) return;

  loadBusuanziScript();
  mountedCounters.forEach(({ container, valueEl }) =>
    revealWhenReady(container, valueEl)
  );
})();

