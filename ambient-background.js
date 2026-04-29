(() => {
  const root = document.documentElement;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia?.("(pointer: fine)") ?? { matches: true };
  let currentX = window.innerWidth * 0.74;
  let currentY = window.innerHeight * 0.26;
  let targetX = currentX;
  let targetY = currentY;
  let frameId = 0;
  let listenersAttached = false;
  let pressState = null;
  const maxPressMs = 1800;
  const trailEase = [0.34, 0.28, 0.22, 0.18, 0.14];
  const trail = trailEase.map(() => ({ x: currentX, y: currentY }));
  let trailNodes = null;
  let streakNode = null;
  let lastHeadX = currentX;
  let lastHeadY = currentY;
  let velocityX = 0;
  let velocityY = 0;
  let smoothedSpeed = 0;

  function handlePointerUp(event) {
    endPress(event, false);
  }

  function handlePointerCancel(event) {
    endPress(event, true);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function stopAnimation() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function cacheNodes() {
    if (!trailNodes) {
      trailNodes = Array.from(document.querySelectorAll("[data-ambient-trail]"));
    }
    if (!streakNode) {
      streakNode = document.querySelector("[data-ambient-streak]");
    }
  }

  function applyPosition() {
    // Keep CSS vars for the rest of the ambient backdrop (if needed).
    root.style.setProperty("--ambient-x", `${currentX}px`);
    root.style.setProperty("--ambient-y", `${currentY}px`);

    cacheNodes();

    if (trailNodes && trailNodes.length) {
      trailNodes.forEach((node, idx) => {
        const point = trail[Math.min(idx, trail.length - 1)];
        node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`;
      });
    }

    if (streakNode) {
      const angle = Math.atan2(velocityY, velocityX) * (180 / Math.PI);
      const intensity = clamp(smoothedSpeed / 56, 0, 1);
      streakNode.style.setProperty("--streak-alpha", intensity.toFixed(3));
      streakNode.style.transform =
        `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) rotate(${angle}deg) scale(${0.92 + intensity * 0.22}) scaleX(${1 + intensity * 1.6})`;
    }
  }

  function step() {
    currentX += (targetX - currentX) * 0.16;
    currentY += (targetY - currentY) * 0.16;

    velocityX = currentX - lastHeadX;
    velocityY = currentY - lastHeadY;
    lastHeadX = currentX;
    lastHeadY = currentY;

    const speed = Math.hypot(velocityX, velocityY);
    smoothedSpeed = smoothedSpeed * 0.84 + speed * 0.16;

    trail[0].x = currentX;
    trail[0].y = currentY;

    for (let i = 1; i < trail.length; i += 1) {
      const ease = trailEase[i] ?? 0.12;
      const prev = trail[i - 1];
      const point = trail[i];
      point.x += (prev.x - point.x) * ease;
      point.y += (prev.y - point.y) * ease;
    }

    applyPosition();

    const tail = trail[trail.length - 1];
    const shouldContinue =
      Math.abs(targetX - currentX) > 0.6 ||
      Math.abs(targetY - currentY) > 0.6 ||
      Math.abs(tail.x - currentX) > 0.6 ||
      Math.abs(tail.y - currentY) > 0.6;

    if (shouldContinue) {
      frameId = requestAnimationFrame(step);
      return;
    }

    frameId = 0;
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
    ripple.style.setProperty("--click-angle", `${Math.floor(Math.random() * 360)}deg`);

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
    if (reduceMotionQuery.matches || !finePointerQuery.matches) {
      detachListeners();
      stopAnimation();
      resetTarget();
      currentX = targetX;
      currentY = targetY;
      trail.forEach((point) => {
        point.x = currentX;
        point.y = currentY;
      });
      lastHeadX = currentX;
      lastHeadY = currentY;
      velocityX = 0;
      velocityY = 0;
      smoothedSpeed = 0;
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

    trail.forEach((point) => {
      point.x = currentX;
      point.y = currentY;
    });
    lastHeadX = currentX;
    lastHeadY = currentY;
    velocityX = 0;
    velocityY = 0;
    smoothedSpeed = 0;
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
      <div class="ambient-trail ambient-trail-0" data-ambient-trail="0"></div>
      <div class="ambient-trail ambient-trail-1" data-ambient-trail="1"></div>
      <div class="ambient-trail ambient-trail-2" data-ambient-trail="2"></div>
      <div class="ambient-trail ambient-trail-3" data-ambient-trail="3"></div>
      <div class="ambient-trail ambient-trail-4" data-ambient-trail="4"></div>
      <div class="ambient-streak" data-ambient-streak="true"></div>
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

    if (typeof finePointerQuery.addEventListener === "function") {
      finePointerQuery.addEventListener("change", syncMotionPreference);
    } else if (typeof finePointerQuery.addListener === "function") {
      finePointerQuery.addListener(syncMotionPreference);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
