const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  browserExecutablePath, closeServer, createStaticServer, listen, requireWorkspaceDependency,
} = require("./test-helpers");

const { chromium } = requireWorkspaceDependency("playwright");
const scenarios = [
  { pathname: "index.html", width: 1440, budgetKiB: 320, headingSize: 72 },
  { pathname: "index.html", width: 390, budgetKiB: 320, headingSize: 39 },
  { pathname: "posts/week18-resnet-densenet-controlled-comparison.html", width: 1440, budgetKiB: 512, headingSize: 48.96 },
  { pathname: "index.html", width: 1440, budgetKiB: 768, headingSize: 72,
    name: "dynamic-poem", poem: "霁月澄江，鹭影横斜。" },
];
const auditDirectory = process.env.FONT_AUDIT_DIR;

async function assertRenderedTypeface(page, selector, familyPattern, weight, size) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
    const usedFonts = fonts.filter((font) => font.glyphCount > 0);
    assert.ok(usedFonts.length > 0 && usedFonts.every((font) => font.isCustomFont && familyPattern.test(font.familyName)),
      `${selector} must actually render with ${familyPattern}, received ${JSON.stringify(fonts)}`);
    const style = await page.locator(selector).first().evaluate((element) => ({
      weight: getComputedStyle(element).fontWeight, size: Number.parseFloat(getComputedStyle(element).fontSize),
    }));
    assert.equal(style.weight, weight, `${selector} retains its visual weight`);
    if (size !== undefined) assert.ok(Math.abs(style.size - size) < 0.1, `${selector} retains its text size`);
  } finally {
    await session.detach();
  }
}

async function measurePage(browser, origin, scenario) {
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: 900 }, reducedMotion: "reduce",
  });
  try {
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "v1.jinrishici.com") {
        return route.fulfill({ json: { content: scenario.poem || "行到水穷处，坐看云起时。" } });
      }
      return url.origin === origin || ["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)
        ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const fontResponses = [];
    const failedFonts = [];
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      if (request.resourceType() === "font" || url.hostname === "fonts.googleapis.com" ||
          (request.resourceType() === "stylesheet" && url.pathname.startsWith("/assets/fonts/"))) {
        failedFonts.push(request.url());
      }
    });
    page.on("response", (response) => {
      if (response.request().resourceType() === "font") {
        fontResponses.push(response.body().then((body) => ({
          url: response.url(), bytes: body.length, status: response.status(),
        })));
      }
    });
    await page.goto(`${origin}/${scenario.pathname}`, { waitUntil: "load" });
    await page.locator(scenario.pathname === "index.html" ? ".post-card-title" : ".article-body").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const fonts = await Promise.all(fontResponses);
    assert.deepEqual(failedFonts, [], `${scenario.pathname}: font resources must not fail`);
    assert.ok(fonts.length > 0, `${scenario.pathname}: real webfonts must load`);
    await assertRenderedTypeface(page, "h1", /Noto Serif SC/, "600", scenario.headingSize);
    if (scenario.pathname === "index.html") {
      await assertRenderedTypeface(page, ".post-card-title", /Noto Serif SC/, "600");
      await assertRenderedTypeface(page, ".site-brand small", /Manrope/, "400");
      await assertRenderedTypeface(page, ".section-kicker", /JetBrains Mono/, "500");
      if (scenario.poem) {
        assert.equal(await page.locator("h1").textContent(), scenario.poem, "Dynamic poetry keeps its actual characters");
      }
    } else {
      await assertRenderedTypeface(page, ".article-body > p:nth-of-type(3)", /Noto Serif SC/, "400");
    }
    const typography = await page.locator("h1, .post-card-title, .article-body > p").evaluateAll((elements) =>
      elements.slice(0, 8).map((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return { text: element.textContent.trim(), family: style.fontFamily, weight: style.fontWeight,
          size: style.fontSize, width: rect.width, height: rect.height };
      }));
    if (auditDirectory) {
      fs.mkdirSync(auditDirectory, { recursive: true });
      await page.screenshot({
        path: path.join(auditDirectory, `${scenario.name || path.basename(scenario.pathname, ".html")}-${scenario.width}.png`),
        fullPage: true,
      });
    }
    return { ...scenario, fonts, typography, fontKiB: fonts.reduce((sum, font) => sum + font.bytes, 0) / 1024 };
  } finally {
    await context.close();
  }
}

async function run() {
  const server = createStaticServer();
  await listen(server, 0);
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: browserExecutablePath() });
    const measurements = [];
    for (const scenario of scenarios) measurements.push(await measurePage(browser, origin, scenario));
    if (auditDirectory) {
      fs.writeFileSync(path.join(auditDirectory, "fonts.json"), JSON.stringify(measurements, null, 2));
    }
    const overBudget = measurements.filter((measurement) => measurement.fontKiB > measurement.budgetKiB);
    for (const measurement of measurements) {
      console.log(`${measurement.pathname} ${measurement.width}px: ${measurement.fontKiB.toFixed(1)} KiB, ${measurement.fonts.length} font requests`);
      assert.ok(measurement.fonts.every((font) => font.status === 200), "Font requests must succeed");
      if (!measurement.poem) {
        assert.ok(measurement.fonts.every((font) => new URL(font.url).origin === origin),
          "Existing page characters should use local fonts without a Google connection");
      }
    }
    assert.deepEqual(overBudget.map(({ pathname, width, fontKiB, budgetKiB }) =>
      ({ pathname, width, fontKiB: Math.round(fontKiB), budgetKiB })), [],
    "Real page font transfers must stay within the homepage/article budgets");
    console.log("PASS: font loading budgets");
  } finally {
    try { if (browser) await browser.close(); } finally { await closeServer(server); }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
