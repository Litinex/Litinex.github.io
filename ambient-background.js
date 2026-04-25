(() => {
  const root = document.documentElement;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let currentX = window.innerWidth * 0.74;
  let currentY = window.innerHeight * 0.26;
  let targetX = currentX;
  let targetY = currentY;
  let frameId = 0;
  let listenersAttached = false;

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

  function attachListeners() {
    if (listenersAttached) {
      return;
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    listenersAttached = true;
  }

  function detachListeners() {
    if (!listenersAttached) {
      return;
    }

    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerleave", handlePointerLeave);
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
