const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const port = Number.parseInt(process.env.TEST_PORT || "4183", 10);
const samplePaddingCssPx = 8;
const borderSampleOffsetCssPx = 0.5;
const surfaceSampleOffsetCssPx = 6;
const verticalInsetCssPx = 16;
const maxOuterRimLumaDelta = 16;

const { PNG } = requireWorkspaceDependency("pngjs");
const { chromium } = requireWorkspaceDependency("playwright");

function relativeLuma(red, green, blue) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function readPixel(png, x, y) {
  const safeX = Math.max(0, Math.min(png.width - 1, x));
  const safeY = Math.max(0, Math.min(png.height - 1, y));
  const index = (safeY * png.width + safeX) * 4;
  return {
    red: png.data[index],
    green: png.data[index + 1],
    blue: png.data[index + 2],
    alpha: png.data[index + 3],
  };
}

function averageLumaForColumn(png, x, top, bottom) {
  let total = 0;
  let count = 0;

  for (let y = top; y < bottom; y += 1) {
    const pixel = readPixel(png, x, y);
    if (pixel.alpha === 0) continue;

    total += relativeLuma(pixel.red, pixel.green, pixel.blue);
    count += 1;
  }

  if (count === 0) {
    throw new Error("Unable to sample code editor rim pixels.");
  }

  return total / count;
}

async function measureDarkCodeEditorRim(page) {
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });

  const editor = page.locator(".code-editor").first();
  const editorBox = await editor.boundingBox();
  if (!editorBox) {
    throw new Error("Code editor must be rendered before measuring its dark rim.");
  }

  const clip = {
    x: Math.max(0, editorBox.x - samplePaddingCssPx),
    y: Math.max(0, editorBox.y - samplePaddingCssPx),
    width: editorBox.width + samplePaddingCssPx * 2,
    height: editorBox.height + samplePaddingCssPx * 2,
  };
  const screenshot = await page.screenshot({ clip });
  const png = PNG.sync.read(screenshot);
  const scale = page.viewportSize().width ? png.width / clip.width : 1;

  const borderX = Math.round((samplePaddingCssPx + borderSampleOffsetCssPx) * scale);
  const surfaceX = Math.round((samplePaddingCssPx + surfaceSampleOffsetCssPx) * scale);
  const top = Math.round((samplePaddingCssPx + verticalInsetCssPx) * scale);
  const bottom = Math.round((samplePaddingCssPx + editorBox.height - verticalInsetCssPx) * scale);
  const borderLuma = averageLumaForColumn(png, borderX, top, bottom);
  const surfaceLuma = averageLumaForColumn(png, surfaceX, top, bottom);

  return {
    borderLuma,
    surfaceLuma,
    lumaDelta: borderLuma - surfaceLuma,
  };
}

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
    const page = await browser.newPage({
      viewport: { width: 920, height: 760 },
      deviceScaleFactor: 3,
    });
    await page.goto(`http://127.0.0.1:${port}/posts/python-list-basic-usage.html`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector(".code-editor");

    const measurement = await measureDarkCodeEditorRim(page);
    if (measurement.lumaDelta > maxOuterRimLumaDelta) {
      throw new Error(
        `Dark theme code editor outer rim is too bright: ` +
          `border/surface luma delta=${measurement.lumaDelta.toFixed(2)}, ` +
          `expected at most ${maxOuterRimLumaDelta}.`
      );
    }

    console.log(
      `Dark theme code editor rim luma delta: ${measurement.lumaDelta.toFixed(2)}`
    );
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
