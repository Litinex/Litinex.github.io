const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const port = Number.parseInt(process.env.TEST_PORT || "4182", 10);
const { PNG } = requireWorkspaceDependency("pngjs");
const { chromium } = requireWorkspaceDependency("playwright");

// Pixel thresholds are grouped by behavior so visual failures can be tuned without
// re-deriving every screenshot region. Counts allow a few antialiased edge pixels.
const iconVisibility = {
  maxCenterDeltaCssPx: 1,
  minAlpha: 190,
  maxLuma: 125,
  thumbEdgeInsetCssPx: 4,
  minReadableSizeCssPx: 8,
};

const sunShape = {
  minDiagonalRayPixels: 4,
  diagonalRayOffsetCssPx: 5.5,
};

const moonShape = {
  minBodyPixels: 20,
  bodyMaxXCssPx: -3,
  bodyHalfHeightCssPx: 6.5,
  maxBitePixels: 6,
  biteMinXCssPx: 1,
  biteHalfHeightCssPx: 3.8,
};

const thumbOverflow = {
  minLuma: 145,
  minAlpha: 180,
  rightInsetCssPx: 1,
  verticalInsetCssPx: 4,
  maxPixels: 4,
};

function relativeLuma(red, green, blue) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function readPixel(png, x, y) {
  const index = (y * png.width + x) * 4;
  return {
    red: png.data[index],
    green: png.data[index + 1],
    blue: png.data[index + 2],
    alpha: png.data[index + 3],
  };
}

function isVisibleIconPixel(pixel) {
  return pixel.alpha > iconVisibility.minAlpha &&
    relativeLuma(pixel.red, pixel.green, pixel.blue) < iconVisibility.maxLuma;
}

function isVisibleThumbOverflowPixel(pixel) {
  return pixel.alpha > thumbOverflow.minAlpha &&
    relativeLuma(pixel.red, pixel.green, pixel.blue) > thumbOverflow.minLuma;
}

function iconPixelsInsideThumb(png, thumbRect, scale) {
  const inset = Math.round(iconVisibility.thumbEdgeInsetCssPx * scale);
  const left = Math.max(0, Math.floor(thumbRect.x * scale) + inset);
  const right = Math.min(png.width, Math.ceil((thumbRect.x + thumbRect.width) * scale) - inset);
  const top = Math.max(0, Math.floor(thumbRect.y * scale) + inset);
  const bottom = Math.min(png.height, Math.ceil((thumbRect.y + thumbRect.height) * scale) - inset);
  const points = [];

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (isVisibleIconPixel(readPixel(png, x, y))) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

function countRightThumbOverflowPixels(png, layout, scale) {
  const left = Math.floor((layout.thumb.x + layout.thumb.width + thumbOverflow.rightInsetCssPx) * scale);
  const right = png.width;
  const top = Math.floor((layout.thumb.y + thumbOverflow.verticalInsetCssPx) * scale);
  const bottom = Math.ceil((layout.thumb.y + layout.thumb.height - thumbOverflow.verticalInsetCssPx) * scale);
  let overflowPixels = 0;

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (isVisibleThumbOverflowPixel(readPixel(png, x, y))) {
        overflowPixels += 1;
      }
    }
  }

  return overflowPixels;
}

function measureIcon(points, thumbRect, scale) {
  if (points.length === 0) return null;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const thumbCenterX = thumbRect.x + thumbRect.width / 2;
  const thumbCenterY = thumbRect.y + thumbRect.height / 2;

  return {
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2 / scale,
    centerY: (Math.min(...ys) + Math.max(...ys)) / 2 / scale,
    width: (Math.max(...xs) - Math.min(...xs) + 1) / scale,
    height: (Math.max(...ys) - Math.min(...ys) + 1) / scale,
    points: points.map((point) => ({
      x: point.x / scale - thumbCenterX,
      y: point.y / scale - thumbCenterY,
    })),
  };
}

async function measureToggle(page, theme) {
  await page.evaluate((nextTheme) => {
    document.documentElement.dataset.theme = nextTheme;
  }, theme);

  const layout = await page.evaluate(() => {
    const track = document.querySelector(".theme-toggle-track");
    const thumb = document.querySelector(".theme-toggle-thumb");
    if (!track || !thumb) {
      throw new Error("Theme toggle track and thumb must be rendered.");
    }

    const trackRect = track.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();

    return {
      deviceScaleFactor: window.devicePixelRatio,
      thumb: {
        x: thumbRect.left - trackRect.left,
        y: thumbRect.top - trackRect.top,
        width: thumbRect.width,
        height: thumbRect.height,
      },
    };
  });

  const screenshot = await page.locator(".theme-toggle-track").screenshot();
  const png = PNG.sync.read(screenshot);
  const scale = layout.deviceScaleFactor;
  const icon = measureIcon(iconPixelsInsideThumb(png, layout.thumb, scale), layout.thumb, scale);
  const rightThumbOverflowPixels = countRightThumbOverflowPixels(png, layout, scale);

  if (!icon) {
    throw new Error(`Theme toggle ${theme} state has no measurable visible icon inside the thumb.`);
  }

  const thumbCenterX = layout.thumb.x + layout.thumb.width / 2;
  const thumbCenterY = layout.thumb.y + layout.thumb.height / 2;

  return {
    deltaX: Math.abs(icon.centerX - thumbCenterX),
    deltaY: Math.abs(icon.centerY - thumbCenterY),
    iconWidth: icon.width,
    iconHeight: icon.height,
    points: icon.points,
    rightThumbOverflowPixels,
  };
}

function assertCentered(measurement, theme) {
  if (
    measurement.deltaX > iconVisibility.maxCenterDeltaCssPx ||
    measurement.deltaY > iconVisibility.maxCenterDeltaCssPx
  ) {
    throw new Error(
      `Theme toggle ${theme} icon is not centered in the thumb: ` +
        `deltaX=${measurement.deltaX.toFixed(2)}px, deltaY=${measurement.deltaY.toFixed(2)}px.`
    );
  }

  if (
    measurement.iconWidth < iconVisibility.minReadableSizeCssPx ||
    measurement.iconHeight < iconVisibility.minReadableSizeCssPx
  ) {
    throw new Error(
      `Theme toggle ${theme} icon is too small to read: ` +
        `${measurement.iconWidth.toFixed(2)}x${measurement.iconHeight.toFixed(2)}px.`
    );
  }
}

function countIconPixels(measurement, predicate) {
  return measurement.points.filter(predicate).length;
}

function assertSunShape(measurement) {
  const diagonalRays = [
    (point) => point.x < -sunShape.diagonalRayOffsetCssPx && point.y < -sunShape.diagonalRayOffsetCssPx,
    (point) => point.x > sunShape.diagonalRayOffsetCssPx && point.y < -sunShape.diagonalRayOffsetCssPx,
    (point) => point.x < -sunShape.diagonalRayOffsetCssPx && point.y > sunShape.diagonalRayOffsetCssPx,
    (point) => point.x > sunShape.diagonalRayOffsetCssPx && point.y > sunShape.diagonalRayOffsetCssPx,
  ];

  diagonalRays.forEach((rayPredicate, index) => {
    const rayPixels = countIconPixels(measurement, rayPredicate);
    if (rayPixels < sunShape.minDiagonalRayPixels) {
      throw new Error(
        `Theme toggle light state does not render a recognizable sun ray ${index + 1}: ` +
          `${rayPixels} visible pixels, expected at least ${sunShape.minDiagonalRayPixels}.`
      );
    }
  });
}

function assertMoonShape(measurement) {
  const bodyPixels = countIconPixels(
    measurement,
    (point) => point.x < moonShape.bodyMaxXCssPx && Math.abs(point.y) < moonShape.bodyHalfHeightCssPx
  );
  if (bodyPixels < moonShape.minBodyPixels) {
    throw new Error(
      `Theme toggle dark state moon body is too faint: ` +
        `${bodyPixels} visible pixels, expected at least ${moonShape.minBodyPixels}.`
    );
  }

  const bitePixels = countIconPixels(
    measurement,
    (point) => point.x > moonShape.biteMinXCssPx && Math.abs(point.y) < moonShape.biteHalfHeightCssPx
  );
  if (bitePixels > moonShape.maxBitePixels) {
    throw new Error(
      `Theme toggle dark state does not leave a clear crescent bite: ` +
        `${bitePixels} center-right pixels, expected at most ${moonShape.maxBitePixels}.`
    );
  }
}

function assertThumbDoesNotOverflow(measurement, theme) {
  if (measurement.rightThumbOverflowPixels > thumbOverflow.maxPixels) {
    throw new Error(
      `Theme toggle ${theme} thumb visibly overflows on the right: ` +
        `${measurement.rightThumbOverflowPixels} bright pixels outside the thumb, ` +
        `expected at most ${thumbOverflow.maxPixels}.`
    );
  }
}

function assertThemeToggleVisuals(lightMeasurement, darkMeasurement) {
  assertCentered(lightMeasurement, "light");
  assertCentered(darkMeasurement, "dark");
  assertSunShape(lightMeasurement);
  assertMoonShape(darkMeasurement);
  assertThumbDoesNotOverflow(darkMeasurement, "dark");
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
      viewport: { width: 900, height: 220 },
      deviceScaleFactor: 3,
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: ".theme-toggle, .theme-toggle * { transition: none !important; }",
    });
    await page.waitForSelector("[data-theme-toggle]");

    const lightMeasurement = await measureToggle(page, "light");
    const darkMeasurement = await measureToggle(page, "dark");
    assertThemeToggleVisuals(lightMeasurement, darkMeasurement);

    console.log("Theme toggle renders centered, recognizable sun and moon icons without dark thumb overflow.");
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
