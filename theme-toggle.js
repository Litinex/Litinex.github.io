(() => {
  const storageKey = "blog-theme";
  const root = document.documentElement;
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const namespace = "http://www.w3.org/2000/svg";
  const labels = { toLight: "切换到亮色主题", toDark: "切换到暗色主题" };

  function getStoredTheme() {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === "light" || stored === "dark" ? stored : "";
    } catch (error) {
      return "";
    }
  }

  const initialTheme = getStoredTheme() || root.dataset.theme ||
    (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const initialPosition = initialTheme === "light" ? 1 : 0;
  const motion = { position: initialPosition, velocity: 0, target: initialPosition, frameId: 0, lastTime: 0 };
  const pixelMotion = { position: initialPosition, velocity: 0, target: initialPosition };
  let appliedTheme = initialTheme;
  let button = null;
  let pixels = [];

  function shapePoints(shape) {
    const points = [];
    for (let row = 1; row < 14; row += 1) {
      for (let column = 1; column < 14; column += 1) {
        const x = column - 7;
        const y = row - 7;
        const distance = Math.hypot(x, y);
        const rayDistance = Math.abs(Math.sin(Math.atan2(y, x) * 4));
        const visible = shape === "moon"
          ? distance < 5.8 && Math.hypot(x - 3, y + 2) > 5.2
          : distance < 2.9 || distance === 3 || (distance > 4.2 && distance < 6.3 && rayDistance < 0.36);
        if (visible) points.push({ x: column * 2 + 1, y: row * 2 + 1 });
      }
    }
    return points;
  }

  function pairPixels(moon, sun) {
    const candidates = moon.flatMap((from, moonIndex) => sun.map((to, sunIndex) => ({
      from, to, moonIndex, sunIndex, distance: Math.hypot(to.x - from.x, to.y - from.y),
    })));
    candidates.sort((a, b) => a.distance - b.distance);
    const usedMoon = new Set();
    const usedSun = new Set();
    const pairs = [];
    for (const candidate of candidates) {
      if (usedMoon.has(candidate.moonIndex) || usedSun.has(candidate.sunIndex)) continue;
      usedMoon.add(candidate.moonIndex);
      usedSun.add(candidate.sunIndex);
      pairs.push(candidate);
      if (pairs.length === moon.length) break;
    }
    return pairs;
  }

  function createPixels(svg) {
    // Equal endpoint counts let every square keep its identity during reversal.
    return pairPixels(shapePoints("moon"), shapePoints("sun")).map((pair, index) => {
      const dot = document.createElementNS(namespace, "rect");
      dot.setAttribute("width", "1.35");
      dot.setAttribute("height", "1.35");
      dot.setAttribute("rx", "0.2");
      svg.appendChild(dot);
      const direction = pair.distance ? Math.atan2(pair.to.y - pair.from.y, pair.to.x - pair.from.x) : index * 2.4;
      const bend = pair.distance ? (index % 2 ? 1 : -1) * 2.2 : 0.8;
      return { ...pair, dot, arcX: -Math.sin(direction) * bend, arcY: Math.cos(direction) * bend, delay: index % 7 * 0.018 };
    });
  }

  function renderPixels(progress) {
    pixels.forEach((pixel) => {
      const local = Math.min(1, Math.max(0, (progress - pixel.delay) / (1 - pixel.delay)));
      const eased = local * local * (3 - 2 * local);
      const arc = 4 * eased * (1 - eased);
      const x = pixel.from.x + (pixel.to.x - pixel.from.x) * eased + pixel.arcX * arc;
      const y = pixel.from.y + (pixel.to.y - pixel.from.y) * eased + pixel.arcY * arc;
      pixel.dot.setAttribute("transform", `translate(${x.toFixed(3)} ${y.toFixed(3)})`);
    });
  }

  function renderMotion() {
    if (!button) return;
    const progress = Math.min(1, Math.max(0, motion.position));
    const visibility = progress * progress * (3 - 2 * progress);
    const pixelProgress = Math.min(1, Math.max(0, pixelMotion.position));
    button.style.setProperty("--toggle-position", motion.position.toFixed(5));
    button.style.setProperty("--toggle-mix", `${(progress * 100).toFixed(3)}%`);
    button.style.setProperty("--toggle-light", visibility.toFixed(5));
    button.style.setProperty("--toggle-pixel-mix", `${(pixelProgress * 100).toFixed(3)}%`);
    renderPixels(pixelProgress);
  }

  function settleMotion() {
    if (motion.frameId) window.cancelAnimationFrame(motion.frameId);
    motion.frameId = 0;
    motion.position = motion.target;
    motion.velocity = 0;
    pixelMotion.position = pixelMotion.target;
    pixelMotion.velocity = 0;
    renderMotion();
  }

  function advanceSpring(state, elapsed, frequency, dampingRatio) {
    const decayRate = frequency * dampingRatio;
    const dampedFrequency = frequency * Math.sqrt(1 - dampingRatio ** 2);
    const displacement = state.position - state.target;
    const decay = Math.exp(-decayRate * elapsed);
    const cosine = Math.cos(dampedFrequency * elapsed);
    const sine = Math.sin(dampedFrequency * elapsed);
    // Exact integration preserves velocity and stays stable at any refresh rate.
    state.position = state.target + decay * (
      displacement * cosine + (state.velocity + decayRate * displacement) / dampedFrequency * sine
    );
    state.velocity = decay * (
      state.velocity * cosine - (decayRate * state.velocity + frequency ** 2 * displacement) / dampedFrequency * sine
    );
  }

  function isAtRest(state) {
    return Math.abs(state.position - state.target) < 0.0005 && Math.abs(state.velocity) < 0.005;
  }

  function animateMotion(timestamp) {
    motion.frameId = 0;
    const elapsed = Math.max(0, (timestamp - motion.lastTime) / 1000);
    motion.lastTime = timestamp;
    advanceSpring(motion, elapsed, 18, 0.86);
    // The pixels finish more slowly so the rearrangement remains visible.
    advanceSpring(pixelMotion, elapsed, 10, 0.92);
    if (isAtRest(motion) && isAtRest(pixelMotion)) {
      settleMotion();
      return;
    }
    renderMotion();
    motion.frameId = window.requestAnimationFrame(animateMotion);
  }

  function applyTheme(theme, { animate = false } = {}) {
    appliedTheme = theme === "light" ? "light" : "dark";
    root.dataset.theme = appliedTheme;
    const isLight = appliedTheme === "light";
    if (metaThemeColor) metaThemeColor.content = isLight ? "#edf0f4" : "#111318";
    if (button) {
      const label = isLight ? labels.toDark : labels.toLight;
      button.setAttribute("aria-pressed", String(isLight));
      button.setAttribute("aria-label", label);
      button.title = label;
    }
    motion.target = isLight ? 1 : 0;
    pixelMotion.target = motion.target;
    if (!animate || reducedMotion.matches || document.hidden) {
      settleMotion();
    } else if (!motion.frameId) {
      motion.lastTime = performance.now();
      motion.frameId = window.requestAnimationFrame(animateMotion);
    }
  }

  function mount() {
    const target = document.querySelector(".header-actions") || document.querySelector(".article-toolbar");
    if (!target || target.querySelector("[data-theme-toggle]")) return;
    button = document.createElement("button");
    button.className = "theme-toggle";
    button.type = "button";
    button.setAttribute("data-theme-toggle", "");
    button.innerHTML = `<span class="theme-toggle-track" aria-hidden="true"><span class="theme-toggle-thumb"><svg class="theme-toggle-pixels" viewBox="0 0 32 32"></svg></span></span>`;
    pixels = createPixels(button.querySelector("svg"));
    target.appendChild(button);
    applyTheme(appliedTheme);

    button.addEventListener("click", () => {
      const nextTheme = appliedTheme === "light" ? "dark" : "light";
      try {
        localStorage.setItem(storageKey, nextTheme);
      } catch (error) {
        // Reading and toggling remain available when storage is blocked.
      }
      applyTheme(nextTheme, { animate: true });
    });

    // The continuous-music shell also changes this document's theme from its iframe.
    new MutationObserver(() => {
      if (root.dataset.theme !== appliedTheme) applyTheme(root.dataset.theme);
    }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) settleMotion();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) settleMotion();
  });
  window.addEventListener("pagehide", settleMotion);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) applyTheme(getStoredTheme() || appliedTheme);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey && (event.newValue === "light" || event.newValue === "dark")) {
      applyTheme(event.newValue);
    }
  });
  applyTheme(initialTheme);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
