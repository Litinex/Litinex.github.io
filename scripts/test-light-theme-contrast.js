const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const port = Number.parseInt(process.env.TEST_PORT || "4181", 10);
const minContrastRatio = 4.5;

const { PNG } = requireWorkspaceDependency("pngjs");
const { chromium } = requireWorkspaceDependency("playwright");

function parseColor(value) {
  const normalizedValue = value.trim();

  if (normalizedValue.startsWith("#")) {
    const hex = normalizedValue.slice(1);
    const expandedHex = hex.length === 3
      ? hex.split("").map((character) => character + character).join("")
      : hex;

    if (expandedHex.length === 6) {
      return [
        Number.parseInt(expandedHex.slice(0, 2), 16),
        Number.parseInt(expandedHex.slice(2, 4), 16),
        Number.parseInt(expandedHex.slice(4, 6), 16),
      ];
    }
  }

  const match = normalizedValue.match(/rgba?\(([^)]+)\)/);
  if (!match) {
    throw new Error(`Unsupported color value: ${value}`);
  }

  return match[1]
    .split(",")
    .slice(0, 3)
    .map((part) => Number.parseFloat(part.trim()));
}

function relativeLuminance([red, green, blue]) {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function pixelAt(png, point) {
  const x = Math.max(0, Math.min(png.width - 1, point.x));
  const y = Math.max(0, Math.min(png.height - 1, point.y));
  const index = (y * png.width + x) * 4;
  const alpha = png.data[index + 3] / 255;

  if (alpha === 0) {
    return [255, 255, 255];
  }

  return [
    Math.round(png.data[index] * alpha + 255 * (1 - alpha)),
    Math.round(png.data[index + 1] * alpha + 255 * (1 - alpha)),
    Math.round(png.data[index + 2] * alpha + 255 * (1 - alpha)),
  ];
}

function rgbText([red, green, blue]) {
  return `rgb(${red}, ${green}, ${blue})`;
}

function isInsideRect(point, rect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
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

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
    await page.waitForSelector(".essay-item.is-latest .essay-title");

    const result = await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";

      const title = document.querySelector(".essay-item.is-latest .essay-title");
      const card = document.querySelector(".essay-item.is-latest .post-card-inner");
      const titleStyle = window.getComputedStyle(title);
      const textRange = document.createRange();
      textRange.selectNodeContents(title);
      const textRect = textRange.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const y = Math.round(textRect.top + textRect.height / 2);
      const candidatePoints = [
        { x: Math.round(textRect.right + 24), y },
        { x: Math.round(textRect.left - 24), y },
        { x: Math.round(textRect.right + 48), y },
        { x: Math.round(textRect.left - 48), y },
      ];
      const samplePoint = candidatePoints.find((point) => {
        return (
          point.x >= cardRect.left + 12 &&
          point.x <= cardRect.right - 12 &&
          !(
            point.x >= textRect.left &&
            point.x <= textRect.right &&
            point.y >= textRect.top &&
            point.y <= textRect.bottom
          )
        );
      });

      if (!samplePoint) {
        throw new Error("Unable to find a background sample point near the latest essay title.");
      }

      return {
        title: title.textContent.trim(),
        titleColor: titleStyle.color,
        backgroundSamplePoint: samplePoint,
        textRect: {
          left: textRect.left,
          right: textRect.right,
          top: textRect.top,
          bottom: textRect.bottom,
        },
      };
    });

    await page.waitForTimeout(50);
    const screenshot = await page.screenshot();
    const png = PNG.sync.read(screenshot);
    const foreground = parseColor(result.titleColor);
    const background = pixelAt(png, result.backgroundSamplePoint);
    const ratio = contrastRatio(foreground, background);

    if (isInsideRect(result.backgroundSamplePoint, result.textRect)) {
      throw new Error("Background sample point overlaps the latest essay title text.");
    }

    if (ratio < minContrastRatio) {
      throw new Error(
        `Light theme latest essay title contrast is ${ratio.toFixed(2)}:1, expected at least ${minContrastRatio}:1. ` +
          `Title "${result.title}" uses ${result.titleColor} on sampled background ${rgbText(background)}.`
      );
    }

    console.log(`Light theme latest essay title contrast: ${ratio.toFixed(2)}:1`);
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
