const assert = require("node:assert/strict");
const { browserExecutablePath, closeServer, createStaticServer, listen, requireWorkspaceDependency } = require("./test-helpers");
const { chromium } = requireWorkspaceDependency("playwright");

// Supply only the media infrastructure; the real player builds and handles all UI.
function installAudioFixture() {
  class TestAudio extends EventTarget {
    constructor() {
      super();
      this.paused = true;
      this.currentTime = 0;
      this.duration = NaN;
      window.testAudio = this;
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

async function checkPlayer(page, origin, width) {
  await page.setViewportSize({ width, height: 812 });
  await page.goto(`${origin}/posts/week12-mlp-regularization-review.html`, { waitUntil: "domcontentloaded" });
  const launcher = page.locator(".music-collapsed-button");
  const panel = page.locator(".music-player");
  const play = page.locator(".music-play");
  const progress = page.getByRole("slider", { name: "播放进度" });
  assert.equal(await panel.isVisible(), false);
  assert.equal(await launcher.evaluate((el) => el.getBoundingClientRect().width), 48);
  await launcher.click();
  assert.ok(await play.evaluate((el) => el === document.activeElement));
  assert.ok(await progress.isDisabled(), "Unknown duration disables seeking");
  const bounds = await panel.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, "Panel fits viewport");
  for (const button of await panel.locator("button").all()) {
    const box = await button.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, "Controls have at least 44px touch targets");
  }
  await play.click();
  assert.match(await page.locator(".music-status").innerText(), /加载/);
  await page.evaluate(() => {
    testAudio.duration = 240;
    testAudio.dispatchEvent(new Event("loadedmetadata"));
    testAudio.dispatchEvent(new Event("playing"));
  });
  assert.equal(await page.locator(".music-duration").innerText(), "4:00");
  await progress.fill("50");
  assert.equal(await page.evaluate(() => testAudio.currentTime), 120);
  assert.equal(await page.locator(".music-elapsed").innerText(), "2:00");
  await progress.press("ArrowRight");
  assert.ok(await page.evaluate(() => testAudio.currentTime > 120), "Keyboard seeking works");
  await page.evaluate(() => testAudio.dispatchEvent(new Event("waiting")));
  assert.match(await page.locator(".music-status").innerText(), /缓冲/);
  await play.click();
  assert.equal(await play.getAttribute("aria-pressed"), "false");
  assert.match(await page.locator(".music-status").innerText(), /暂停/);
  const firstTitle = await page.locator(".music-title").innerText();
  await page.getByRole("button", { name: "下一首", exact: true }).click();
  assert.notEqual(await page.locator(".music-title").innerText(), firstTitle);
  await page.getByRole("button", { name: "上一首", exact: true }).click();
  assert.equal(await page.locator(".music-title").innerText(), firstTitle);
  const listToggle = page.locator(".music-list-toggle");
  await listToggle.click();
  const tracks = page.locator(".music-track");
  assert.equal(await tracks.count(), 362);
  assert.equal(await page.locator(".music-playlist-source").getAttribute("href"), "https://music.163.com/playlist?id=2427750321");
  const lastTrack = tracks.last();
  const lastTitle = await lastTrack.locator(".music-track-title").innerText();
  await lastTrack.click();
  assert.equal(await page.locator(".music-title").innerText(), lastTitle);
  assert.equal(await lastTrack.getAttribute("aria-current"), "true");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".music-playlist-panel").isVisible(), false);
  assert.ok(await listToggle.evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Escape");
  assert.equal(await panel.isVisible(), false);
  assert.ok(await launcher.evaluate((el) => el === document.activeElement));
  assert.ok(await page.locator(".music-playing-dot").isVisible());
  const animations = await page.locator(".music-dock").evaluate((el) => el.getAnimations({ subtree: true }).length);
  assert.equal(animations, 0, "Player is static with reduced motion");
  await launcher.click();
  await page.locator(".article-header h1").click();
  assert.equal(await panel.isVisible(), false, "Outside click collapses player");
  await launcher.click();
  await page.getByRole("button", { name: "折叠播放器" }).click();
  assert.ok(await launcher.evaluate((el) => el === document.activeElement));
  await launcher.click();
  await page.evaluate(() => testAudio.dispatchEvent(new Event("error")));
  assert.match(await page.locator(".music-status").innerText(), /加载|播放/, "Media failure has visible feedback");
  // Stop the media fixture from generating play events to exercise consecutive failures.
  await page.evaluate(() => {
    testAudio.play = () => Promise.resolve();
    for (let index = 0; index < document.querySelectorAll(".music-track").length; index++) testAudio.dispatchEvent(new Event("error"));
  });
  assert.match(await page.locator(".music-status").innerText(), /已停止/);
}

async function checkShortViewport(page, origin) {
  for (const height of [375, 320]) {
    await page.setViewportSize({ width: 812, height });
    await page.goto(`${origin}/posts/week12-mlp-regularization-review.html`, { waitUntil: "domcontentloaded" });
    await page.locator(".music-collapsed-button").click();
    await page.getByRole("button", { name: "展开播放列表", exact: true }).click();
    const listBounds = await page.locator(".music-playlist").boundingBox();
    const firstRowBounds = await page.locator(".music-track").first().boundingBox();
    assert.ok(listBounds.height >= firstRowBounds.height,
      `${height}px viewport: playlist must show at least one complete selectable song (list ${listBounds.height}px, row ${firstRowBounds.height}px)`);
    const lastTrack = page.locator(".music-track").last();
    const title = await lastTrack.locator(".music-track-title").innerText();
    await lastTrack.click();
    assert.equal(await page.locator(".music-title").innerText(), title, "Last song remains reachable on short screens");
    await page.getByRole("button", { name: "折叠播放器" }).click();
    assert.ok(await page.locator(".music-collapsed-button").isVisible(), "Close stays reachable on short screens");
  }
}

async function checkDisclosureMotion(page, origin) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${origin}/posts/week12-mlp-regularization-review.html`, { waitUntil: "domcontentloaded" });
  const transitions = [
    { trigger: ".music-collapsed-button", surface: ".music-player", visible: true },
    { trigger: ".music-list-toggle", surface: ".music-playlist-panel", visible: true },
    { trigger: ".music-list-toggle", surface: ".music-playlist-panel", visible: false },
    { trigger: ".music-collapse-toggle", surface: ".music-player", visible: false },
  ];
  for (const transition of transitions) {
    const frames = await page.evaluate(({ trigger, surface }) => {
      document.querySelector(trigger).click();
      const animations = document.querySelector(surface).getAnimations();
      animations.forEach((animation) => animation.pause());
      return animations.map((animation) => ({
        duration: animation.effect.getTiming().duration,
        opacity: animation.effect.getKeyframes().map((frame) => frame.opacity),
      }));
    }, transition);
    assert.ok(frames.some((motion) => motion.duration >= 120 && motion.duration <= 400
      && new Set(motion.opacity).size > 1), `${transition.surface}: opening and closing should visibly ease between states`);
    const intermediate = await page.evaluate((surface) => {
      const element = document.querySelector(surface);
      element.getAnimations().forEach((animation) => { animation.currentTime = animation.effect.getTiming().duration / 2; });
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return { hidden: element.hidden, display: style.display, visibility: style.visibility,
        opacity: Number(style.opacity), width: bounds.width, height: bounds.height };
    }, transition.surface);
    assert.equal(intermediate.hidden, false, "Surface stays rendered throughout the transition");
    assert.notEqual(intermediate.display, "none");
    assert.notEqual(intermediate.visibility, "hidden");
    assert.ok(intermediate.width > 0 && intermediate.height > 0);
    assert.ok(intermediate.opacity > 0.01 && intermediate.opacity < 0.99, "Transition has a visible intermediate opacity");
    await page.evaluate(() => document.querySelector(".music-dock").getAnimations({ subtree: true }).forEach((animation) => animation.finish()));
    await page.waitForFunction(({ surface, visible }) => document.querySelector(surface).hidden === !visible, transition);
  }
  // Interrupt transitions through the same controls, without waiting for animations to finish.
  await page.evaluate(() => {
    document.querySelector(".music-collapsed-button").click();
    document.querySelector(".music-collapse-toggle").click();
    document.querySelector(".music-collapsed-button").click();
    const toggle = document.querySelector(".music-list-toggle");
    toggle.click(); toggle.click(); toggle.click();
  });
  await page.waitForFunction(() => document.querySelector(".music-dock").getAnimations({ subtree: true }).length === 0);
  assert.ok(await page.locator(".music-player").isVisible(), "Latest open action survives interrupted closing");
  assert.ok(await page.locator(".music-playlist-panel").isVisible(), "Rapid toggles settle on the latest playlist state");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector(".music-player").hidden);
  assert.ok(await page.locator(".music-collapsed-button").evaluate((el) => el === document.activeElement));
}

async function run() {
  const server = createStaticServer();
  await listen(server, 0);
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: browserExecutablePath() });
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(installAudioFixture);
    const page = await context.newPage();
    if (process.argv.includes("--motion")) {
      await checkDisclosureMotion(page, origin);
    } else if (process.argv.includes("--short")) {
      await checkShortViewport(page, origin);
    } else {
      for (const width of [320, 375, 1440]) await checkPlayer(page, origin, width);
      await checkShortViewport(page, origin);
      await checkDisclosureMotion(page, origin);
    }
    console.log("PASS: responsive player, media states, seeking, playlist, outside/Escape dismissal and focus");
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
