const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const port = Number.parseInt(process.env.TEST_PORT || "4186", 10);
const desktopViewports = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
const minimumArticleWidthAt1440 = 900;
const minimumDesktopViewportShare = 0.55;
const commonArticleModuleSelectors = [
  ".article-header",
  ".article-header h1",
  ".article-header .meta",
  ".article-taxonomy",
  ".resume-reading-card",
  ".article-series-card",
  ".article-learning-card",
  ".article-recommendations",
  ".article-pagination",
];
const articleFixtures = [
  {
    pathname: "/posts/python-tuple-basic-usage.html",
    requiredModuleSelectors: commonArticleModuleSelectors,
  },
  {
    pathname: "/posts/python-knn-basic-algorithm.html",
    requiredModuleSelectors: [...commonArticleModuleSelectors, ".article-toc"],
  },
];

const { chromium } = requireWorkspaceDependency("playwright");

async function measureArticleBody(page, origin, fixture, viewport) {
  const { pathname, requiredModuleSelectors } = fixture;
  await page.setViewportSize(viewport);
  await page.goto(`${origin}${pathname}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".article-body");
  try {
    await page.waitForSelector(".resume-reading-card", { timeout: 5000 });
  } catch (error) {
    throw new Error(`${pathname} did not render the required .resume-reading-card.`);
  }

  return page.locator(".article-body").evaluate((articleBody, moduleSelectors) => {
    const articleRect = articleBody.getBoundingClientRect();
    const shellRect = articleBody.closest(".article-shell").getBoundingClientRect();
    const missingModules = moduleSelectors.filter((selector) => {
      const module = document.querySelector(selector);
      return !module || module.getClientRects().length === 0;
    });

    return {
      articleLeft: articleRect.left,
      articleRight: articleRect.right,
      articleWidth: articleRect.width,
      alignedModules: moduleSelectors.flatMap((selector) => {
        return Array.from(document.querySelectorAll(selector), (module) => {
          const moduleRect = module.getBoundingClientRect();
          return {
            selector,
            left: moduleRect.left,
            right: moduleRect.right,
            width: moduleRect.width,
          };
        });
      }),
      missingModules,
      shellLeft: shellRect.left,
      shellRight: shellRect.right,
    };
  }, requiredModuleSelectors);
}

function assertDesktopArticleUsesAvailableSpace(pathname, viewport, measurement) {
  const viewportShare = measurement.articleWidth / viewport.width;

  if (measurement.missingModules.length > 0) {
    throw new Error(
      `${pathname} is missing required visible modules: ${measurement.missingModules.join(", ")}.`
    );
  }

  if (viewport.width === 1440 && measurement.articleWidth < minimumArticleWidthAt1440) {
    throw new Error(
      `${pathname} article body is ${measurement.articleWidth}px wide at a ` +
        `${viewport.width}px viewport; expected at least ${minimumArticleWidthAt1440}px.`
    );
  }

  if (viewportShare < minimumDesktopViewportShare) {
    throw new Error(
      `${pathname} article body uses ${(viewportShare * 100).toFixed(1)}% of the ` +
        `${viewport.width}px desktop viewport; ` +
        `expected at least ${(minimumDesktopViewportShare * 100).toFixed(1)}%.`
    );
  }

  if (
    measurement.articleLeft < measurement.shellLeft ||
    measurement.articleRight > measurement.shellRight
  ) {
    throw new Error(`${pathname} article body overflows its article shell.`);
  }

  const misalignedModule = measurement.alignedModules.find((module) => {
    return (
      Math.abs(module.left - measurement.articleLeft) > 1 ||
      Math.abs(module.right - measurement.articleRight) > 1
    );
  });

  if (misalignedModule) {
    throw new Error(
      `${pathname} ${misalignedModule.selector} is ${misalignedModule.width}px wide at a ` +
        `${viewport.width}px viewport and does not align with the ` +
        `${measurement.articleWidth}px article body.`
    );
  }
}

async function run() {
  const server = createStaticServer();
  await listen(server, port);
  let browser;

  try {
    const launchOptions = {};
    const executablePath = browserExecutablePath();
    if (executablePath) launchOptions.executablePath = executablePath;

    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage({ viewport: desktopViewports[0] });
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "fuwari.learning.v1",
        JSON.stringify({
          version: 1,
          posts: {
            "python-tuple-basic": { progress: 0.5, completed: false },
            "python-knn-basic-algorithm": { progress: 0.5, completed: false },
          },
        })
      );
    });
    const origin = `http://127.0.0.1:${port}`;
    for (const viewport of desktopViewports) {
      for (const fixture of articleFixtures) {
        const measurement = await measureArticleBody(page, origin, fixture, viewport);
        assertDesktopArticleUsesAvailableSpace(fixture.pathname, viewport, measurement);
      }
    }

    console.log("Article bodies use the intended share of 1440px and 1920px desktop viewports.");
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await closeServer(server);
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
