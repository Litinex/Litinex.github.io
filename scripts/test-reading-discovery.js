const assert = require("node:assert/strict");
const {
  browserExecutablePath, closeServer, createStaticServer, listen, requireWorkspaceDependency,
} = require("./test-helpers");
const { chromium } = requireWorkspaceDependency("playwright");

async function checkArticleLayout(page, origin) {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const filename of ["python-tuple-basic-usage", "week12-mlp-regularization-review"]) {
    await page.goto(`${origin}/posts/${filename}.html`, { waitUntil: "domcontentloaded" });
    const dimensions = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { body: rect(".article-body"), header: rect(".article-header"), pagination: rect(".article-pagination") };
    });
    for (const module of [dimensions.header, dimensions.pagination]) {
      assert.ok(Math.abs(module.right - dimensions.body.right) < 2, `${filename}: module right edges align`);
      assert.ok(Math.abs(module.left - dimensions.body.left) < 2, `${filename}: module left edges align`);
    }
  }
  await page.getByRole("link", { name: "三、三种激活函数", exact: true }).click();
  const stickyTop = await page.locator(".article-toc").evaluate((toc) => toc.getBoundingClientRect().top);
  assert.ok(stickyTop >= 70 && stickyTop < 110, "Desktop TOC sticks below the header");
}

async function checkMobileLayout(page, origin) {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${origin}/posts/week12-mlp-regularization-review.html`, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator("details").evaluate((details) => details.open), false, "Mobile TOC starts closed");
  await page.locator(".article-toc summary").press("Enter");
  await page.getByRole("link", { name: "三、三种激活函数", exact: true }).click();
  const mobile = await page.evaluate(() => ({
    open: document.querySelector("details").open,
    headingTop: document.getElementById("三-三种激活函数").getBoundingClientRect().top,
    toolbarBottom: document.querySelector(".article-toolbar").getBoundingClientRect().bottom,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.equal(mobile.open, false, "Selecting a mobile chapter closes the TOC");
  assert.ok(mobile.headingTop >= mobile.toolbarBottom, "Selected chapter stays below mobile navigation");
  assert.equal(mobile.overflow, false, "Mobile article has no page-level overflow");
  for (const name of ["主页", "归档", "关于"]) {
    assert.ok(await page.getByRole("navigation", { name: "主导航", exact: true }).getByRole("link", { name, exact: true }).isVisible());
  }
}

async function checkArchive(page, origin) {
  await page.goto(`${origin}/archive.html`, { waitUntil: "domcontentloaded" });
  const search = page.getByRole("searchbox", { name: "搜索文章关键词" });
  const categories = page.getByRole("group", { name: "按分类筛选" });
  await categories.getByRole("button", { name: "学习札记", exact: true }).click();
  await search.fill("  PyTorch  ");
  const results = page.locator("[data-archive-list] > li:visible");
  assert.ok(await results.count() > 0, "Combined category and query returns articles");
  for (const category of await results.evaluateAll((items) => items.map((item) => item.dataset.category))) {
    assert.equal(category, "学习札记");
  }
  assert.ok(await page.locator("[data-archive-list] > li:visible mark").count() > 0, "Query is highlighted");
  assert.equal(new URL(page.url()).searchParams.get("category"), "学习札记");
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await search.inputValue(), "PyTorch", "Query survives reload");
  assert.equal(await categories.getByRole("button", { name: "学习札记", exact: true }).getAttribute("aria-pressed"), "true");
  await search.fill('<img src=x onerror=alert(1)>');
  assert.ok(await page.getByText("没有找到匹配的文章，试试其他关键词或分类。", { exact: true }).isVisible());
  assert.equal(await page.locator('[data-archive-list] img[src="x"]').count(), 0, "Search remains literal text");
  await page.getByRole("button", { name: "清除全部筛选", exact: true }).click();
  assert.equal(await search.inputValue(), "");
  assert.equal(new URL(page.url()).searchParams.has("category"), false);
  await categories.getByRole("button", { name: "全部", exact: true }).focus();
  await page.keyboard.press("/");
  assert.ok(await search.evaluate((input) => input === document.activeElement), "Slash focuses search");
  await search.fill("Python");
  await search.press("Escape");
  assert.equal(await page.locator("mark.search-match").count(), 0, "Clearing query removes highlighting");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get("p"), "2");
  await categories.getByRole("button", { name: "学习札记", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.has("p"), false, "Changing category resets pagination");
}

async function run() {
  const server = createStaticServer();
  await listen(server, 0);
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: browserExecutablePath() });
    const context = await browser.newContext({ reducedMotion: "reduce" });
    // External music/counters/fonts are not prerequisites for local UI assertions.
    await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const checks = { article: checkArticleLayout, mobile: checkMobileLayout, archive: checkArchive };
    const selected = process.argv[2];
    if (selected) {
      assert.ok(checks[selected], `Unknown check: ${selected}`);
      await checks[selected](page, origin);
    } else {
      for (const check of Object.values(checks)) await check(page, origin);
    }
    console.log("PASS: navigation, sticky/collapsible TOC, combined search, literal highlighting, URL state, reset and pagination");
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
