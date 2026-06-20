const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const port = Number.parseInt(process.env.TEST_PORT || "4184", 10);
const { PNG } = requireWorkspaceDependency("pngjs");
const { chromium } = requireWorkspaceDependency("playwright");

const desktopViewport = { width: 1000, height: 720 };
const visibleOpacityThreshold = 0.02;
const pointerWaitMs = 2400;
const reducedMotionFrameCount = 3;
const scrolledArchiveCardIndex = 4;
const archiveMaskCardIndex = 4;
const standardPointerPath = [
  { x: 180, y: 180 },
  { x: 280, y: 230, steps: 8 },
  { x: 420, y: 300, steps: 10 },
];
const scrolledArchivePointer = { x: 780, y: 430 };
const pointerProximityRadius = { x: 150, y: 120 };
const screenshotComparisonInset = 18;
const screenshotInteriorAlphaDeltaThreshold = 18;
const screenshotInteriorLumaDeltaThreshold = 42;
const maxReferenceGlyphLength = 18;
const referenceGlyphPattern = /^[ _<>|/\\.-]+$/;
const ambientTestStyleId = "ambient-code-cursor-test-style";
const controlledAmbientMarkText = "> . >";

async function launchBrowser() {
  const launchOptions = {};
  const executablePath = browserExecutablePath();
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return chromium.launch(launchOptions);
}

async function newDesktopPage(browser, options = {}) {
  return browser.newPage({
    viewport: desktopViewport,
    deviceScaleFactor: 2,
    hasTouch: false,
    isMobile: false,
    ...options,
  });
}

async function withDesktopPage(browser, action, options = {}) {
  const page = await newDesktopPage(browser, options);

  try {
    await action(page);
  } finally {
    await page.close();
  }
}

async function followPointerPath(page, points) {
  for (const point of points) {
    await page.mouse.move(point.x, point.y, point.steps ? { steps: point.steps } : undefined);
  }
}

async function movePointerAndWaitForVisibleMarks(page, x, y) {
  await followPointerPath(page, [
    { x: x - 120, y: y - 80 },
    { x, y, steps: 10 },
  ]);
  await waitForVisibleAmbientMark(page);
}

async function movePointerAndWaitForAmbientMark(page, x, y) {
  const ambientMarkPromise = waitForNextAmbientMark(page);
  await followPointerPath(page, [
    { x: x - 120, y: y - 80 },
    { x, y, steps: 10 },
  ]);
  await ambientMarkPromise;
}

async function waitForVisibleAmbientMark(page) {
  await page.waitForFunction(
    (minOpacity) => Array.from(document.querySelectorAll(".ambient-code-line")).some((line) => {
      const style = getComputedStyle(line);
      return Number.parseFloat(style.opacity) > minOpacity;
    }),
    visibleOpacityThreshold,
    { timeout: pointerWaitMs }
  );
}

async function waitForNextAmbientMark(page) {
  return page.evaluate((timeout) => new Promise((resolve, reject) => {
    const host = document.querySelector("[data-ambient-code]");
    if (!host) {
      reject(new Error("Ambient code layer must be rendered before pointer movement."));
      return;
    }

    if (host.querySelector(".ambient-code-line")) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error("Pointer movement did not create an ambient code mark."));
    }, timeout);

    const observer = new MutationObserver(() => {
      if (!host.querySelector(".ambient-code-line")) {
        return;
      }

      window.clearTimeout(timeoutId);
      observer.disconnect();
      resolve();
    });

    observer.observe(host, { childList: true });
  }), pointerWaitMs);
}

async function readVisibleAmbientMarks(page) {
  return page.evaluate((minOpacity) => Array.from(document.querySelectorAll(".ambient-code-line"))
    .map((line) => {
      const style = getComputedStyle(line);
      const rect = line.getBoundingClientRect();

      return {
        text: line.textContent || "",
        opacity: Number.parseFloat(style.opacity),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((mark) => mark.opacity > minOpacity), visibleOpacityThreshold);
}

function assertReferenceGlyphMarks(marks, label) {
  if (marks.length === 0) {
    throw new Error(`${label} should have at least one visible ambient mark.`);
  }

  const invalidMarks = marks.filter((mark) => !isReferenceStyleGlyphMark(mark.text));

  if (invalidMarks.length > 0) {
    throw new Error(
      `${label} should use short reference-style glyph marks, invalid examples: ` +
        JSON.stringify(invalidMarks.slice(0, 3).map((mark) => mark.text))
    );
  }
}

function isReferenceStyleGlyphMark(text) {
  const trimmedText = text.trim();
  return (
    trimmedText.length > 0 &&
    text.length <= maxReferenceGlyphLength &&
    referenceGlyphPattern.test(text)
  );
}

async function assertAmbientLayerDoesNotCaptureInput(page, selector, label) {
  const state = await page.evaluate((targetSelector) => {
    const backdrop = document.querySelector(".ambient-backdrop");
    const codeLayer = document.querySelector("[data-ambient-code]");
    const interactiveElement = document.querySelector(targetSelector);
    if (!backdrop || !codeLayer || !interactiveElement) {
      throw new Error("Ambient backdrop, code layer, and the selected interactive element must be rendered.");
    }

    const rect = interactiveElement.getBoundingClientRect();
    const hitTarget = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);

    return {
      backdropPointerEvents: getComputedStyle(backdrop).pointerEvents,
      codeLayerPointerEvents: getComputedStyle(codeLayer).pointerEvents,
      interactiveHitTag: hitTarget?.closest("button, a")?.tagName || "",
    };
  }, selector);

  if (state.backdropPointerEvents !== "none" || state.codeLayerPointerEvents !== "none") {
    throw new Error(
      `${label} must not be blocked by ambient layer: ` +
        `backdrop=${state.backdropPointerEvents}, codeLayer=${state.codeLayerPointerEvents}.`
    );
  }

  if (!state.interactiveHitTag) {
    throw new Error(`${label} should remain the hit target above the ambient layer.`);
  }
}

async function assertAmbientMarksNearPointer(page, pointer, label) {
  const marks = await readVisibleAmbientMarks(page);
  assertReferenceGlyphMarks(marks, label);
  const pointerRegion = {
    left: pointer.x - pointerProximityRadius.x,
    right: pointer.x + pointerProximityRadius.x,
    top: pointer.y - pointerProximityRadius.y,
    bottom: pointer.y + pointerProximityRadius.y,
  };

  const nearPointer = marks.some(
    (mark) =>
      mark.left < pointerRegion.right &&
      mark.right > pointerRegion.left &&
      mark.top < pointerRegion.bottom &&
      mark.bottom > pointerRegion.top
  );

  if (!nearPointer) {
    throw new Error(
      `${label} should show marks near viewport pointer (${pointer.x}, ${pointer.y}), got ` +
        JSON.stringify(marks.slice(0, 3))
    );
  }
}

async function assertElementVisualsRemainStableWithAmbientMarks(page, selector, label) {
  const screenshotDelta = await readElementScreenshotDeltaWithAmbientLayerToggled(page, selector);
  if (screenshotDelta.hasVisibleInteriorChange) {
    throw new Error(
      `${label} screenshot interior changed after ambient marks appeared inside it: ` +
        `${screenshotDelta.changedInteriorPixels} changed interior pixels, ` +
        `max interior luma delta ${screenshotDelta.maxInteriorLumaDelta.toFixed(2)}.`
    );
  }
}

async function triggerAmbientMarksAtElementCenter(page, selector) {
  const rect = await readVisibleElementCenter(page, selector);
  await movePointerAndWaitForAmbientMark(page, rect.x, rect.y);
  return rect;
}

async function readVisibleElementCenter(page, selector) {
  const target = await scrollElementIntoViewport(page, selector);
  const rect = await target.boundingBox();
  if (!rect) {
    throw new Error(`Unable to read target element box: ${selector}`);
  }

  const centerX = Math.min(desktopViewport.width - 24, Math.max(24, rect.x + rect.width / 2));
  const visibleTop = Math.max(24, rect.y);
  const visibleBottom = Math.min(desktopViewport.height - 24, rect.y + rect.height);
  const centerY = visibleTop + Math.max(0, visibleBottom - visibleTop) / 2;

  return { x: centerX, y: centerY };
}

async function scrollElementIntoViewport(page, selector) {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded({ timeout: pointerWaitMs });
  await page.waitForFunction(
    (targetSelector) => {
      const element = document.querySelector(targetSelector);
      if (!element) return false;

      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left);
      const visibleHeight = Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top);
      return visibleWidth > 0 && visibleHeight > 0;
    },
    selector,
    { timeout: pointerWaitMs }
  );

  return target;
}

async function readElementScreenshotDeltaWithAmbientLayerToggled(page, selector) {
  await ensureAmbientTestStyle(page);
  const target = page.locator(selector).first();

  try {
    await setAmbientLayerHidden(page, true);
    const before = await target.screenshot();

    await setAmbientLayerHidden(page, false);
    const after = await target.screenshot();

    return compareScreenshotInteriorPixels(before, after);
  } finally {
    await setAmbientLayerHidden(page, false);
  }
}

async function ensureAmbientTestStyle(page) {
  await page.evaluate((styleId) => {
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .ambient-backdrop.is-test-hidden { visibility: hidden !important; }
      .ambient-code-line.is-test-controlled {
        animation: none !important;
        clip-path: inset(0 0 0 0) !important;
        filter: none !important;
        opacity: 0.72 !important;
      }
    `;
    document.head.appendChild(style);
  }, ambientTestStyleId);
}

async function setAmbientLayerHidden(page, hidden) {
  await page.evaluate((shouldHide) => {
    document.querySelector(".ambient-backdrop")?.classList.toggle("is-test-hidden", shouldHide);
  }, hidden);
}

function compareScreenshotInteriorPixels(beforeBuffer, afterBuffer) {
  const before = PNG.sync.read(beforeBuffer);
  const after = PNG.sync.read(afterBuffer);
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(`Screenshot sizes differ: before=${before.width}x${before.height}, after=${after.width}x${after.height}.`);
  }

  let changedInteriorPixels = 0;
  let maxInteriorLumaDelta = 0;
  const left = Math.min(before.width, screenshotComparisonInset);
  const top = Math.min(before.height, screenshotComparisonInset);
  const right = Math.max(left, before.width - screenshotComparisonInset);
  const bottom = Math.max(top, before.height - screenshotComparisonInset);

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * before.width + x) * 4;
      const alphaDelta = Math.abs(after.data[index + 3] - before.data[index + 3]);
      const lumaDelta = Math.abs(
        relativeLuma(after.data[index], after.data[index + 1], after.data[index + 2]) -
          relativeLuma(before.data[index], before.data[index + 1], before.data[index + 2])
      );

      maxInteriorLumaDelta = Math.max(maxInteriorLumaDelta, lumaDelta);
      if (alphaDelta > screenshotInteriorAlphaDeltaThreshold || lumaDelta > screenshotInteriorLumaDeltaThreshold) {
        changedInteriorPixels += 1;
      }
    }
  }

  return {
    changedInteriorPixels,
    hasVisibleInteriorChange: changedInteriorPixels > 0,
    maxInteriorLumaDelta,
  };
}

function relativeLuma(red, green, blue) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

async function assertModuleHidesAmbientMarksWithoutVisualChange(page, selector, label) {
  const center = await triggerAmbientMarksAtElementCenter(page, selector);
  await pinControlledAmbientMark(page, center);

  try {
    await assertElementVisualsRemainStableWithAmbientMarks(page, selector, label);
  } finally {
    await removeControlledAmbientMarks(page);
  }
}

async function pinControlledAmbientMark(page, point) {
  await ensureAmbientTestStyle(page);
  await page.evaluate(({ x, y, text }) => {
    const host = document.querySelector("[data-ambient-code]");
    if (!host) {
      throw new Error("Ambient code layer must be rendered before pinning a controlled mark.");
    }

    const mark = document.createElement("span");
    mark.className = "ambient-code-line is-angle is-test-controlled";
    mark.textContent = text;
    mark.style.setProperty("--code-x", `${x}px`);
    mark.style.setProperty("--code-y", `${y}px`);
    mark.style.setProperty("--code-drift-x", "0px");
    mark.style.setProperty("--code-drift-y", "0px");
    mark.style.setProperty("--code-rotate", "0deg");
    mark.style.setProperty("--code-size", "16px");
    mark.style.setProperty("--code-opacity", "0.72");
    mark.style.setProperty("--code-width", `${text.length + 1}ch`);
    host.appendChild(mark);
  }, { ...point, text: controlledAmbientMarkText });
}

async function removeControlledAmbientMarks(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".ambient-code-line.is-test-controlled").forEach((mark) => mark.remove());
  });
}

async function openPageAndShowReferenceMarks(page, path, label, interactiveSelector, interactiveLabel) {
  await page.goto(`http://127.0.0.1:${port}/${path}`, { waitUntil: "networkidle" });
  await followPointerPath(page, standardPointerPath);
  await waitForVisibleAmbientMark(page);
  assertReferenceGlyphMarks(await readVisibleAmbientMarks(page), label);
  await assertAmbientLayerDoesNotCaptureInput(page, interactiveSelector, interactiveLabel);
}

async function assertHomePageUsesReferenceGlyphs(page) {
  await openPageAndShowReferenceMarks(
    page,
    "index.html",
    "Home page cursor animation",
    ".site-nav a[href='archive.html']",
    "Home navigation archive link"
  );
}

async function assertArticlePageUsesReferenceGlyphs(page) {
  await openPageAndShowReferenceMarks(
    page,
    "posts/python-list-basic-usage.html",
    "Article page cursor animation",
    ".article-back",
    "Article back link"
  );
}

async function assertArticleBodyMasksAmbientMarks(page) {
  await page.goto(`http://127.0.0.1:${port}/posts/python-list-basic-usage.html`, {
    waitUntil: "networkidle",
  });
  await assertModuleHidesAmbientMarksWithoutVisualChange(page, ".article-body", "Article body");
}

async function assertScrolledArchiveKeepsAnimating(page) {
  await page.goto(`http://127.0.0.1:${port}/archive.html`, { waitUntil: "networkidle" });
  await page.waitForSelector(".archive-list .post-card");
  await scrollArchivePostCardIntoViewport(page, scrolledArchiveCardIndex);
  await movePointerAndWaitForVisibleMarks(page, scrolledArchivePointer.x, scrolledArchivePointer.y);
  await assertAmbientMarksNearPointer(page, scrolledArchivePointer, "Scrolled archive cursor animation");
}

async function scrollArchivePostCardIntoViewport(page, index) {
  const selector = `.archive-list .post-card:nth-child(${index + 1})`;
  await scrollElementIntoViewport(page, selector);
  await page.waitForFunction(
    (cardSelector) => {
      const cardElement = document.querySelector(cardSelector);
      if (!cardElement) return false;

      const rect = cardElement.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0 && window.scrollY > 0;
    },
    selector,
    { timeout: pointerWaitMs }
  );
}

async function assertArchiveCardsMaskAmbientMarks(page) {
  await page.goto(`http://127.0.0.1:${port}/archive.html`, { waitUntil: "networkidle" });
  await page.waitForSelector(".archive-list .post-card");
  await assertModuleHidesAmbientMarksWithoutVisualChange(
    page,
    `.archive-list .post-card:nth-child(${archiveMaskCardIndex + 1})`,
    "Archive post card"
  );
}

async function assertReducedMotionDoesNotSpawnCode(browser) {
  await withDesktopPage(browser, async (page) => {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
    await followPointerPath(page, [
      { x: 200, y: 180 },
      { x: 500, y: 340, steps: 12 },
    ]);
    await waitForAnimationFrames(page, reducedMotionFrameCount);

    const state = await page.evaluate(() => {
      const backdrop = document.querySelector(".ambient-backdrop");
      return {
        display: backdrop ? getComputedStyle(backdrop).display : "missing",
        codeLineCount: document.querySelectorAll(".ambient-code-line").length,
      };
    });

    if (state.display !== "none") {
      throw new Error(`Reduced motion should hide the ambient backdrop, got display=${state.display}.`);
    }

    if (state.codeLineCount !== 0) {
      throw new Error(`Reduced motion should not spawn code lines, got ${state.codeLineCount}.`);
    }
  }, { reducedMotion: "reduce" });
}

async function waitForAnimationFrames(page, frameCount) {
  await page.evaluate((frames) => new Promise((resolve) => {
    let remainingFrames = frames;

    function waitForNextFrame() {
      remainingFrames -= 1;
      if (remainingFrames <= 0) {
        resolve();
        return;
      }

      window.requestAnimationFrame(waitForNextFrame);
    }

    window.requestAnimationFrame(waitForNextFrame);
  }), frameCount);
}

async function run() {
  const server = createStaticServer();
  await listen(server, port);
  let browser;

  try {
    browser = await launchBrowser();
    await withDesktopPage(browser, assertHomePageUsesReferenceGlyphs);
    await withDesktopPage(browser, assertArticlePageUsesReferenceGlyphs);
    await withDesktopPage(browser, assertArticleBodyMasksAmbientMarks);
    await withDesktopPage(browser, assertScrolledArchiveKeepsAnimating);
    await withDesktopPage(browser, assertArchiveCardsMaskAmbientMarks);
    await assertReducedMotionDoesNotSpawnCode(browser);

    console.log(
      "Ambient cursor uses reference-style glyphs, follows scrolled viewports, stays behind content, and respects reduced motion."
    );
  } finally {
    try {
      if (browser) {
        await browser.close();
      }
    } finally {
      await closeServer(server);
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
