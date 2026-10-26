const assert = require("node:assert/strict");
const { browserExecutablePath, closeServer, createStaticServer, listen, requireWorkspaceDependency } = require("./test-helpers");
const { chromium } = requireWorkspaceDependency("playwright");

// Fake media element: lets us drive play/pause without network audio.
function installAudioFixture() {
  class TestAudio extends EventTarget {
    constructor() {
      super();
      this.paused = true;
      this.currentTime = 0;
      this.duration = NaN;
      this.volume = 1;
      this.muted = false;
      this.playbackRate = 1;
      window.testAudios = (window.testAudios || []).concat(this);
    }
    set src(value) { this.source = value; this.duration = NaN; }
    get src() { return this.source; }
    play() {
      this.paused = false;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
      this.dispatchEvent(new Event("pause"));
    }
  }
  window.Audio = TestAudio;
}

async function checkContinuousPlayback(page, origin) {
  await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });

  // Not playing: links navigate normally.
  assert.equal(await page.locator(".music-shell-frame").count(), 0);

  await page.locator(".music-collapsed-button").click();
  await page.locator(".music-play").click();
  const title = await page.locator(".music-title").innerText();

  // Media Session metadata follows the current song.
  const mediaTitle = await page.evaluate(() => navigator.mediaSession?.metadata?.title || "");
  assert.equal(mediaTitle, title, "Media Session shows the current song");

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  const firstPost = page.locator(".essay-list a[href*='posts/']").first();
  await firstPost.waitFor();
  const href = await firstPost.getAttribute("href");
  await firstPost.click();

  const frame = page.locator(".music-shell-frame");
  await frame.waitFor({ state: "attached" });
  await page.waitForFunction(() => document.documentElement.classList.contains("music-shell-active"));
  await page.waitForFunction((expected) => location.pathname.endsWith(expected.replace(/^.*\//, "")), href);

  const frameHandle = await frame.elementHandle();
  const content = await frameHandle.contentFrame();
  await content.waitForSelector(".article-header h1");
  assert.equal(await content.locator(".music-dock").count(), 0, "Pages inside the shell do not build a second player");
  assert.equal(await page.evaluate(() => window.testAudios.length), 1, "The same audio element keeps playing");
  assert.equal(await page.evaluate(() => window.testAudios[0].paused), false, "Music keeps playing across navigation");
  assert.equal(await page.title(), await content.title(), "Document title follows the visible page");

  // Navigating inside the shell keeps the player as well.
  await content.locator(".article-site-nav a[href$='archive.html']").click();
  await page.waitForFunction(() => location.pathname.endsWith("archive.html"));
  assert.equal(await page.evaluate(() => window.testAudios[0].paused), false);

  // Back button walks the in-shell history, then returns to the original page.
  await page.goBack();
  await page.waitForFunction((expected) => location.pathname.endsWith(expected.replace(/^.*\//, "")), href);
  await page.goBack();
  await page.waitForFunction(() => !document.documentElement.classList.contains("music-shell-active"));
  assert.ok(await page.locator(".home-page .site-header").isVisible(), "Original page is shown again");
  assert.equal(await page.evaluate(() => window.testAudios[0].paused), false, "Going back does not stop music");
}

async function checkResumeAndSearch(page, origin) {
  await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const track = window.BLOG_MUSIC_PLAYLIST.tracks[3];
    localStorage.setItem("blog-music-state-v1", JSON.stringify({ id: track.neteaseSongId, time: 75, volume: 0.4, muted: false, shuffle: true }));
    // Keep this page from overwriting the seeded state when it unloads.
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const expected = await page.evaluate(() => window.BLOG_MUSIC_PLAYLIST.tracks[3].title);
  assert.equal(await page.locator(".music-title").textContent(), expected, "Last song is restored");
  assert.match(await page.locator(".music-status").textContent(), /1:15/, "Resume position is offered");
  await page.locator(".music-collapsed-button").click();
  assert.equal(await page.locator(".music-shuffle").getAttribute("aria-pressed"), "true", "Shuffle mode is restored");
  assert.equal(await page.locator(".music-volume").inputValue(), "40", "Volume is restored");

  await page.locator(".music-play").click();
  await page.evaluate(() => {
    const audio = window.testAudios[0];
    audio.duration = 200;
    audio.dispatchEvent(new Event("loadedmetadata"));
  });
  assert.equal(await page.evaluate(() => window.testAudios[0].currentTime), 75, "Playback resumes from the saved position");

  await page.locator(".music-list-toggle").click();
  const search = page.locator(".music-playlist-search");
  await search.fill(expected.slice(0, 2));
  const visible = await page.locator(".music-playlist li:not([hidden])").count();
  const total = await page.locator(".music-playlist li").count();
  assert.ok(visible >= 1 && visible < total, "Search narrows the playlist");
  await search.fill("zzzz-no-such-song");
  assert.ok(await page.locator(".music-playlist-empty").isVisible(), "Empty search shows a message");
}

async function run() {
  const server = createStaticServer();
  await listen(server, 0);
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: browserExecutablePath() });
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
    await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(installAudioFixture);
    const page = await context.newPage();
    await checkContinuousPlayback(page, origin);
    await checkResumeAndSearch(page, origin);
    console.log("PASS: music keeps playing across pages, Media Session, resume state and playlist search");
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
