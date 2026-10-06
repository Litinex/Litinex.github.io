const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
} = require("./test-helpers");

const port = Number.parseInt(process.env.TEST_PORT || "4188", 10);
const { chromium } = requireWorkspaceDependency("playwright");
const rootDir = path.resolve(__dirname, "..");

function readPostsData() {
  const source = fs.readFileSync(path.join(rootDir, "posts-data.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "posts-data.js" });
  return sandbox.window.__BLOG_POSTS__;
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

    async function loadHomepage(postsOverride) {
      const page = await browser.newPage();
      if (postsOverride) {
        await page.route("**/posts-data.js?*", (route) => route.fulfill({
          contentType: "text/javascript; charset=utf-8",
          body: `window.__BLOG_POSTS__ = ${JSON.stringify(postsOverride)};`,
        }));
      }

      try {
        await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
        return await page.evaluate(() => {
          const articleStat = Array.from(document.querySelectorAll(".profile-stats > span"))
            .find((stat) => stat.querySelector("small")?.textContent.trim() === "文章");
          const validPosts = Array.isArray(window.__BLOG_POSTS__)
            ? window.__BLOG_POSTS__.filter(
              (post) => typeof post?.href === "string" && post.href.trim()
                && typeof post?.title === "string" && post.title.trim()
            )
            : [];

          return {
            displayedCount: articleStat?.querySelector("strong")?.textContent.trim() || "",
            expectedCount: String(validPosts.length),
          };
        });
      } finally {
        await page.close();
      }
    }

    const currentPosts = readPostsData();
    const scenarios = [
      { name: "current published posts", result: await loadHomepage() },
      {
        name: "after publishing another post",
        result: await loadHomepage([
          ...currentPosts,
          { href: "posts/future-post.html", title: "Future post" },
        ]),
      },
    ];
    const failures = scenarios.filter(
      ({ result }) => result.displayedCount !== result.expectedCount
    );

    if (failures.length > 0) {
      const details = failures.map(({ name, result }) => (
        `${name}: expected ${result.expectedCount}, displayed ${result.displayedCount || "no count"}`
      ));
      throw new Error(`Homepage article count does not follow published posts. ${details.join("; ")}.`);
    }

    console.log("Homepage article count follows the published post data in both scenarios.");
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
  console.error(error.stack || error.message);
  process.exit(1);
});
