const assert = require("node:assert/strict");
const path = require("node:path");
const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const { PNG } = requireWorkspaceDependency("pngjs");
const { chromium } = requireWorkspaceDependency("playwright");
const viewports = [
  { width: 1440, height: 1000 },
  { width: 1920, height: 1080 },
  { width: 390, height: 900 },
];
const maxEdgeDifference = 8;
const maxSeamDifference = 3;

function pixelDifference(png, first, second) {
  const firstIndex = (first.y * png.width + first.x) * 4;
  const secondIndex = (second.y * png.width + second.x) * 4;
  return Math.max(...[0, 1, 2].map((channel) =>
    Math.abs(png.data[firstIndex + channel] - png.data[secondIndex + channel])
  ));
}

function measureTransition(png, layout) {
  const edgeDifferences = [layout.mainLeft, layout.mainRight].map((edge) =>
    pixelDifference(png,
      { x: Math.round(edge) - 2, y: Math.ceil(layout.mainTop) + 2 },
      { x: Math.round(edge) + 2, y: Math.ceil(layout.mainTop) + 2 })
  );
  const seamDifferences = [0.1, 0.25, 0.5, 0.75, 0.9].map((fraction) =>
    pixelDifference(png,
      { x: Math.floor(png.width * fraction), y: Math.ceil(layout.bannerBottom) - 1 },
      { x: Math.floor(png.width * fraction), y: Math.ceil(layout.bannerBottom) })
  );
  return {
    edgeDifference: Math.max(...edgeDifferences),
    seamDifference: Math.max(...seamDifferences),
  };
}

async function run() {
  const server = createStaticServer();
  await listen(server, 0);
  const port = server.address().port;
  let browser;
  const failures = [];

  try {
    browser = await chromium.launch({ executablePath: browserExecutablePath() });
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
      // Remote fonts and audio are not required to render the background transition.
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
      });
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });

      for (const theme of ["dark", "light"]) {
        const scenario = `${viewport.width}px ${theme}`;
        const layout = await page.evaluate((nextTheme) => {
          document.documentElement.dataset.theme = nextTheme;
          const banner = document.querySelector(".home-banner").getBoundingClientRect();
          const main = document.querySelector(".page-main").getBoundingClientRect();
          return {
            bannerBottom: banner.bottom,
            mainTop: main.top,
            mainLeft: main.left,
            mainRight: main.right,
          };
        }, theme);
        const screenshot = await page.screenshot();
        if (process.env.TRANSITION_SCREENSHOT_DIR) {
          await page.screenshot({ path: path.join(process.env.TRANSITION_SCREENSHOT_DIR,
            `home-transition-${viewport.width}-${theme}.png`) });
        }
        const measurement = measureTransition(PNG.sync.read(screenshot), layout);
        console.log(`${scenario}: rectangle edge=${measurement.edgeDifference}, bottom seam=${measurement.seamDifference}`);
        if (measurement.edgeDifference > maxEdgeDifference) {
          failures.push(`${scenario}: visible rectangle edge (${measurement.edgeDifference} > ${maxEdgeDifference}).`);
        }
        if (measurement.seamDifference > maxSeamDifference) {
          failures.push(`${scenario}: visible horizontal seam (${measurement.seamDifference} > ${maxSeamDifference}).`);
        }
      }
      await page.close();
    }
    assert.equal(failures.length, 0, failures.join("\n"));
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
