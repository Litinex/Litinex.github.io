const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");
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

async function checkArchiveTags(page, origin) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${origin}/archive.html`, { waitUntil: "domcontentloaded" });
  const categories = page.getByRole("group", { name: "按分类筛选" });
  const learningNotes = categories.getByRole("button", { name: "学习札记", exact: true });
  const results = page.getByRole("region", { name: "历史文章" }).getByRole("listitem");
  await learningNotes.click();

  const cardTag = results.getByRole("link", { name: "Python", exact: true }).first();
  let resolveNavigation;
  const navigation = new Promise((resolve) => { resolveNavigation = resolve; });
  const recordNavigation = (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      resolveNavigation(request.url());
    }
  };
  page.on("request", recordNavigation);
  await cardTag.click();
  // Start the observation window after the click so locator waits do not use it up.
  const nextDocumentUrl = await Promise.race([navigation, delay(1000)]);
  page.off("request", recordNavigation);
  if (nextDocumentUrl) await page.waitForURL(nextDocumentUrl, { waitUntil: "domcontentloaded" });
  const tagUrl = new URL(page.url());
  assert.equal(tagUrl.searchParams.get("category"), "学习札记", "A card tag keeps the selected category after any transition");
  assert.equal(tagUrl.searchParams.get("tag"), "Python", "A card tag uses the exact tag filter");
  assert.equal(nextDocumentUrl, undefined, "A card tag filters without requesting another document");
  assert.equal(await learningNotes.getAttribute("aria-pressed"), "true");
  const resultCategories = results.getByText("学习札记", { exact: true });
  assert.ok(await resultCategories.count() > 0, "The selected category contains Python-tagged results");
  assert.equal(await resultCategories.count(), await results.count(), "Every result stays in the selected category");
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await learningNotes.getAttribute("aria-pressed"), "true", "The filtered URL restores the category");
  assert.match(await page.getByRole("status").filter({ hasText: "找到" }).textContent(), /标签“Python”/);

  await page.goto(`${origin}/archive.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^NumPy\b/ }).click();
  assert.equal(new URL(page.url()).searchParams.get("tag"), "NumPy", "A sidebar tag uses the same exact filter");
  assert.ok(await results.getByRole("link", { name: /^PyTorch张量与NumPy互转/ }).isVisible());
  assert.equal(await results.getByRole("link", { name: /^让邻居替你做决定/ }).count(), 0,
    "Mentioning NumPy in an excerpt does not make it a NumPy-tagged article");
}

async function checkMobileArchive(page, origin) {
  const search = page.getByRole("searchbox", { name: "搜索文章关键词" });
  const categories = page.getByRole("group", { name: "按分类筛选" });
  const firstArticle = page.getByRole("region", { name: "历史文章" }).getByRole("listitem").first();
  const moreFilters = page.getByText("更多筛选", { exact: true });
  const numpy = page.getByRole("button", { name: /^NumPy\b/ });
  const pythonSeries = page.getByRole("button", { name: /^Python 入门 \d+$/ });

  for (const viewport of [{ width: 375, height: 812 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/archive.html`, { waitUntil: "domcontentloaded" });
    const searchBox = await search.boundingBox();
    const categoryBox = await categories.boundingBox();
    const articleBox = await firstArticle.boundingBox();
    assert.ok(searchBox && categoryBox && articleBox, "Search, categories and the first article are displayed");
    assert.ok(searchBox.y + searchBox.height <= categoryBox.y && categoryBox.y + categoryBox.height <= articleBox.y,
      "Search, categories and results appear in reading order");
    const distanceToArticle = Math.round(articleBox.y - searchBox.y - searchBox.height);
    assert.ok(distanceToArticle < viewport.height / 2,
      `At ${viewport.width}px, the first result should follow the basic filters (currently ${distanceToArticle}px after search)`);
    assert.ok(await moreFilters.isVisible(), "More filters has a visible mobile control");
    assert.equal(await numpy.isVisible(), false, "Tags start collapsed on mobile");
    assert.equal(await pythonSeries.isVisible(), false, "Series start collapsed on mobile");
    await moreFilters.press("Enter");
    assert.ok(await numpy.isVisible(), "Opening more filters reveals tags");
    assert.ok(await pythonSeries.isVisible(), "Opening more filters reveals series");
    await moreFilters.press("Enter");
    assert.equal(await numpy.isVisible(), false, "The disclosure can be closed with the keyboard");
  }

  const mobileSelections = [
    { control: numpy, parameter: "tag", value: "NumPy", category: "学习札记" },
    { control: pythonSeries, parameter: "q", value: "Python 入门", category: "Python 入门" },
  ];
  const filtersLeavingResultsOutOfView = [];
  const smallPhone = { width: 375, height: 812 };
  await page.setViewportSize(smallPhone);
  for (const { control, parameter, value, category } of mobileSelections) {
    await page.goto(`${origin}/archive.html`, { waitUntil: "domcontentloaded" });
    await categories.getByRole("button", { name: category, exact: true }).click();
    await moreFilters.press("Enter");
    await control.click();
    const params = new URL(page.url()).searchParams;
    assert.equal(params.get(parameter), value, "The selected mobile filter is applied");
    assert.equal(params.get("category"), category, "Applying a mobile filter preserves the category");
    const result = await firstArticle.boundingBox();
    assert.ok(result, "The selected mobile filter has results");
    const expanded = await control.isVisible();
    if (expanded || result.y >= smallPhone.height || result.y + result.height <= 0) {
      filtersLeavingResultsOutOfView.push({ value, expanded, firstResultY: Math.round(result.y) });
    }
  }
  assert.deepEqual(filtersLeavingResultsOutOfView, [],
    "Applying an advanced mobile filter collapses the panel and brings the first result into view");

  await page.setViewportSize({ width: 1440, height: 900 });
  assert.ok(await numpy.isVisible(), "Desktop keeps the tag panel visible");
  assert.ok(await pythonSeries.isVisible(), "Desktop keeps the series panel visible");
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
    const checks = {
      article: checkArticleLayout,
      mobile: checkMobileLayout,
      archive: checkArchive,
      "archive-mobile": checkMobileArchive,
      "archive-tags": checkArchiveTags,
    };
    const selected = process.argv[2];
    if (selected) {
      assert.ok(checks[selected], `Unknown check: ${selected}`);
      await checks[selected](page, origin);
    } else {
      for (const check of Object.values(checks)) await check(page, origin);
    }
    console.log(`PASS: reading discovery (${selected || "all checks"})`);
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
