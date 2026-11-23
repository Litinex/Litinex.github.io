const assert = require("node:assert/strict");
const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const { chromium } = requireWorkspaceDependency("playwright");
const singleColumnWidths = [390, 768, 1024];
const homepageModules = [".post-feed", "[data-continue-learning]", ".profile-sidebar", "#activity"];

async function run() {
  const server = createStaticServer();
  await listen(server, 0);
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;

  try {
    browser = await chromium.launch({ executablePath: browserExecutablePath() });
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const misalignedModules = [];

    for (const width of singleColumnWidths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-continue-learning]").waitFor();

      const measurements = await page.evaluate((selectors) => {
        const main = document.querySelector(".page-main").getBoundingClientRect();
        return selectors.map((selector) => {
          const module = document.querySelector(selector).getBoundingClientRect();
          return { selector, left: module.left - main.left, right: main.right - module.right };
        });
      }, homepageModules);

      for (const measurement of measurements) {
        if (Math.abs(measurement.left) > 1 || Math.abs(measurement.right) > 1) {
          misalignedModules.push({ width, ...measurement });
        }
      }
    }

    assert.deepEqual(misalignedModules, [],
      "Homepage modules should share both content edges in the single-column layout");
    console.log("PASS: homepage single-column content edges at 390, 768 and 1024px");
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await closeServer(server);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
