const assert = require("node:assert/strict");
const {
  browserExecutablePath, closeServer, createStaticServer, listen, requireWorkspaceDependency,
} = require("./test-helpers");
const { chromium } = requireWorkspaceDependency("playwright");

async function checkViewer(page, origin, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${origin}/posts/week12-mlp-regularization-review.html`, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator("[data-ambient-backdrop]").count(), 0, "Reading pages have no animated backdrop");
  const trigger = page.getByRole("button", { name: "放大图片：ReLU、Sigmoid、Tanh及其导数曲线", exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  const scrollBefore = await page.evaluate(() => scrollY);
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: "图片预览" });
  await dialog.waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector("[data-image-zoom-in]").disabled);
  assert.ok(await dialog.getByRole("button", { name: "关闭图片预览" }).evaluate((button) => button === document.activeElement));
  const fitSize = await dialog.locator("img").boundingBox();
  const stageSize = await dialog.locator(".image-viewer-stage").boundingBox();
  assert.ok(fitSize.width <= stageSize.width + 1 && fitSize.height <= stageSize.height + 1, "Initial image fits the viewport");
  assert.ok(await dialog.locator("img").evaluate((image) => image.src.endsWith(".png") && image.naturalWidth > 1000), "Viewer loads original resolution");
  for (let step = 0; step < 4; step++) await dialog.getByRole("button", { name: "放大图片", exact: true }).click();
  assert.ok((await dialog.locator("img").boundingBox()).width > fitSize.width * 3, "Zoom enlarges the actual image");
  await dialog.locator(".image-viewer-stage").focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector(".image-viewer-stage").scrollTop > 0);
  for (let step = 0; step < 9; step++) {
    await page.keyboard.press("Tab");
    assert.ok(await dialog.evaluate((element) => element.contains(document.activeElement) || document.activeElement === document.body), "Focus cannot reach page controls behind the dialog");
  }
  await dialog.getByRole("button", { name: "适应窗口", exact: true }).click();
  assert.ok(Math.abs((await dialog.locator("img").boundingBox()).width - fitSize.width) < 1);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.ok(await trigger.evaluate((button) => button === document.activeElement), "Closing restores focus to the originating image");
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) < 2, "Closing preserves reading position");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  const second = page.getByRole("button", { name: "放大图片：普通MLP与Dropout MLP四种实现的测试准确率曲线", exact: true });
  await second.click();
  await page.waitForFunction(() => document.querySelector(".image-viewer img").naturalHeight === 913);
  assert.ok((await dialog.locator("[data-image-caption]").textContent()).includes("图2"), "Reopening updates image and caption");
  await dialog.getByRole("button", { name: "关闭图片预览", exact: true }).click();
}

async function checkFailureAndSvg(page, origin) {
  await page.route("**/assets/pytorch-week12-activations.png", (route) => route.abort());
  await page.goto(`${origin}/posts/week12-mlp-regularization-review.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "放大图片：ReLU、Sigmoid、Tanh及其导数曲线", exact: true }).click();
  await page.getByText("图片加载失败，请关闭后重试。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭图片预览", exact: true }).click();
  await page.unroute("**/assets/pytorch-week12-activations.png");
  await page.goto(`${origin}/posts/python-knn-basic-algorithm.html`, { waitUntil: "domcontentloaded" });
  await page.locator(".article-image-trigger").first().click();
  await page.waitForFunction(() => !document.querySelector("[data-image-zoom-in]").disabled);
  assert.ok(await page.locator(".image-viewer img").evaluate((image) => image.src.endsWith(".svg") && image.naturalWidth > 0), "SVG diagrams also open");
  await page.keyboard.press("Escape");
}

async function run() {
  const server = createStaticServer();
  await listen(server, 0);
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: browserExecutablePath() });
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 320, height: 640 }]) {
      await checkViewer(page, origin, viewport);
    }
    await checkFailureAndSvg(page, origin);
    await page.goto(`${origin}/posts/python-tuple-basic-usage.html`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator(".image-viewer").count(), 0, "Articles without images need no viewer");
    await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("[data-ambient-backdrop]").count(), 1, "Homepage keeps its existing backdrop");
    console.log("PASS: original images, SVG, responsive fit, zoom, scrolling, keyboard modal, focus/position restoration, image errors and quiet article backdrop");
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
