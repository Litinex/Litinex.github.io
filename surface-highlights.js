(() => {
  const motionAllowed = window.matchMedia(
    "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)"
  );
  const surfaceSelector = ".profile-card, .music-player";
  let activeSurface = null;
  let frameId = 0;
  let pointerX = 0;
  let pointerY = 0;

  function clearHighlight() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    if (!activeSurface) return;
    activeSurface.removeAttribute("data-surface-lit");
    activeSurface.style.removeProperty("--surface-x");
    activeSurface.style.removeProperty("--surface-y");
    activeSurface = null;
  }

  function paintHighlight() {
    frameId = 0;
    if (!activeSurface) return;
    const bounds = activeSurface.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      clearHighlight();
      return;
    }
    const percent = (offset, size) => `${Math.min(100, Math.max(0, offset / size * 100)).toFixed(1)}%`;
    activeSurface.style.setProperty("--surface-x", percent(pointerX - bounds.left, bounds.width));
    activeSurface.style.setProperty("--surface-y", percent(pointerY - bounds.top, bounds.height));
    activeSurface.setAttribute("data-surface-lit", "");
  }

  function followPointer(event) {
    if (event.pointerType !== "mouse") return;
    const surface = event.target instanceof Element ? event.target.closest(surfaceSelector) : null;
    if (surface !== activeSurface) {
      clearHighlight();
      activeSurface = surface;
    }
    if (!activeSurface) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!frameId) frameId = window.requestAnimationFrame(paintHighlight);
  }

  function handlePointerOut(event) {
    if (!activeSurface || (event.relatedTarget instanceof Node && activeSurface.contains(event.relatedTarget))) return;
    clearHighlight();
  }

  function updateMotionPreference() {
    clearHighlight();
    document.removeEventListener("pointermove", followPointer);
    if (motionAllowed.matches) {
      document.addEventListener("pointermove", followPointer, { passive: true });
    }
  }

  document.addEventListener("pointerout", handlePointerOut, { passive: true });
  document.addEventListener("pointercancel", clearHighlight, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearHighlight();
  });
  window.addEventListener("blur", clearHighlight);
  motionAllowed.addEventListener("change", updateMotionPreference);
  updateMotionPreference();
})();
