const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const siteUrl = "https://yezizhuang.top/";
const firstPostUrl = `${siteUrl}posts/first-post.html`;

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function rebuildSiteAssets() {
  const result = spawnSync(process.execPath, [path.join(rootDir, "scripts", "build-site-assets.js")], {
    cwd: rootDir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`Site asset build failed:\n${result.stderr || result.stdout}`);
  }
}

function parseAttributes(tag) {
  return Object.fromEntries(
    Array.from(tag.matchAll(/\s([a-zA-Z:-]+)="([^"]*)"/g), (match) => [match[1].toLowerCase(), match[2]])
  );
}

function parseSitemapLocations() {
  return Array.from(readFile("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
}

function readPageSearchMetadata(relativePath) {
  const html = readFile(relativePath);
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim() || "";
  const canonicalTag = html.match(/<link\b[^>]*\brel="canonical"[^>]*>/i)?.[0] || "";
  const canonical = parseAttributes(canonicalTag).href || "";
  const metaTags = Array.from(html.matchAll(/<meta\b[^>]*>/gi), (match) => parseAttributes(match[0]));
  const jsonLdScripts = Array.from(
    html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1].trim()
  );

  const meta = (selectorName, selectorValue) => {
    const tag = metaTags.find((candidate) => candidate[selectorName] === selectorValue);
    return tag ? (tag.content || "").trim() : "";
  };

  return {
    canonical: canonical.trim(),
    description: meta("name", "description"),
    ogTitle: meta("property", "og:title"),
    ogUrl: meta("property", "og:url"),
    robots: meta("name", "robots"),
    structuredData: jsonLdScripts.map((text) => {
      try {
        return JSON.parse(text || "null");
      } catch (error) {
        return { parseError: error.message };
      }
    }),
    title,
  };
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected "${expected}", got "${actual}".`);
  }
}

function assertIncludes(value, expectedText, message) {
  if (!value.includes(expectedText)) {
    throw new Error(`${message}. Expected "${value}" to include "${expectedText}".`);
  }
}

function homepageStructuredData(metadata) {
  const graph = metadata.structuredData.flatMap((entry) => entry && Array.isArray(entry["@graph"]) ? entry["@graph"] : [entry]);
  return {
    blog: graph.find((entry) => entry && entry["@type"] === "Blog"),
    parseErrors: graph.filter((entry) => entry && entry.parseError),
    website: graph.find((entry) => entry && entry["@type"] === "WebSite"),
  };
}

function assertHomepageIsSearchEntry(metadata) {
  assertEqual(metadata.canonical, siteUrl, "Homepage canonical should point to the root domain");
  assertEqual(metadata.ogUrl, siteUrl, "Homepage Open Graph URL should point to the root domain");
  assertEqual(metadata.robots, "index,follow", "Homepage should be indexable");
  assertIncludes(metadata.title, "风迁夏回", "Homepage title should identify the blog");
  assertIncludes(metadata.description, "个人博客", "Homepage description should describe the blog");
  assertIncludes(metadata.ogTitle, "风迁夏回", "Homepage Open Graph title should identify the blog");

  const { blog, parseErrors, website } = homepageStructuredData(metadata);
  if (parseErrors.length > 0) {
    throw new Error(`Homepage JSON-LD should parse. First error: ${parseErrors[0].parseError}`);
  }

  if (!website || website.url !== siteUrl) {
    throw new Error("Homepage JSON-LD should expose the root domain as the WebSite URL.");
  }

  if (!blog || blog.url !== siteUrl) {
    throw new Error("Homepage JSON-LD should expose the root domain as the Blog URL.");
  }
}

function assertFirstPostIsNotPreferredSearchEntry() {
  const firstPostMetadata = readPageSearchMetadata("posts/first-post.html");
  const sitemapLocations = parseSitemapLocations();

  assertEqual(firstPostMetadata.robots, "noindex,follow", "The old first post should not be indexable");

  if (sitemapLocations.includes(firstPostUrl)) {
    throw new Error("The old first post should be absent from sitemap.xml so search engines prefer the homepage and current posts.");
  }
}

function run() {
  rebuildSiteAssets();

  const metadata = readPageSearchMetadata("index.html");

  assertHomepageIsSearchEntry(metadata);
  assertFirstPostIsNotPreferredSearchEntry();

  console.log("Homepage is the preferred search entry and the old first post is de-indexed.");
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
