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

const { chromium } = requireWorkspaceDependency("playwright");

async function measureArticleBody(page, origin, pathname, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${origin}${pathname}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".article-body");

  return page.locator(".article-body").evaluate((articleBody) => {
    const articleRect = articleBody.getBoundingClientRect();
    const shellRect = articleBody.closest(".article-shell").getBoundingClientRect();

    return {
      articleLeft: articleRect.left,
      articleRight: articleRect.right,
      articleWidth: articleRect.width,
      shellLeft: shellRect.left,
      shellRight: shellRect.right,
    };
  });
}

function assertDesktopArticleUsesAvailableSpace(pathname, viewport, measurement) {
  const viewportShare = measurement.articleWidth / viewport.width;

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
    const origin = `http://127.0.0.1:${port}`;
    const articlePaths = [
      "/posts/python-tuple-basic-usage.html",
      "/posts/python-knn-basic-algorithm.html",
    ];

    for (const viewport of desktopViewports) {
      for (const pathname of articlePaths) {
        const measurement = await measureArticleBody(page, origin, pathname, viewport);
        assertDesktopArticleUsesAvailableSpace(pathname, viewport, measurement);
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
