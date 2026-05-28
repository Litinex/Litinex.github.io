const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");
const baseUrl = "https://yezizhuang.top";

const staticPages = [
  { path: "/", changefreq: "weekly", priority: "1.0", useLatestPostDate: true },
  { path: "/about.html", lastmod: "2026-04-25", changefreq: "monthly", priority: "0.7" },
  { path: "/archive.html", changefreq: "weekly", priority: "0.8", useLatestPostDate: true },
];

function readPostsData() {
  const file = path.join(rootDir, "posts-data.js");
  const source = fs.readFileSync(file, "utf8");
  const sandbox = { window: {} };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: file });

  const posts = sandbox.window.__BLOG_POSTS__;
  if (!Array.isArray(posts)) {
    throw new Error("posts-data.js did not expose window.__BLOG_POSTS__ as an array.");
  }

  return posts;
}

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value) {
  const text = safeText(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizePost(post, index) {
  const href = safeText(post && post.href);
  const title = safeText(post && post.title);
  const date = normalizeDate(post && post.date);
  const updated = normalizeDate((post && post.updated) || date);

  if (!href) {
    throw new Error(`Post ${index + 1} is missing href.`);
  }

  if (!title) {
    throw new Error(`Post ${href} is missing title.`);
  }

  if (!date) {
    throw new Error(`Post ${href} is missing a YYYY-MM-DD date.`);
  }

  const absoluteFile = path.join(rootDir, href.replace(/\//g, path.sep));
  if (!fs.existsSync(absoluteFile)) {
    throw new Error(`Post file does not exist: ${href}`);
  }

  return { ...post, href, title, date, updated: updated || date };
}

function newestDate(posts) {
  return posts.reduce((latest, post) => {
    const value = post.updated || post.date;
    return value > latest ? value : latest;
  }, "1970-01-01");
}

function buildUrlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <lastmod>${xmlEscape(lastmod)}</lastmod>`,
    `    <changefreq>${xmlEscape(changefreq)}</changefreq>`,
    `    <priority>${xmlEscape(priority)}</priority>`,
    "  </url>",
  ].join("\n");
}

function buildSitemap(posts) {
  const latest = newestDate(posts);
  const entries = [];

  staticPages.forEach((page) => {
    entries.push({
      loc: `${baseUrl}${page.path}`,
      lastmod: page.useLatestPostDate ? latest : page.lastmod,
      changefreq: page.changefreq,
      priority: page.priority,
    });
  });

  posts.forEach((post) => {
    entries.push({
      loc: `${baseUrl}/${post.href}`,
      lastmod: post.updated || post.date,
      changefreq: "monthly",
      priority: "0.8",
    });
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.map(buildUrlEntry).join("\n"),
    "</urlset>",
    "",
  ].join("\n");
}

function main() {
  const posts = readPostsData().map(normalizePost);
  const sitemap = buildSitemap(posts);
  const sitemapPath = path.join(rootDir, "sitemap.xml");

  fs.writeFileSync(sitemapPath, sitemap, "utf8");
  console.log(`Generated sitemap.xml from ${posts.length} posts.`);
}

main();
