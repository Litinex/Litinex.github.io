(() => {
  const storageKey = "blog-theme";
  const root = document.documentElement;
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');

  const labels = {
    toLight: "\u5207\u6362\u5230\u4eae\u8272\u4e3b\u9898",
    toDark: "\u5207\u6362\u5230\u6697\u8272\u4e3b\u9898",
  };

  const getStoredTheme = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === "light" || stored === "dark" ? stored : "";
    } catch (error) {
      return "";
    }
  };

  const systemTheme = () => {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  };

  const applyTheme = (theme) => {
    const nextTheme = theme === "light" ? "light" : "dark";
    root.dataset.theme = nextTheme;

    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        "content",
        nextTheme === "light" ? "#f4efe5" : "#0f1117"
      );
    }

    const button = document.querySelector("[data-theme-toggle]");
    if (!button) return;

    const isLight = nextTheme === "light";
    const label = isLight ? labels.toDark : labels.toLight;
    button.setAttribute("aria-pressed", String(isLight));
    button.setAttribute("aria-label", label);
    button.title = label;
  };

  const initialTheme = getStoredTheme() || root.dataset.theme || systemTheme();
  applyTheme(initialTheme);

  const mount = () => {
    const target = document.querySelector(".header-actions, .article-toolbar");
    if (!target || target.querySelector("[data-theme-toggle]")) return;

    const button = document.createElement("button");
    button.className = "theme-toggle";
    button.type = "button";
    button.setAttribute("data-theme-toggle", "");
    button.innerHTML = `
      <span class="theme-toggle-track" aria-hidden="true">
        <span class="theme-toggle-thumb">
          <span class="theme-toggle-glyph"></span>
        </span>
      </span>
    `;
    target.appendChild(button);

    button.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "light" ? "dark" : "light";

      try {
        localStorage.setItem(storageKey, nextTheme);
      } catch (error) {
        // Theme switching should still work when storage is unavailable.
      }

      applyTheme(nextTheme);
    });

    applyTheme(root.dataset.theme);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
