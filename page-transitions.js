(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  document.documentElement.classList.add("page-transition-ready");

  const overlay = document.createElement("div");
  overlay.className = "page-transition-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(overlay);
    window.requestAnimationFrame(() => {
      document.documentElement.classList.add("page-transition-entered");
    });
  });

  const isPlainLeftClick = (event) => {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  };

  const shouldAnimateLink = (link) => {
    if (!link || !link.href) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    if (link.dataset.noTransition === "true") return false;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return false;

    const currentPath = window.location.pathname.replace(/\/+$/, "");
    const nextPath = url.pathname.replace(/\/+$/, "");
    if (currentPath === nextPath && url.hash) return false;

    return true;
  };

  const transitionTo = (href) => {
    document.documentElement.classList.add("page-transition-leaving");
    window.setTimeout(() => {
      window.location.href = href;
    }, 210);
  };

  document.addEventListener("click", (event) => {
    if (!isPlainLeftClick(event)) return;

    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!shouldAnimateLink(link)) return;

    event.preventDefault();
    transitionTo(link.href);
  });

  document.addEventListener("submit", (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form || form.dataset.noTransition === "true") return;

    const method = String(form.method || "get").toLowerCase();
    if (method !== "get") return;

    const action = new URL(form.action || window.location.href, window.location.href);
    if (action.origin !== window.location.origin) return;

    event.preventDefault();
    const data = new FormData(form);
    const params = new URLSearchParams();
    data.forEach((value, key) => {
      const text = String(value || "").trim();
      if (text) params.append(key, text);
    });
    action.search = params.toString();
    transitionTo(action.toString());
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    document.documentElement.classList.remove("page-transition-leaving");
    document.documentElement.classList.add("page-transition-entered");
  });
})();
