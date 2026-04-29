(() => {
  const root = document.documentElement;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia?.("(any-pointer: fine)") ?? { matches: true };
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
  let lastFrameTime = 0;
  let lastDropletAt = 0;
  let lastMeteorAt = 0;
  let liquidHost = null;
  let meteorHost = null;
  const maxDroplets = 80;
  const maxMeteors = 24;

  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));

  const blobRadius = () => {
    const randCorner = () => randInt(25, 75);
    return `${randCorner()}% ${randCorner()}% ${randCorner()}% ${randCorner()}% / ${randCorner()}% ${randCorner()}% ${randCorner()}% ${randCorner()}%`;
  };

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
    if (!liquidHost || !liquidHost.isConnected) {
      liquidHost = document.querySelector("[data-ambient-liquid]");
    }
    if (!meteorHost || !meteorHost.isConnected) {
      meteorHost = document.querySelector("[data-ambient-meteors]");
    }
  }

  function getLiquidHost() {
    cacheNodes();
    return liquidHost;
  }

  function getMeteorHost() {
    cacheNodes();
    return meteorHost;
  }

  function spawnDroplet(x, y, intensity, angleRad, distance) {
    const host = getLiquidHost();
    if (!host) return;
    if (host.childElementCount >= maxDroplets) return;

    const sizeBase = 8 + intensity * 16;
    const width = sizeBase * rand(0.7, 1.4);
    const height = sizeBase * rand(0.7, 1.4);
    const dx = Math.cos(angleRad) * distance;
    const dy = Math.sin(angleRad) * distance;
    const duration = 760 + intensity * 520 + rand(-140, 220);

    const drop = document.createElement("div");
    drop.className = "ambient-droplet";
    drop.style.left = `${x}px`;
    drop.style.top = `${y}px`;
    drop.style.width = `${width.toFixed(1)}px`;
    drop.style.height = `${height.toFixed(1)}px`;
    drop.style.borderRadius = blobRadius();

    host.appendChild(drop);

    const startScale = 0.7 + intensity * 0.35;
    const endScale = 0.22 + intensity * 0.18;
    const startOpacity = 0.08 + intensity * 0.3;
    const endOpacity = 0;

    const animation = drop.animate(
      [
        {
          transform: "translate(-50%, -50%) translate3d(0, 0, 0) scale(" + startScale.toFixed(3) + ")",
          opacity: startOpacity,
        },
        {
          transform:
            "translate(-50%, -50%) translate3d(" +
            dx.toFixed(1) +
            "px, " +
            dy.toFixed(1) +
            "px, 0) scale(" +
            endScale.toFixed(3) +
            ")",
          opacity: endOpacity,
          offset: 1,
        },
      ],
      {
        duration,
        easing: "cubic-bezier(0.12, 0.9, 0.2, 1)",
        fill: "forwards",
      }
    );

    animation.addEventListener("finish", () => drop.remove(), { once: true });
  }

  function spawnMeteor(x, y, intensity, angleRad, distance) {
    const host = getMeteorHost();
    if (!host) return;
    if (host.childElementCount >= maxMeteors) return;

    const thickness = 2 + intensity * 2.6;
    const length = 60 + intensity * 140 + rand(-20, 60);
    const duration = 620 + rand(-120, 240);
    const angleDeg = angleRad * (180 / Math.PI);
    const dx = Math.cos(angleRad) * distance;
    const dy = Math.sin(angleRad) * distance;

    const meteor = document.createElement("div");
    meteor.className = "ambient-meteor";
    meteor.style.left = `${x}px`;
    meteor.style.top = `${y}px`;
    meteor.style.width = `${length.toFixed(1)}px`;
    meteor.style.height = `${thickness.toFixed(1)}px`;
    meteor.style.setProperty("--meteor-angle", `${angleDeg.toFixed(2)}deg`);

    host.appendChild(meteor);

    const animation = meteor.animate(
      [
        {
          transform: "translate(-50%, -50%) rotate(var(--meteor-angle)) translate3d(0, 0, 0) scale(0.92)",
          opacity: 0,
        },
        {
          transform: "translate(-50%, -50%) rotate(var(--meteor-angle)) translate3d(0, 0, 0) scale(1)",
          opacity: 0.95,
          offset: 0.12,
        },
        {
          transform:
            "translate(-50%, -50%) rotate(var(--meteor-angle)) translate3d(" +
            dx.toFixed(1) +
            "px, " +
            dy.toFixed(1) +
            "px, 0) scale(1.04)",
          opacity: 0,
        },
      ],
      {
        duration,
        easing: "cubic-bezier(0.2, 0.9, 0.18, 1)",
        fill: "forwards",
      }
    );

    animation.addEventListener("finish", () => meteor.remove(), { once: true });
  }

  function spawnMoveParticles(timestamp) {
    const pressBoost = pressState ? 1.25 : 1;
    const intensity = clamp((smoothedSpeed / 18) * pressBoost, 0, 1);
    if (intensity < 0.08) return;

    const angleBase = Math.atan2(velocityY, velocityX);
    if (!Number.isFinite(angleBase)) return;

    const dropletInterval = (pressState ? 78 : 95) - intensity * 55;
    if (timestamp - lastDropletAt >= dropletInterval) {
      lastDropletAt = timestamp;

      const count = intensity > 0.72 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const spread = rand(-0.75, 0.75);
        const angle = angleBase + Math.PI + spread;
        const distance = 22 + intensity * 160 + rand(-14, 34);
        const px = currentX + rand(-6, 6);
        const py = currentY + rand(-6, 6);
        spawnDroplet(px, py, intensity, angle, distance);
      }
    }

    if (intensity < 0.62) return;

    const meteorInterval = 240 - intensity * 140;
    if (timestamp - lastMeteorAt < meteorInterval) return;
    lastMeteorAt = timestamp;

    const angle = angleBase + rand(-0.55, 0.55);
    const distance = 220 + intensity * 260 + rand(-40, 120);
    spawnMeteor(currentX, currentY, intensity, angle, distance);
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
    const timestamp = now();
    if (!lastFrameTime) {
      lastFrameTime = timestamp;
    }
    lastFrameTime = timestamp;

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
    spawnMoveParticles(timestamp);

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

  function setPressIndicator(active, x, y, power, state) {
    const indicator = getPressIndicator();
    if (!indicator) {
      return;
    }

    if (!active) {
      indicator.classList.remove("is-active");
      indicator.style.removeProperty("--press-x");
      indicator.style.removeProperty("--press-y");
      indicator.style.removeProperty("--press-power");
      indicator.style.removeProperty("--press-sx");
      indicator.style.removeProperty("--press-sy");
      indicator.style.removeProperty("--press-spin");
      indicator.style.borderRadius = "";
      return;
    }

    indicator.classList.add("is-active");
    indicator.style.setProperty("--press-x", `${x}px`);
    indicator.style.setProperty("--press-y", `${y}px`);
    indicator.style.setProperty("--press-power", String(power));

    if (state) {
      if (typeof state.sx === "number") indicator.style.setProperty("--press-sx", state.sx.toFixed(3));
      if (typeof state.sy === "number") indicator.style.setProperty("--press-sy", state.sy.toFixed(3));
      if (typeof state.spin === "number") indicator.style.setProperty("--press-spin", `${state.spin.toFixed(2)}deg`);
      if (state.shapeRadius) indicator.style.borderRadius = state.shapeRadius;
    }
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
    ripple.style.borderRadius = blobRadius();

    const intensity = clamp(power / 1.4, 0.2, 1);
    const skew = 0.12 * intensity;
    const sx = 1 + rand(-skew, skew);
    const sy = 1 + rand(-skew, skew);
    ripple.style.setProperty("--click-sx", sx.toFixed(3));
    ripple.style.setProperty("--click-sy", sy.toFixed(3));

    backdrop.appendChild(ripple);

    const burstIntensity = intensity;
    const meteorCount = Math.round(3 + burstIntensity * 4);
    for (let i = 0; i < meteorCount; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const distance = 220 + burstIntensity * 360 + rand(-60, 140);
      spawnMeteor(x, y, burstIntensity, angle, distance);
    }

    const splashCount = Math.round(8 + burstIntensity * 10);
    for (let i = 0; i < splashCount; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const distance = 40 + burstIntensity * 180 + rand(-10, 60);
      const px = x + rand(-10, 10);
      const py = y + rand(-10, 10);
      spawnDroplet(px, py, burstIntensity, angle, distance);
    }

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
      sx: 1 + rand(-0.06, 0.06),
      sy: 1 + rand(-0.06, 0.06),
      spinOffset: rand(0, 360),
      spin: 0,
      shapeRadius: blobRadius(),
      lastBubbleAt: 0,
    };

    setPressIndicator(true, pressState.startX, pressState.startY, 0, pressState);

    const tick = () => {
      if (!pressState) {
        return;
      }

      const timestamp = now();
      const elapsed = timestamp - pressState.startTime;
      const power = clamp(elapsed / maxPressMs, 0, 1);
      pressState.spin = pressState.spinOffset + elapsed * (0.06 + power * 0.18);
      setPressIndicator(true, pressState.lastX, pressState.lastY, power, pressState);

      // Long-press bubbles (water-theme): even without pointer movement,
      // emit subtle droplets as the press power grows.
      if (power > 0.12) {
        const interval = 240 - power * 140;
        if (!pressState.lastBubbleAt || timestamp - pressState.lastBubbleAt >= interval) {
          pressState.lastBubbleAt = timestamp;
          const count = power > 0.7 ? 2 : 1;
          for (let i = 0; i < count; i += 1) {
            const angle = rand(0, Math.PI * 2);
            const distance = 28 + power * 90 + rand(-8, 26);
            const px = pressState.lastX + rand(-6, 6);
            const py = pressState.lastY + rand(-6, 6);
            spawnDroplet(px, py, power * 0.9, angle, distance);
          }
        }
      }
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
    lastFrameTime = 0;
    lastDropletAt = 0;
    lastMeteorAt = 0;
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
    lastFrameTime = 0;
    lastDropletAt = 0;
    lastMeteorAt = 0;
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
      <div class="ambient-liquid" data-ambient-liquid="true"></div>
      <div class="ambient-meteors" data-ambient-meteors="true"></div>
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
