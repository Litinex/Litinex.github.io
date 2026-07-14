const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");
const baseUrl = "https://yezizhuang.top";

const staticPages = [
  { path: "/", lastmod: "2026-06-20", changefreq: "weekly", priority: "1.0", useLatestPostDate: true },
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
  const id = safeText(post && post.id);
  const href = safeText(post && post.href);
  const title = safeText(post && post.title);
  const date = normalizeDate(post && post.date);
  const updated = normalizeDate((post && post.updated) || date);

  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Post ${href || index + 1} is missing a stable kebab-case id.`);
  }

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

  return { ...post, id, href, title, date, updated: updated || date };
}

function validateUniquePostMetadata(posts) {
  const ids = new Set();
  const hrefs = new Set();
  const seriesPositions = new Map();

  posts.forEach((post) => {
    if (ids.has(post.id)) {
      throw new Error(`Duplicate post id: ${post.id}`);
    }
    ids.add(post.id);

    if (hrefs.has(post.href)) {
      throw new Error(`Duplicate post href: ${post.href}`);
    }
    hrefs.add(post.href);

    const seriesId = safeText(post.series && post.series.id);
    const seriesIndex = Number(post.series && post.series.index);
    if (!seriesId) return;
    if (!Number.isInteger(seriesIndex) || seriesIndex < 1) {
      throw new Error(`Post ${post.id} has an invalid series index.`);
    }

    const positionKey = `${seriesId}:${seriesIndex}`;
    if (seriesPositions.has(positionKey)) {
      throw new Error(
        `Duplicate series position ${positionKey}: ${seriesPositions.get(positionKey)} and ${post.id}.`
      );
    }
    seriesPositions.set(positionKey, post.id);
  });
}

function validateArticleMarkup(posts) {
  const globalCodeIds = new Map();

  posts.forEach((post) => {
    const absoluteFile = path.join(rootDir, post.href.replace(/\//g, path.sep));
    const html = fs.readFileSync(absoluteFile, "utf8");
    const bodyTag = html.match(/<body\b[^>]*>/i)?.[0] || "";
    const declaredPostId = bodyTag.match(/\bdata-post-id="([^"]+)"/i)?.[1] || "";
    if (declaredPostId !== post.id) {
      throw new Error(`Post ${post.href} must declare data-post-id="${post.id}" on its body element.`);
    }

    const codeBlocks = Array.from(html.matchAll(/<pre\b([^>]*)>\s*<code\b/gi));
    codeBlocks.forEach((match, index) => {
      const codeId = match[1].match(/\bdata-code-id="([^"]+)"/i)?.[1] || "";
      if (!codeId) {
        throw new Error(`Code block ${index + 1} in ${post.href} is missing data-code-id.`);
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(codeId)) {
        throw new Error(`Code block id ${codeId} in ${post.href} must use kebab-case.`);
      }
      if (globalCodeIds.has(codeId)) {
        throw new Error(`Duplicate code block id ${codeId}: ${globalCodeIds.get(codeId)} and ${post.href}.`);
      }
      globalCodeIds.set(codeId, post.href);
    });
  });
}

function newestDate(posts) {
  return posts.reduce((latest, post) => {
    const value = post.updated || post.date;
    return value > latest ? value : latest;
  }, "1970-01-01");
}

function indexablePosts(posts) {
  return posts.filter((post) => post.indexable !== false);
}

function pageLastmod(page, latestPostDate) {
  if (!page.useLatestPostDate) {
    return page.lastmod;
  }

  return page.lastmod && page.lastmod > latestPostDate ? page.lastmod : latestPostDate;
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
  const postsForSitemap = indexablePosts(posts);
  const latest = newestDate(postsForSitemap);
  const entries = [];

  staticPages.forEach((page) => {
    entries.push({
      loc: `${baseUrl}${page.path}`,
      lastmod: pageLastmod(page, latest),
      changefreq: page.changefreq,
      priority: page.priority,
    });
  });

  postsForSitemap.forEach((post) => {
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

function postTags(post) {
  return Array.isArray(post.tags)
    ? Array.from(new Set(post.tags.map(safeText).filter(Boolean)))
    : [];
}

function buildRelatedPosts(posts) {
  const publicPosts = indexablePosts(posts);
  const tagCounts = new Map();

  publicPosts.forEach((post) => {
    postTags(post).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
  });

  const related = {};

  posts.forEach((current) => {
    const currentTags = new Set(postTags(current));
    const currentSeriesId = safeText(current.series && current.series.id);
    const currentSeriesIndex = Number(current.series && current.series.index);

    const candidates = publicPosts
      .filter((candidate) => candidate.id !== current.id)
      .map((candidate) => {
        const candidateSeriesId = safeText(candidate.series && candidate.series.id);
        const candidateSeriesIndex = Number(candidate.series && candidate.series.index);
        const sameSeries = Boolean(currentSeriesId && currentSeriesId === candidateSeriesId);
        const sharedTags = postTags(candidate).filter((tag) => currentTags.has(tag));
        let score = sameSeries ? 10 : 0;

        sharedTags.forEach((tag) => {
          const frequency = tagCounts.get(tag) || 1;
          score += frequency <= 2 ? 4 : frequency <= 4 ? 2 : 1;
        });

        if (safeText(current.category) && current.category === candidate.category) {
          score += 2;
        }

        if (
          sameSeries &&
          Number.isFinite(currentSeriesIndex) &&
          Number.isFinite(candidateSeriesIndex) &&
          Math.abs(currentSeriesIndex - candidateSeriesIndex) === 1
        ) {
          score += 3;
        }

        const reasons = [];
        if (sameSeries) reasons.push(`同属“${safeText(current.series.name) || currentSeriesId}”系列`);
        if (sharedTags.length > 0) reasons.push(`共同标签：${sharedTags.slice(0, 3).join("、")}`);
        if (reasons.length === 0 && current.category === candidate.category) {
          reasons.push(`同属“${safeText(current.category)}”分类`);
        }

        return { candidate, reasons, score };
      })
      .filter((entry) => entry.score >= 2)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.candidate.updated || b.candidate.date).localeCompare(a.candidate.updated || a.candidate.date);
      })
      .slice(0, 3)
      .map(({ candidate, reasons }) => ({ id: candidate.id, reason: reasons.join(" · ") }));

    if (candidates.length > 0) {
      related[current.id] = candidates;
    }
  });

  return related;
}

function buildRelatedPostsScript(posts) {
  const related = buildRelatedPosts(posts);
  return [
    "/* eslint-disable */",
    "(() => {",
    `  window.__BLOG_RELATED_POSTS__ = ${JSON.stringify(related, null, 2)};`,
    "})();",
    "",
  ].join("\n");
}

function main() {
  const posts = readPostsData().map(normalizePost);
  validateUniquePostMetadata(posts);
  validateArticleMarkup(posts);
  const sitemap = buildSitemap(posts);
  const sitemapPath = path.join(rootDir, "sitemap.xml");
  const relatedPostsPath = path.join(rootDir, "related-posts-data.js");

  fs.writeFileSync(sitemapPath, sitemap, "utf8");
  fs.writeFileSync(relatedPostsPath, buildRelatedPostsScript(posts), "utf8");
  console.log(`Generated sitemap.xml and related-posts-data.js from ${posts.length} posts.`);
}

main();
