(() => {
  const root = document.documentElement;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let currentX = window.innerWidth * 0.74;
  let currentY = window.innerHeight * 0.26;
  let targetX = currentX;
  let targetY = currentY;
  let frameId = 0;
  let listenersAttached = false;
  let pressState = null;
  const maxPressMs = 1800;

  function handlePointerUp(event) {
    endPress(event, false);
  }

  function handlePointerCancel(event) {
    endPress(event, true);
  }

  function applyPosition() {
    root.style.setProperty("--ambient-x", `${currentX}px`);
    root.style.setProperty("--ambient-y", `${currentY}px`);
  }

  function stopAnimation() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function step() {
    currentX += (targetX - currentX) * 0.075;
    currentY += (targetY - currentY) * 0.075;
    applyPosition();

    if (Math.abs(targetX - currentX) > 0.4 || Math.abs(targetY - currentY) > 0.4) {
      frameId = requestAnimationFrame(step);
    } else {
      frameId = 0;
    }
  }

  function scheduleAnimation() {
    if (reduceMotionQuery.matches) {
      currentX = targetX;
      currentY = targetY;
      applyPosition();
      return;
    }

    if (!frameId) {
      frameId = requestAnimationFrame(step);
    }
  }

  function resetTarget() {
    targetX = window.innerWidth * 0.74;
    targetY = window.innerHeight * 0.26;
  }

  function handlePointerMove(event) {
    targetX = event.clientX;
    targetY = event.clientY;
    scheduleAnimation();
  }

  function handlePointerLeave() {
    resetTarget();
    scheduleAnimation();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function prefersReducedMotion() {
    return reduceMotionQuery.matches;
  }

  function now() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function getBackdrop() {
    return document.querySelector("[data-ambient-backdrop]");
  }

  function getPressIndicator() {
    return document.querySelector("[data-ambient-press]");
  }

  function setPressIndicator(active, x, y, power) {
    const indicator = getPressIndicator();
    if (!indicator) {
      return;
    }

    if (!active) {
      indicator.classList.remove("is-active");
      indicator.style.removeProperty("--press-x");
      indicator.style.removeProperty("--press-y");
      indicator.style.removeProperty("--press-power");
      return;
    }

    indicator.classList.add("is-active");
    indicator.style.setProperty("--press-x", `${x}px`);
    indicator.style.setProperty("--press-y", `${y}px`);
    indicator.style.setProperty("--press-power", String(power));
  }

  function spawnClickRipple(x, y, power) {
    const backdrop = getBackdrop();
    if (!backdrop) {
      return;
    }

    const ripple = document.createElement("div");
    ripple.className = "ambient-click";
    ripple.style.setProperty("--click-x", `${x}px`);
    ripple.style.setProperty("--click-y", `${y}px`);
    ripple.style.setProperty("--click-power", String(power));

    backdrop.appendChild(ripple);

    ripple.addEventListener(
      "animationend",
      () => {
        ripple.remove();
      },
      { once: true }
    );
  }

  function startPress(event) {
    if (prefersReducedMotion()) {
      return;
    }

    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    pressState = {
      pointerId: event.pointerId,
      startTime: now(),
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      rafId: 0,
    };

    setPressIndicator(true, pressState.startX, pressState.startY, 0);

    const tick = () => {
      if (!pressState) {
        return;
      }

      const elapsed = now() - pressState.startTime;
      const power = clamp(elapsed / maxPressMs, 0, 1);
      setPressIndicator(true, pressState.lastX, pressState.lastY, power);
      pressState.rafId = requestAnimationFrame(tick);
    };

    pressState.rafId = requestAnimationFrame(tick);
  }

  function updatePress(event) {
    if (!pressState) {
      return;
    }

    if (pressState.pointerId !== event.pointerId) {
      return;
    }

    pressState.lastX = event.clientX;
    pressState.lastY = event.clientY;
  }

  function endPress(event, cancel) {
    if (!pressState) {
      return;
    }

    if (event && pressState.pointerId !== event.pointerId) {
      return;
    }

    if (pressState.rafId) {
      cancelAnimationFrame(pressState.rafId);
    }

    const elapsed = now() - pressState.startTime;
    const power = clamp(elapsed / 700, 0.15, 1.8);
    const x = pressState.lastX;
    const y = pressState.lastY;

    pressState = null;
    setPressIndicator(false);

    if (cancel || prefersReducedMotion()) {
      return;
    }

    spawnClickRipple(x, y, power);
  }

  function attachListeners() {
    if (listenersAttached) {
      return;
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("pointerdown", startPress, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerCancel, { passive: true });
    window.addEventListener("pointermove", updatePress, { passive: true });
    listenersAttached = true;
  }

  function detachListeners() {
    if (!listenersAttached) {
      return;
    }

    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerleave", handlePointerLeave);
    window.removeEventListener("pointerdown", startPress);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
    window.removeEventListener("pointermove", updatePress);
    listenersAttached = false;
  }

  function syncMotionPreference() {
    if (reduceMotionQuery.matches) {
      detachListeners();
      stopAnimation();
      resetTarget();
      currentX = targetX;
      currentY = targetY;
      applyPosition();
      return;
    }

    attachListeners();
    scheduleAnimation();
  }

  function handleResize() {
    resetTarget();

    if (reduceMotionQuery.matches) {
      currentX = targetX;
      currentY = targetY;
    } else {
      currentX = Math.min(currentX, window.innerWidth);
      currentY = Math.min(currentY, window.innerHeight);
    }

    applyPosition();
  }

  function ensureBackdrop() {
    if (document.querySelector("[data-ambient-backdrop]")) {
      return;
    }

    const backdrop = document.createElement("div");
    backdrop.className = "ambient-backdrop";
    backdrop.setAttribute("data-ambient-backdrop", "true");
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML = `
      <div class="ambient-orb ambient-orb-a"></div>
      <div class="ambient-orb ambient-orb-b"></div>
      <div class="ambient-orb ambient-orb-c"></div>
      <div class="ambient-pointer"></div>
      <div class="ambient-ripple"></div>
      <div class="ambient-press" data-ambient-press="true"></div>
    `;

    document.body.prepend(backdrop);
  }

  function init() {
    ensureBackdrop();
    applyPosition();
    syncMotionPreference();
    window.addEventListener("resize", handleResize, { passive: true });

    if (typeof reduceMotionQuery.addEventListener === "function") {
      reduceMotionQuery.addEventListener("change", syncMotionPreference);
    } else if (typeof reduceMotionQuery.addListener === "function") {
      reduceMotionQuery.addListener(syncMotionPreference);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
