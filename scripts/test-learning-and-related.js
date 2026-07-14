const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawn, spawnSync } = require("node:child_process");
const {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
} = require("./test-helpers");

const rootDir = path.resolve(__dirname, "..");
const port = 4178;
const origin = `http://127.0.0.1:${port}`;

function readScriptData(relativePath, globalName) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: relativePath });
  return sandbox.window[globalName];
}

function rebuildAssets() {
  const result = spawnSync(process.execPath, [path.join(rootDir, "scripts", "build-site-assets.js")], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Site asset build failed.");
  }
}

function assertGeneratedRelationships(posts, related) {
  const byId = new Map(posts.map((post) => [post.id, post]));
  Object.entries(related).forEach(([currentId, entries]) => {
    if (!byId.has(currentId)) throw new Error(`Unknown related-post source: ${currentId}`);
    if (!Array.isArray(entries) || entries.length > 3) {
      throw new Error(`Related posts for ${currentId} should contain at most three entries.`);
    }
    entries.forEach((entry) => {
      if (entry.id === currentId) throw new Error(`${currentId} recommends itself.`);
      const candidate = byId.get(entry.id);
      if (!candidate) throw new Error(`${currentId} recommends unknown post ${entry.id}.`);
      if (candidate.indexable === false) throw new Error(`${currentId} recommends non-indexable post ${entry.id}.`);
      if (!entry.reason) throw new Error(`${currentId} recommendation ${entry.id} has no explanation.`);
    });
  });
}

function dumpPageDom(url, userDataDir) {
  return new Promise((resolve, reject) => {
    const executable = browserExecutablePath();
    if (!executable) {
      reject(new Error("Microsoft Edge was not found for the browser smoke test."));
      return;
    }

    const child = spawn(executable, [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${userDataDir}`,
      "--virtual-time-budget=3000",
      "--dump-dom",
      url,
    ], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Edge DOM dump failed (${code}): ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function runBrowserChecks() {
  const server = createStaticServer();
  await listen(server, port);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "blog-learning-test-"));

  try {
    const articleDom = await dumpPageDom(`${origin}/posts/python-tuple-basic-usage.html`, userDataDir);
    if (!articleDom.includes('data-post-id="python-tuple-basic"')) {
      throw new Error("Article did not expose its stable post id.");
    }
    if (!articleDom.includes("data-learning-card")) {
      throw new Error("Article learning card was not rendered.");
    }
    if (!articleDom.includes("related-reading-title") || !articleDom.includes("继续阅读")) {
      throw new Error("Related-reading section was not rendered.");
    }
    const recommendationCount = (articleDom.match(/class="article-recommendation-card"/g) || []).length;
    if (recommendationCount !== 3) throw new Error("Article should render three related posts.");

    const homepageDom = await dumpPageDom(`${origin}/index.html`, userDataDir);
    if (!homepageDom.includes("data-continue-learning") || !homepageDom.includes("Python 入门")) {
      throw new Error("Homepage did not render the start/continue learning card.");
    }
  } finally {
    await closeServer(server);
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function run() {
  rebuildAssets();
  const posts = readScriptData("posts-data.js", "__BLOG_POSTS__");
  const related = readScriptData("related-posts-data.js", "__BLOG_RELATED_POSTS__");
  assertGeneratedRelationships(posts, related);
  await runBrowserChecks();
  console.log("Stable content ids, learning progress, resume reading, and related posts work.");
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
