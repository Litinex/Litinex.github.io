const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const port = Number.parseInt(process.env.TEST_PORT || "4184", 10);
const { chromium } = requireWorkspaceDependency("playwright");

async function run() {
  const server = createStaticServer();
  await listen(server, port);
  let browser;

  try {
    const launchOptions = {};
    const executablePath = browserExecutablePath();
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    browser = await chromium.launch(launchOptions);

    async function loadHomeWithPoem(poemFromApi) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.route("https://v1.jinrishici.com/all.json", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ content: poemFromApi }),
        });
      });

      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });

      const heroPoem = page.locator("[data-hero-poem]");
      await heroPoem.waitFor({ state: "visible", timeout: 1500 });
      await page.waitForFunction(
        (expectedPoem) => document.querySelector("[data-hero-poem]")?.textContent?.trim() === expectedPoem,
        poemFromApi,
        { timeout: 3000 }
      );

      const result = await page.evaluate(() => {
        const target = document.querySelector("[data-hero-poem]");
        return {
          poem: target ? target.textContent.trim() : "",
          title: document.title,
        };
      });
      await page.close();
      return result;
    }

    const firstPoem = "first-api-poem";
    const secondPoem = "second-api-poem";
    const firstResult = await loadHomeWithPoem(firstPoem);
    const secondResult = await loadHomeWithPoem(secondPoem);

    if (firstResult.poem !== firstPoem) {
      throw new Error(`Hero poem did not update from first API response. Expected "${firstPoem}", got "${firstResult.poem}".`);
    }

    if (secondResult.poem !== secondPoem) {
      throw new Error(`Hero poem did not update from second API response. Expected "${secondPoem}", got "${secondResult.poem}".`);
    }

    if (firstResult.poem === secondResult.poem) {
      throw new Error("Hero poem stayed the same after a different API response.");
    }

    for (const result of [firstResult, secondResult]) {
      if (!result.title.includes(result.poem)) {
        throw new Error(`Document title does not include the displayed poem. Title was "${result.title}".`);
      }
    }

    const fallbackPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await fallbackPage.route("https://v1.jinrishici.com/all.json", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ error: "service unavailable" }),
      });
    });

    await fallbackPage.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
    await fallbackPage.locator("[data-hero-poem]").waitFor({ state: "visible", timeout: 1500 });
    const fallbackResult = await fallbackPage.evaluate(() => {
      const target = document.querySelector("[data-hero-poem]");
      return {
        poem: target ? target.textContent.trim() : "",
        title: document.title,
      };
    });
    await fallbackPage.close();

    if (!fallbackResult.poem) {
      throw new Error("Hero poem should show a fallback poem when the API request fails.");
    }

    if (!fallbackResult.title.includes(fallbackResult.poem)) {
      throw new Error(`Document title does not include the fallback poem. Title was "${fallbackResult.title}".`);
    }

    console.log(`Hero poem updates from API and fallback: ${firstResult.poem} / ${secondResult.poem} / ${fallbackResult.poem}`);
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
