const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const port = Number.parseInt(process.env.TEST_PORT || "4183", 10);
const borderSampleOffsetCssPx = 0.5;
const surfaceSampleOffsetCssPx = 6;
const verticalInsetCssPx = 16;
const maxOuterRimLumaDelta = 16;
const maxOuterHaloLumaDelta = 4;
const maxDarkPaperGutterLuma = 95;
// Baseline samples the paper gutter beside the editor; halo samples the band
// directly below the editor where the previous shadow formed a visible ring.
const baselineOffsetFromEditorRightCssPx = 10;
const baselineSampleWidthCssPx = 18;
const baselineVerticalInsetCssPx = 28;
const haloHorizontalInsetCssPx = 24;
const haloOffsetBelowEditorCssPx = 10;
const haloSampleHeightCssPx = 14;
const transparentBackgroundColor = "rgba(0, 0, 0, 0)";

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
  assertColumnWithinImage(png, x, top, bottom, "rim column sample");
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

function assertColumnWithinImage(png, x, top, bottom, label) {
  const isValidRange = top < bottom;
  const isInsideImage = x >= 0 && x < png.width && top >= 0 && bottom <= png.height;

  if (!isValidRange || !isInsideImage) {
    throw new Error(
      `${label} is outside the screenshot: ` +
        `x=${x}, top=${top}, bottom=${bottom}, image=${png.width}x${png.height}.`
    );
  }
}

function averageLumaForRect(png, rect, label) {
  assertRectWithinImage(png, rect, label);
  let total = 0;
  let count = 0;

  for (let y = rect.top; y < rect.bottom; y += 1) {
    for (let x = rect.left; x < rect.right; x += 1) {
      const pixel = readPixel(png, x, y);
      if (pixel.alpha === 0) continue;

      total += relativeLuma(pixel.red, pixel.green, pixel.blue);
      count += 1;
    }
  }

  if (count === 0) {
    throw new Error("Unable to sample code editor halo pixels.");
  }

  return total / count;
}

function assertRectWithinImage(png, rect, label) {
  const isValidRect = rect.left < rect.right && rect.top < rect.bottom;
  const isInsideImage =
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.right <= png.width &&
    rect.bottom <= png.height;

  if (!isValidRect || !isInsideImage) {
    throw new Error(
      `${label} rectangle is outside the screenshot: ` +
        `rect=${JSON.stringify(rect)}, image=${png.width}x${png.height}.`
    );
  }
}

async function codeEditorDocumentBox(page) {
  const editorBox = await page.evaluate(() => {
    const editor = document.querySelector(".code-editor");
    if (!editor) return null;

    const rect = editor.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  });

  if (!editorBox) {
    throw new Error("Code editor must be rendered before measuring its dark rim.");
  }

  return editorBox;
}

async function measureDarkCodeEditorRim(page) {
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });

  const editorBox = await codeEditorDocumentBox(page);
  const screenshot = await page.screenshot({ fullPage: true });
  const png = PNG.sync.read(screenshot);
  const scale = await page.evaluate(() => window.devicePixelRatio);

  const borderX = Math.round((editorBox.x + borderSampleOffsetCssPx) * scale);
  const surfaceX = Math.round((editorBox.x + surfaceSampleOffsetCssPx) * scale);
  const top = Math.round((editorBox.y + verticalInsetCssPx) * scale);
  const bottom = Math.round((editorBox.y + editorBox.height - verticalInsetCssPx) * scale);
  const borderLuma = averageLumaForColumn(png, borderX, top, bottom);
  const surfaceLuma = averageLumaForColumn(png, surfaceX, top, bottom);

  return {
    borderLuma,
    surfaceLuma,
    lumaDelta: borderLuma - surfaceLuma,
  };
}

async function measureDarkCodeEditorHalo(page) {
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });

  const editorBox = await codeEditorDocumentBox(page);
  const screenshot = await page.screenshot({ fullPage: true });
  const png = PNG.sync.read(screenshot);
  const scale = await page.evaluate(() => window.devicePixelRatio);
  const leftEdge = editorBox.x * scale;
  const rightEdge = (editorBox.x + editorBox.width) * scale;
  const topEdge = editorBox.y * scale;
  const bottomEdge = (editorBox.y + editorBox.height) * scale;
  const baselineRect = {
    left: Math.round(rightEdge + baselineOffsetFromEditorRightCssPx * scale),
    right: Math.round(rightEdge + (baselineOffsetFromEditorRightCssPx + baselineSampleWidthCssPx) * scale),
    top: Math.round(topEdge + baselineVerticalInsetCssPx * scale),
    bottom: Math.round(bottomEdge - baselineVerticalInsetCssPx * scale),
  };
  const haloRect = {
    left: Math.round(leftEdge + haloHorizontalInsetCssPx * scale),
    right: Math.round(rightEdge - haloHorizontalInsetCssPx * scale),
    top: Math.round(bottomEdge + haloOffsetBelowEditorCssPx * scale),
    bottom: Math.round(bottomEdge + (haloOffsetBelowEditorCssPx + haloSampleHeightCssPx) * scale),
  };
  const baselineLuma = averageLumaForRect(png, baselineRect, "paper baseline sample");
  const shadowLuma = averageLumaForRect(png, haloRect, "editor halo sample");

  return {
    paperGutterLuma: baselineLuma,
    shadowLuma,
    lumaDelta: Math.abs(shadowLuma - baselineLuma),
  };
}

async function readDarkCodeChrome(page, codeSelector, inheritedColorSelector) {
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });

  return page.evaluate(
    ({ codeSelector: targetCodeSelector, inheritedColorSelector: targetColorSelector }) => {
      const codeElement = document.querySelector(targetCodeSelector);
      const inheritedColorElement = document.querySelector(targetColorSelector);
      if (!codeElement) {
        throw new Error(`Unable to find code element for selector: ${targetCodeSelector}`);
      }
      if (!inheritedColorElement) {
        throw new Error(`Unable to find inherited color element for selector: ${targetColorSelector}`);
      }

      const codeStyle = getComputedStyle(codeElement);
      const inheritedStyle = getComputedStyle(inheritedColorElement);

      return {
        backgroundColor: codeStyle.backgroundColor,
        borderTopWidth: codeStyle.borderTopWidth,
        borderRightWidth: codeStyle.borderRightWidth,
        borderBottomWidth: codeStyle.borderBottomWidth,
        borderLeftWidth: codeStyle.borderLeftWidth,
        paddingTop: codeStyle.paddingTop,
        paddingRight: codeStyle.paddingRight,
        paddingBottom: codeStyle.paddingBottom,
        paddingLeft: codeStyle.paddingLeft,
        codeColor: codeStyle.color,
        inheritedColor: inheritedStyle.color,
      };
    },
    { codeSelector, inheritedColorSelector }
  );
}

function assertCodeChromeReset(style, label) {
  assertTransparentBackground(style.backgroundColor, `${label} background`);
  assertZeroCssLength(style.borderTopWidth, `${label} top border`);
  assertZeroCssLength(style.borderRightWidth, `${label} right border`);
  assertZeroCssLength(style.borderBottomWidth, `${label} bottom border`);
  assertZeroCssLength(style.borderLeftWidth, `${label} left border`);
  assertZeroCssLength(style.paddingTop, `${label} top padding`);
  assertZeroCssLength(style.paddingRight, `${label} right padding`);
  assertZeroCssLength(style.paddingBottom, `${label} bottom padding`);
  assertZeroCssLength(style.paddingLeft, `${label} left padding`);

  if (style.codeColor !== style.inheritedColor) {
    throw new Error(
      `${label} should inherit its container text color: ` +
        `code=${style.codeColor}, inherited=${style.inheritedColor}.`
    );
  }
}

function assertTransparentBackground(value, label) {
  if (value !== transparentBackgroundColor && value !== "transparent") {
    throw new Error(`${label} should be transparent, but got ${value}.`);
  }
}

function assertZeroCssLength(value, label) {
  const pixels = Number.parseFloat(value);
  if (!Number.isFinite(pixels) || Math.abs(pixels) > 0.01) {
    throw new Error(`${label} should be 0px, but got ${value}.`);
  }
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

    const rimMeasurement = await measureDarkCodeEditorRim(page);
    if (rimMeasurement.lumaDelta > maxOuterRimLumaDelta) {
      throw new Error(
        `Dark theme code editor outer rim is too bright: ` +
          `border/surface luma delta=${rimMeasurement.lumaDelta.toFixed(2)}, ` +
          `expected at most ${maxOuterRimLumaDelta}.`
      );
    }

    const haloMeasurement = await measureDarkCodeEditorHalo(page);
    if (haloMeasurement.lumaDelta > maxOuterHaloLumaDelta) {
      throw new Error(
        `Dark theme code editor outer halo is too visible: ` +
          `shadow/paper luma delta=${haloMeasurement.lumaDelta.toFixed(2)}, ` +
          `expected at most ${maxOuterHaloLumaDelta}.`
      );
    }

    if (haloMeasurement.paperGutterLuma > maxDarkPaperGutterLuma) {
      throw new Error(
        `Dark theme code editor surrounding paper is too bright: ` +
          `gutter luma=${haloMeasurement.paperGutterLuma.toFixed(2)}, ` +
          `expected at most ${maxDarkPaperGutterLuma}.`
      );
    }

    const editorCodeStyle = await readDarkCodeChrome(
      page,
      ".article-body .code-editor code",
      ".article-body .code-editor"
    );
    assertCodeChromeReset(editorCodeStyle, "Dark theme code editor code");

    const plainCodePage = await browser.newPage({
      viewport: { width: 920, height: 760 },
      deviceScaleFactor: 3,
    });
    try {
      await plainCodePage.route(/code-blocks\.js/, (route) => route.abort());
      await plainCodePage.goto(`http://127.0.0.1:${port}/posts/python-list-basic-usage.html`, {
        waitUntil: "domcontentloaded",
      });
      await plainCodePage.waitForSelector(".article-body pre code");

      const plainPreCodeStyle = await readDarkCodeChrome(
        plainCodePage,
        ".article-body pre code",
        ".article-body pre"
      );
      assertCodeChromeReset(plainPreCodeStyle, "Dark theme plain pre code");
    } finally {
      await plainCodePage.close();
    }

    console.log(
      `Dark theme code editor rim luma delta: ${rimMeasurement.lumaDelta.toFixed(2)}, ` +
        `halo luma delta: ${haloMeasurement.lumaDelta.toFixed(2)}, ` +
        `paper gutter luma: ${haloMeasurement.paperGutterLuma.toFixed(2)}, ` +
        `code block chrome reset verified`
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
