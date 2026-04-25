(() => {
  const storageKey = "preferred-theme";
  const root = document.documentElement;
  const buttons = Array.from(document.querySelectorAll("[data-theme-toggle]"));
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const icons = {
    light: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2"></circle>
        <path d="M12 1.8v3.1M12 19.1v3.1M4.22 4.22l2.2 2.2M17.58 17.58l2.2 2.2M1.8 12h3.1M19.1 12h3.1M4.22 19.78l2.2-2.2M17.58 6.42l2.2-2.2"></path>
      </svg>
    `,
    dark: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.2 14.8A8.8 8.8 0 0 1 9.2 3.8a9.2 9.2 0 1 0 11 11Z"></path>
      </svg>
    `,
  };

  function currentTheme() {
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function renderGlyph(button, theme, animate = false) {
    const glyph = button.querySelector(".theme-toggle-glyph");
    if (!glyph) {
      return;
    }

    const previousTheme = button.dataset.renderedTheme;
    const nextMarkup = icons[theme];
    const shouldAnimate =
      animate &&
      previousTheme &&
      previousTheme !== theme &&
      !reduceMotionQuery.matches &&
      typeof glyph.animate === "function";

    if (!shouldAnimate) {
      glyph.innerHTML = nextMarkup;
      button.dataset.renderedTheme = theme;
      return;
    }

    const exitRotation = theme === "dark" ? 110 : -110;
    const enterRotation = theme === "dark" ? -110 : 110;

    glyph
      .animate(
        [
          { opacity: 1, transform: "rotate(0deg) scale(1)" },
          { opacity: 0, transform: `rotate(${exitRotation}deg) scale(0.58)` },
        ],
        {
          duration: 180,
          easing: "cubic-bezier(0.45, 0, 0.2, 1)",
          fill: "forwards",
        }
      )
      .finished.catch(() => {})
      .finally(() => {
        glyph.innerHTML = nextMarkup;
        button.dataset.renderedTheme = theme;
        glyph.animate(
          [
            { opacity: 0, transform: `rotate(${enterRotation}deg) scale(0.58)` },
            { opacity: 1, transform: "rotate(0deg) scale(1)" },
          ],
          {
            duration: 260,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
            fill: "forwards",
          }
        );
      });
  }

  function setTheme(theme, persist = true, animate = false) {
    root.dataset.theme = theme;

    if (persist) {
      try {
        localStorage.setItem(storageKey, theme);
      } catch (error) {
        // Ignore storage failures and still apply the theme for this session.
      }
    }

    if (metaTheme) {
      metaTheme.setAttribute("content", theme === "dark" ? "#11161f" : "#b85c38");
    }

    buttons.forEach((button) => {
      const label = button.querySelector(".theme-toggle-label");
      const nextAction = theme === "dark" ? "切换到明亮模式" : "切换到暗黑模式";
      button.setAttribute("aria-pressed", String(theme === "dark"));
      button.setAttribute("aria-label", nextAction);
      button.setAttribute("title", nextAction);
      button.dataset.themeState = theme;

      if (label) {
        label.textContent = nextAction;
      }

      renderGlyph(button, theme, animate);
    });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setTheme(currentTheme() === "dark" ? "light" : "dark", true, true);
    });
  });

  setTheme(currentTheme(), false, false);

  const handleSystemThemeChange = (event) => {
    try {
      if (!localStorage.getItem(storageKey)) {
        setTheme(event.matches ? "dark" : "light", false);
      }
    } catch (error) {
      setTheme(event.matches ? "dark" : "light", false);
    }
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleSystemThemeChange);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handleSystemThemeChange);
  }
})();
