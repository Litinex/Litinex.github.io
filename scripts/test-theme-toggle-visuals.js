(() => {
  const assert = require("node:assert/strict");
  const { browserExecutablePath, closeServer, createStaticServer, listen, requireWorkspaceDependency } = require("./test-helpers");
  const { chromium } = requireWorkspaceDependency("playwright");
  const { PNG } = requireWorkspaceDependency("pngjs");

  async function pixelCoordinates(page) {
    return page.locator(".theme-toggle-pixels rect").evaluateAll((pixels) =>
      pixels.map((pixel) => pixel.getAttribute("transform"))
    );
  }

  async function assertEndpoint(page, theme) {
    const toggle = page.locator("[data-theme-toggle]");
    const isLight = theme === "light";
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
    assert.equal(await toggle.getAttribute("aria-pressed"), String(isLight));
    assert.equal(await toggle.getAttribute("aria-label"), isLight ? "切换到暗色主题" : "切换到亮色主题");
    const coordinates = await pixelCoordinates(page);
    assert.equal(coordinates.length, 45, "The same 45 squares form both shapes");
    assert.equal(new Set(coordinates).size, 45, "Endpoint squares do not stack or disappear");
    const layout = await toggle.evaluate((button) => {
      const track = button.querySelector(".theme-toggle-track").getBoundingClientRect();
      const thumb = button.querySelector(".theme-toggle-thumb").getBoundingClientRect();
      const svg = button.querySelector("svg");
      const glyph = svg.getBoundingClientRect();
      return {
        track: track.toJSON(), thumb: thumb.toJSON(), glyph: glyph.toJSON(),
        glyphOpacity: getComputedStyle(svg).opacity,
        pressedPosition: Number(button.style.getPropertyValue("--toggle-position")),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.ok(Math.abs(layout.pressedPosition - (isLight ? 1 : 0)) < 0.0005,
      "The lens settles within 0.02 CSS pixels of its destination");
    assert.equal(layout.glyphOpacity, "1", "The glyph remains visible instead of cross-fading away");
    assert.equal(layout.overflow, false, "Navigation fits the viewport");
    assert.ok(layout.thumb.left >= layout.track.left && layout.thumb.right <= layout.track.right);
    assert.ok(layout.glyph.width >= 18 && layout.glyph.height >= 16, "Small controls keep a readable glyph");
    const image = PNG.sync.read(await page.locator(".theme-toggle-pixels").screenshot());
    let visiblePixels = 0;
    for (let index = 0; index < image.data.length; index += 4) {
      const [red, green, blue, alpha] = image.data.subarray(index, index + 4);
      const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      if (alpha > 190 && (isLight ? luma < 125 : luma > 190)) visiblePixels += 1;
    }
    assert.ok(visiblePixels >= 18, `${theme} glyph has contrasting pixels in the rendered image`);
    return coordinates;
  }

  async function checkResponsiveThemes(page, origin) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const file of ["index.html", "archive.html", "posts/week19-sequence-text-language-model-data.html"]) {
        await page.goto(`${origin}/${file}`, { waitUntil: "domcontentloaded" });
        const toggle = page.locator("[data-theme-toggle]");
        assert.equal(await toggle.count(), 1);
        const initial = await page.locator("html").getAttribute("data-theme");
        await assertEndpoint(page, initial);
        await toggle.press("Space");
        const next = initial === "light" ? "dark" : "light";
        await assertEndpoint(page, next);
        assert.equal(await page.evaluate(() => localStorage.getItem("blog-theme")), next);
        await page.reload({ waitUntil: "domcontentloaded" });
        await assertEndpoint(page, next);
      }
    }
  }

  async function checkPixelMorph(page, origin) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.locator("html").evaluate((html) => { html.dataset.theme = "dark"; });
    const moon = await assertEndpoint(page, "dark");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const sampling = page.evaluate(() => new Promise((resolve) => {
      const pixels = Array.from(document.querySelectorAll(".theme-toggle-pixels rect"));
      const frames = [];
      const started = performance.now();
      function sample(timestamp) {
        frames.push(pixels.map((pixel) => pixel.getAttribute("transform")));
        if (timestamp - started < 1000) requestAnimationFrame(sample);
        else resolve({
          frames,
          sameElements: pixels.every((pixel, index) => pixel === document.querySelectorAll(".theme-toggle-pixels rect")[index]),
        });
      }
      requestAnimationFrame(sample);
    }));
    await page.locator("[data-theme-toggle]").click();
    const animation = await sampling;
    await page.waitForFunction(() => {
      const button = document.querySelector("[data-theme-toggle]");
      return Math.abs(Number(button.style.getPropertyValue("--toggle-position")) - 1) < 0.0005 &&
        parseFloat(button.style.getPropertyValue("--toggle-pixel-mix")) === 100;
    });
    const sun = await assertEndpoint(page, "light");
    assert.notDeepEqual(sun, moon, "Sun and crescent are distinct endpoint shapes");
    assert.equal(animation.sameElements, true, "Morphing moves the original nodes");
    assert.ok(new Set(animation.frames.map((frame) => frame.join("|"))).size > 10, "The glyph passes through multiple visible shapes");
    assert.ok(animation.frames.some((frame) =>
      frame.some((coordinate, index) => coordinate !== moon[index] && coordinate !== sun[index])
    ), "Individual squares travel between their endpoint positions");

    await page.locator("[data-theme-toggle]").click();
    await page.waitForFunction(() => {
      const mix = parseFloat(document.querySelector("[data-theme-toggle]").style.getPropertyValue("--toggle-pixel-mix"));
      return mix > 5 && mix < 90;
    });
    await page.locator("[data-theme-toggle]").press("Enter");
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.deepEqual(await assertEndpoint(page, "light"), sun, "Interrupted motion settles on the latest choice");
    await page.locator("[data-theme-toggle]").press("Space");
    assert.deepEqual(await assertEndpoint(page, "dark"), moon, "Reverse morph restores the exact original crescent");
  }

  async function checkBlockedStorage(browser, origin) {
    const context = await browser.newContext({ reducedMotion: "reduce", deviceScaleFactor: 3 });
    try {
      await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await context.addInitScript(() => {
        Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } });
      });
      const page = await context.newPage();
      await page.goto(`${origin}/about.html`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-theme-toggle]").click();
      await assertEndpoint(page, "light");
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
      const context = await browser.newContext({ reducedMotion: "reduce", deviceScaleFactor: 3 });
      await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await checkResponsiveThemes(page, origin);
      await checkPixelMorph(page, origin);
      await checkBlockedStorage(browser, origin);
      assert.deepEqual(errors, [], "Theme integration has no uncaught browser errors");
      console.log("PASS: glass toggle, visible pixel morph, reversal, persistence, responsive pages, keyboard and reduced motion");
    } finally {
      if (browser) await browser.close();
      await closeServer(server);
    }
  }

  run().catch((error) => { console.error(error); process.exitCode = 1; });
})();
