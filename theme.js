(() => {
  const storageKey = "preferred-theme";
  const root = document.documentElement;
  const buttons = Array.from(document.querySelectorAll("[data-theme-toggle]"));
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function currentTheme() {
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function setTheme(theme, persist = true) {
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
      button.setAttribute("aria-pressed", String(theme === "dark"));

      if (label) {
        label.textContent = theme === "dark" ? "明亮模式" : "暗黑模式";
      }
    });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  });

  setTheme(currentTheme(), false);

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
