(() => {
  const images = Array.from(document.querySelectorAll(".article-body img"))
    .filter((image) => !image.closest("a, button"));
  if (!images.length || typeof HTMLDialogElement === "undefined") return;

  const dialog = document.createElement("dialog");
  dialog.className = "image-viewer";
  dialog.setAttribute("aria-label", "图片预览");
  dialog.innerHTML = `
    <div class="image-viewer-toolbar">
      <span class="image-viewer-title">图片预览</span>
      <div class="image-viewer-controls">
        <button type="button" data-image-zoom-out aria-label="缩小图片">−</button>
        <output aria-live="polite" data-image-scale></output>
        <button type="button" data-image-zoom-in aria-label="放大图片">+</button>
        <button type="button" data-image-fit>适应窗口</button>
        <button type="button" data-image-close aria-label="关闭图片预览" autofocus>关闭</button>
      </div>
    </div>
    <div class="image-viewer-stage" tabindex="0" role="region" aria-label="图片查看区域，可滚动查看细节">
      <div class="image-viewer-canvas"><img alt="" draggable="false"></div>
    </div>
    <div class="image-viewer-footer">
      <p data-image-caption></p>
      <p class="image-viewer-hint">放大后滑动或滚动查看细节，按 Esc 关闭</p>
      <p role="status" data-image-status></p>
    </div>`;
  document.body.appendChild(dialog);

  const stage = dialog.querySelector(".image-viewer-stage");
  const preview = dialog.querySelector("img");
  const caption = dialog.querySelector("[data-image-caption]");
  const status = dialog.querySelector("[data-image-status]");
  const scaleOutput = dialog.querySelector("[data-image-scale]");
  const zoomIn = dialog.querySelector("[data-image-zoom-in]");
  const zoomOut = dialog.querySelector("[data-image-zoom-out]");
  const fit = dialog.querySelector("[data-image-fit]");
  const close = dialog.querySelector("[data-image-close]");
  const zoomSteps = [1, 1.5, 2, 3, 4, 6];
  let zoomIndex = 0;
  let fitScale = 1;
  let loaded = false;
  let opener = null;

  function updateControls() {
    zoomOut.disabled = !loaded || zoomIndex === 0;
    zoomIn.disabled = !loaded || zoomIndex === zoomSteps.length - 1;
    fit.disabled = !loaded;
    scaleOutput.textContent = loaded ? `${Math.round(fitScale * zoomSteps[zoomIndex] * 100)}%` : "—";
  }

  function resizeImage() {
    const scale = fitScale * zoomSteps[zoomIndex];
    preview.style.width = `${Math.round(preview.naturalWidth * scale)}px`;
    preview.style.height = `${Math.round(preview.naturalHeight * scale)}px`;
    updateControls();
  }

  function fitImage() {
    if (!loaded || !dialog.open) return;
    fitScale = Math.min(stage.clientWidth / preview.naturalWidth, stage.clientHeight / preview.naturalHeight, 1);
    zoomIndex = 0;
    resizeImage();
    stage.scrollTo(0, 0);
  }

  function changeZoom(direction) {
    if (!loaded) return;
    const oldWidth = preview.getBoundingClientRect().width;
    const oldLeft = preview.offsetLeft;
    const oldTop = preview.offsetTop;
    const centerX = stage.scrollLeft + stage.clientWidth / 2 - oldLeft;
    const centerY = stage.scrollTop + stage.clientHeight / 2 - oldTop;
    zoomIndex = Math.min(zoomSteps.length - 1, Math.max(0, zoomIndex + direction));
    resizeImage();
    const ratio = preview.getBoundingClientRect().width / oldWidth;
    stage.scrollTo(centerX * ratio + preview.offsetLeft - stage.clientWidth / 2,
      centerY * ratio + preview.offsetTop - stage.clientHeight / 2);
  }

  function openImage(image, trigger) {
    opener = trigger;
    loaded = false;
    preview.hidden = true;
    preview.alt = image.alt;
    caption.textContent = image.closest("figure")?.querySelector("figcaption")?.textContent.trim() || image.alt;
    status.textContent = "正在加载原图…";
    updateControls();
    document.documentElement.classList.add("image-viewer-open");
    dialog.showModal();
    // Load the original full-resolution fallback, not a small-screen srcset candidate.
    preview.src = image.src;
  }

  preview.addEventListener("load", () => {
    if (!dialog.open) return;
    loaded = true;
    preview.hidden = false;
    status.textContent = "";
    fitImage();
  });
  preview.addEventListener("error", () => {
    if (!dialog.open) return;
    loaded = false;
    preview.hidden = true;
    status.textContent = "图片加载失败，请关闭后重试。";
    updateControls();
  });
  zoomIn.addEventListener("click", () => changeZoom(1));
  zoomOut.addEventListener("click", () => changeZoom(-1));
  fit.addEventListener("click", fitImage);
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("image-viewer-open");
    opener?.focus({ preventScroll: true });
  });
  window.addEventListener("resize", fitImage);

  images.forEach((image) => {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "article-image-trigger";
    trigger.setAttribute("aria-label", `放大图片：${image.alt || "文章配图"}`);
    trigger.setAttribute("aria-haspopup", "dialog");
    const content = image.closest("picture") || image;
    content.replaceWith(trigger);
    trigger.appendChild(content);
    trigger.addEventListener("click", () => openImage(image, trigger));
  });
})();
