const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const fontFamilies = [
  { name: "Noto Serif SC", slug: "noto-serif-sc", weights: "400..600", license: "notoserifsc" },
  { name: "Manrope", slug: "manrope", weights: "400..600", license: "manrope" },
  { name: "JetBrains Mono", slug: "jetbrains-mono", weights: "400..500", license: "jetbrainsmono" },
];
const browserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const subsetCharacterLimit = 512;
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);

function writeChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(Buffer.from(content))) return;
  fs.writeFileSync(file, content);
}

function uniqueCharacters(text) {
  return [...new Set(text)].sort().join("");
}

function nonAsciiCharacters(source) {
  const decoded = source
    .replace(/\\u([a-f\d]{4})/gi, (_, value) => String.fromCharCode(Number.parseInt(value, 16)))
    .replace(/&#(x[a-f\d]+|\d+);/gi, (_, value) => String.fromCodePoint(
      Number.parseInt(value.replace(/^x/i, ""), /^x/i.test(value) ? 16 : 10)));
  return [...decoded].filter((character) => {
    const point = character.codePointAt(0);
    return point > 0x7f && point <= 0xffff && point !== 0xfeff;
  }).join("");
}

function latinCharacters() {
  const ranges = [[0x20, 0x7e], [0xa0, 0xff], [0x2000, 0x206f]]
    .flatMap(([start, end]) => Array.from({ length: end - start + 1 }, (_, index) =>
      String.fromCodePoint(start + index))).join("");
  // Match the original Latin face, including the arrows used in navigation.
  const symbols = [0x131, 0x152, 0x153, 0x2bb, 0x2bc, 0x2c6, 0x2da, 0x2dc,
    0x304, 0x308, 0x329, 0x20ac, 0x2122, 0x2191, 0x2193, 0x2212, 0x2215, 0xfffd];
  return ranges + String.fromCodePoint(...symbols);
}

function fontApiUrl(family, text) {
  const query = new URLSearchParams({ family: `${family.name}:wght@${family.weights}`, display: "swap" });
  if (text !== undefined) query.set("text", text);
  return `https://fonts.googleapis.com/css2?${query}`;
}

async function fetchResource(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": browserAgent }, signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Font resource returned ${response.status}: ${url.split("?")[0]}`);
  return Buffer.from(await response.arrayBuffer());
}

async function ensureFallbacks(fontDirectory) {
  const fallbackFile = path.join(fontDirectory, "fallback.css");
  if (!fs.existsSync(fallbackFile)) {
    const sheets = [];
    for (const family of fontFamilies) {
      const css = (await fetchResource(fontApiUrl(family))).toString("utf8");
      if (!css.includes("@font-face") || !css.includes("format('woff2')")) {
        throw new Error(`Missing WOFF2 fallback for ${family.name}`);
      }
      sheets.push(css.replaceAll(`font-family: '${family.name}'`, `font-family: '${family.name} Fallback'`));
    }
    writeChanged(fallbackFile, "/* Original families, requested only for characters absent from local subsets. */\n" + sheets.join("\n"));
  }
  for (const family of fontFamilies) {
    const licenseFile = path.join(fontDirectory, `${family.slug}-OFL.txt`);
    if (!fs.existsSync(licenseFile)) {
      const license = await fetchResource(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family.license}/OFL.txt`);
      if (!license.toString("utf8").includes("SIL OPEN FONT LICENSE")) {
        throw new Error(`Missing font license for ${family.name}`);
      }
      writeChanged(licenseFile, license.toString("utf8").replace(/[ \t]+$/gm, ""));
    }
  }
}

async function localSubset(family, characters, fontDirectory, cache) {
  const key = digest(JSON.stringify([family.name, family.weights, characters]));
  const cached = cache[key];
  if (cached && cached.files.every((file) => fs.existsSync(path.join(fontDirectory, file)))) return cached;

  const source = fontApiUrl(family, characters);
  const css = (await fetchResource(source)).toString("utf8");
  if (!css.includes("format('woff2')")) throw new Error(`No WOFF2 subset returned for ${family.name}`);
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((match) => match[1]))];
  if (urls.length === 0) throw new Error(`Empty font subset for ${family.name}`);
  let localCss = css;
  const files = [];
  for (const url of urls) {
    const bytes = await fetchResource(url);
    if (bytes.subarray(0, 4).toString() !== "wOF2") throw new Error(`Invalid WOFF2 for ${family.name}`);
    const filename = `${family.slug}-${digest(bytes)}.woff2`;
    writeChanged(path.join(fontDirectory, filename), bytes);
    localCss = localCss.replaceAll(url, `./${filename}`);
    files.push(filename);
  }
  cache[key] = { family: family.name, source, files, css: localCss };
  console.log(`  Font subset: ${family.name}, ${[...characters].length} characters`);
  return cache[key];
}

async function subsetStyles(family, text, fontDirectory, cache) {
  const characters = [...uniqueCharacters(text)];
  const entries = [];
  for (let offset = 0; offset < characters.length; offset += subsetCharacterLimit) {
    entries.push(await localSubset(family, characters.slice(offset, offset + subsetCharacterLimit).join(""), fontDirectory, cache));
  }
  return entries;
}

async function buildFontAssets(rootDirectory, pages, posts) {
  const fontDirectory = path.join(rootDirectory, "assets", "fonts");
  fs.mkdirSync(fontDirectory, { recursive: true });
  const cacheFile = path.join(fontDirectory, "catalog.json");
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
  await ensureFallbacks(fontDirectory);

  const commonSources = [
    ...pages.filter((file) => path.dirname(file) === rootDirectory),
    ...["hero-poem.js", "learning-progress.js", "taxonomy.js", "article-reader.js", "home-essays.js"]
      .map((name) => path.join(rootDirectory, name)),
  ];
  const commonText = uniqueCharacters(latinCharacters() + nonAsciiCharacters(
    commonSources.map((file) => fs.readFileSync(file, "utf8")).join("") + posts.map((post) => post.title).join("")));
  const commonCharacters = new Set(commonText);
  const serifEntries = await subsetStyles(fontFamilies[0], commonText, fontDirectory, cache);
  const commonEntries = [...serifEntries];
  for (const family of fontFamilies.slice(1)) {
    commonEntries.push(...await subsetStyles(family, latinCharacters(), fontDirectory, cache));
  }
  writeChanged(path.join(fontDirectory, "common.css"), commonEntries.map((entry) => entry.css).join("\n"));

  const pageSheets = new Map();
  // Each article only carries characters absent from the shared interface/title subset.
  for (const page of pages) {
    const additional = uniqueCharacters(nonAsciiCharacters(fs.readFileSync(page, "utf8")))
      .split("").filter((character) => !commonCharacters.has(character)).join("");
    if (!additional) continue;
    const entries = await subsetStyles(fontFamilies[0], additional, fontDirectory, cache);
    const stylesheet = `page-${path.basename(page, ".html")}.css`;
    writeChanged(path.join(fontDirectory, stylesheet), entries.map((entry) => entry.css).join("\n"));
    pageSheets.set(page, stylesheet);
    writeChanged(cacheFile, JSON.stringify(cache, null, 2) + "\n");
  }
  writeChanged(cacheFile, JSON.stringify(cache, null, 2) + "\n");
  return { preload: serifEntries[0].files[0], pageSheets };
}

function renderFontAssets(html, pageFile, rootDirectory, assets) {
  const relativeRoot = path.relative(path.dirname(pageFile), rootDirectory).replaceAll("\\", "/");
  const prefix = relativeRoot ? `${relativeRoot}/` : "";
  const links = [
    `  <!-- font-assets -->`,
    `  <link rel="preload" href="${prefix}assets/fonts/${assets.preload}" as="font" type="font/woff2" crossorigin>`,
    `  <link rel="stylesheet" href="${prefix}assets/fonts/fallback.css">`,
    `  <link rel="stylesheet" href="${prefix}assets/fonts/common.css">`,
  ];
  const pageSheet = assets.pageSheets.get(pageFile);
  if (pageSheet) links.push(`  <link rel="stylesheet" href="${prefix}assets/fonts/${pageSheet}">`);
  links.push("  <!-- /font-assets -->");
  const block = links.join("\n");
  const withoutPreconnects = html.replace(/^.*<link\b[^>]*rel="preconnect"[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>\n/gm, "");
  if (withoutPreconnects.includes("<!-- font-assets -->")) {
    return withoutPreconnects.replace(/^ *<!-- font-assets -->\n[\s\S]*?^ *<!-- \/font-assets -->/m, block);
  }
  const googleLink = /^.*<link\b[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?[^>]*>$/m;
  if (!googleLink.test(withoutPreconnects)) throw new Error(`Missing font asset slot: ${pageFile}`);
  return withoutPreconnects.replace(googleLink, block);
}

module.exports = { buildFontAssets, renderFontAssets };
