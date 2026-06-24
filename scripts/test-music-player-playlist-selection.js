const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class ClassList {
  constructor(element) {
    this.element = element;
    this.classes = new Set();
  }

  add(...classNames) {
    classNames.forEach((className) => this.classes.add(className));
    this.sync();
  }

  contains(className) {
    return this.classes.has(className);
  }

  remove(...classNames) {
    classNames.forEach((className) => this.classes.delete(className));
    this.sync();
  }

  toggle(className, force) {
    const shouldAdd = force === undefined ? !this.classes.has(className) : Boolean(force);
    if (shouldAdd) {
      this.classes.add(className);
    } else {
      this.classes.delete(className);
    }
    this.sync();
    return shouldAdd;
  }

  sync() {
    this.element.attributes.class = [...this.classes].join(" ");
  }
}

class FakeEvent {
  constructor(target, type = "click", options = {}) {
    this.defaultPrevented = false;
    this.target = target;
    this.type = type;
    Object.assign(this, options);
  }

  preventDefault() {
    this.defaultPrevented = true;
  }
}

class FakeElement {
  constructor(tagName) {
    this.attributes = {};
    this.children = [];
    this.classList = new ClassList(this);
    this.dataset = {};
    this.eventListeners = new Map();
    this.parentElement = null;
    this.style = {
      properties: {},
      removeProperty: (name) => {
        delete this.style.properties[name];
      },
      setProperty: (name, value) => {
        this.style.properties[name] = value;
      },
    };
    this.tagName = tagName.toUpperCase();
    this.textContent = "";
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, listener) {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }

  click() {
    const event = new FakeEvent(this);
    let element = this;

    while (element) {
      for (const listener of element.eventListeners.get("click") || []) {
        listener.call(element, event);
      }
      element = element.parentElement;
    }
  }

  closest(selector) {
    let element = this;
    while (element) {
      if (element.matches(selector)) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  contains(candidate) {
    let element = candidate;
    while (element) {
      if (element === this) {
        return true;
      }
      element = element.parentElement;
    }
    return false;
  }

  focus() {}

  matches(selector) {
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((item) => item.trim()).filter(Boolean);
    const matches = [];

    function visit(element) {
      if (selectors.some((candidate) => element.matches(candidate))) {
        matches.push(element);
      }
      element.children.forEach(visit);
    }

    this.children.forEach(visit);
    return matches;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") {
      this.classList.classes = new Set(String(value).split(/\s+/).filter(Boolean));
      this.classList.sync();
    }
    if (name.startsWith("data-")) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  set className(value) {
    this.setAttribute("class", value);
  }

  get className() {
    return this.attributes.class || "";
  }

  set disabled(value) {
    if (value) {
      this.attributes.disabled = "";
    } else {
      delete this.attributes.disabled;
    }
  }

  get disabled() {
    return Object.prototype.hasOwnProperty.call(this.attributes, "disabled");
  }

  set hidden(value) {
    if (value) {
      this.attributes.hidden = "";
    } else {
      delete this.attributes.hidden;
    }
  }

  get hidden() {
    return Object.prototype.hasOwnProperty.call(this.attributes, "hidden");
  }

  set innerHTML(html) {
    this.children = createMusicPlayerDomFromTemplate(html);
    this.children.forEach((child) => {
      child.parentElement = this;
    });
  }
}

class FakeDocument {
  constructor() {
    this.eventListeners = new Map();
    this.parentElement = null;
    this.documentElement = new FakeElement("html");
    this.body = new FakeElement("body");
    this.documentElement.parentElement = this;
    this.documentElement.appendChild(this.body);
  }

  addEventListener(type, listener) {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }

  dispatchEvent(event) {
    for (const listener of this.eventListeners.get(event.type) || []) {
      listener.call(this, event);
    }
  }

  createDocumentFragment() {
    return new FakeElement("fragment");
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
}

class FakeAudio {
  constructor() {
    this.currentTime = 0;
    this.eventListeners = new Map();
    this.paused = true;
    this.playCalls = 0;
    this.preload = "";
    this.src = "";
    this.volume = 1;
    FakeAudio.instances.push(this);
  }

  addEventListener(type, listener) {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.eventListeners.get(type) || []) {
      listener.call(this);
    }
  }

  pause() {
    this.paused = true;
    this.dispatch("pause");
  }

  play() {
    this.paused = false;
    this.playCalls += 1;
    this.dispatch("play");
    return Promise.resolve();
  }
}

FakeAudio.instances = [];

function element(tagName, className = "", text = "") {
  const node = new FakeElement(tagName);
  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}

function assertTemplateContainsRequiredSelectors(html) {
  [
    "music-collapsed-button",
    "music-player",
    "music-cover-button",
    "music-title",
    "music-artist",
    "music-status",
    "music-progress-bar",
    "music-prev",
    "music-play",
    "music-next",
    "music-list-toggle",
    "music-collapse-toggle",
    "music-playlist-panel",
    "music-playlist-count",
    "music-playlist",
  ].forEach((selector) => {
    assert.ok(html.includes(selector), `Music player template should include .${selector}.`);
  });
}

function createMusicPlayerDomFromTemplate(html) {
  assertTemplateContainsRequiredSelectors(html);

  const collapsedButton = element("button", "music-collapsed-button");
  const collapsedArt = element("span", "music-collapsed-disc-art");
  collapsedButton.appendChild(collapsedArt);

  const player = element("section", "music-player");
  const coverButton = element("button", "music-cover-button");
  const art = element("span", "music-disc-art");
  coverButton.appendChild(art);

  const main = element("div", "music-main");
  const title = element("div", "music-title");
  const artist = element("div", "music-artist");
  const status = element("div", "music-status");
  const progress = element("span", "music-progress-bar");
  main.append(title, artist, progress, status);

  const controls = element("div", "music-controls");
  const prev = element("button", "music-icon-button music-prev");
  const play = element("button", "music-icon-button music-play");
  const next = element("button", "music-icon-button music-next");
  const list = element("button", "music-icon-button music-list-toggle");
  const collapse = element("button", "music-icon-button music-collapse-toggle");
  controls.append(prev, play, next, list, collapse);
  player.append(coverButton, main, controls);

  const panel = element("div", "music-playlist-panel");
  const count = element("strong", "music-playlist-count");
  const playlist = element("ol", "music-playlist");
  panel.append(count, playlist);

  return [collapsedButton, player, panel];
}

function loadMusicPlayer() {
  FakeAudio.instances = [];
  const code = fs.readFileSync(path.resolve(__dirname, "..", "music-player.js"), "utf8");
  const document = new FakeDocument();
  const sandbox = {
    Audio: FakeAudio,
    document,
    encodeURIComponent,
    Number,
    Promise,
    String,
  };

  vm.runInNewContext(code, sandbox, { filename: "music-player.js" });
  assert.equal(FakeAudio.instances.length, 1, "Music player should create one Audio instance.");
  return { audio: FakeAudio.instances[0], document };
}

function playlistTrackInfo(track) {
  const title = track.querySelector(".music-track-title")?.textContent || "";
  return { title };
}

function clickTrackAtIndex(document, index) {
  const tracks = document.querySelectorAll(".music-track");
  const track = tracks[index];

  assert.ok(track, `Expected playlist track at index ${index}.`);
  track.click();
  return playlistTrackInfo(track);
}

function playerState(document, audio) {
  return {
    currentTitle: document.querySelector(".music-title")?.textContent || "",
    playCalls: audio.playCalls,
    source: audio.src,
    trackCount: document.querySelectorAll(".music-track").length,
  };
}

function extractSongId(source, title) {
  const match = source.match(/id=([^&]+)\.mp3/);
  assert.ok(match, `Clicking "${title}" should load a NetEase song URL, got "${source}".`);
  return match[1];
}

function assertTrackSelection(document, audio, { title, expectedSongId, expectedPlayCalls }) {
  const state = playerState(document, audio);
  assert.equal(state.currentTitle, title, `Clicking "${title}" should update the displayed song title.`);
  assert.match(state.source, new RegExp(`id=${expectedSongId}\\.mp3`), `Clicking "${title}" should load song ${expectedSongId}.`);
  assert.equal(
    state.playCalls,
    expectedPlayCalls,
    `Clicking "${title}" from the playlist should start playback even when the previous song was paused.`
  );
}

function assertPlaylistHasMultipleTracks(document, audio) {
  const state = playerState(document, audio);
  assert.ok(state.trackCount >= 2, `Music playlist should render at least two tracks, found ${state.trackCount}.`);
  return state.trackCount;
}

function playlistDisclosureState(document) {
  const root = document.querySelector(".music-dock");
  const listToggle = document.querySelector(".music-list-toggle");
  const panel = document.querySelector(".music-playlist-panel");

  assert.ok(root, "Music dock should be rendered.");
  assert.ok(listToggle, "Music playlist toggle should be rendered.");
  assert.ok(panel, "Music playlist panel should be rendered.");

  return {
    isCollapsed: root.classList.contains("is-collapsed"),
    isOpen: root.classList.contains("is-playlist-open"),
    panelHidden: panel.hidden,
    toggleExpanded: listToggle.getAttribute("aria-expanded"),
  };
}

function assertPlaylistOpen(document, message) {
  const state = playlistDisclosureState(document);
  assert.equal(state.isCollapsed, false, `${message}: music player should be expanded.`);
  assert.equal(state.isOpen, true, `${message}: music dock should mark the playlist as open.`);
  assert.equal(state.panelHidden, false, `${message}: playlist panel should be visible.`);
  assert.equal(state.toggleExpanded, "true", `${message}: playlist toggle should be expanded.`);
}

function assertPlaylistClosed(document, message) {
  const state = playlistDisclosureState(document);
  assert.equal(state.isCollapsed, false, `${message}: the whole player should remain expanded.`);
  assert.equal(state.isOpen, false, `${message}: music dock should mark the playlist as closed.`);
  assert.equal(state.panelHidden, true, `${message}: playlist panel should be hidden.`);
  assert.equal(state.toggleExpanded, "false", `${message}: playlist toggle should not be expanded.`);
}

function openExpandedPlaylist(document) {
  const collapsedButton = document.querySelector(".music-collapsed-button");
  const listToggle = document.querySelector(".music-list-toggle");

  assert.ok(collapsedButton, "Collapsed music button should be rendered.");
  assert.ok(listToggle, "Music playlist toggle should be rendered.");

  collapsedButton.click();
  listToggle.click();
  assertPlaylistOpen(document, "Opening the player playlist");
}

const { audio, document } = loadMusicPlayer();
const trackCount = assertPlaylistHasMultipleTracks(document, audio);
const initialSource = audio.src;

const secondToLastTrack = clickTrackAtIndex(document, trackCount - 2);
const secondToLastSongId = extractSongId(audio.src, secondToLastTrack.title);
assert.notEqual(audio.src, initialSource, "Clicking the second-to-last playlist row should load a different source.");
const secondToLastSource = audio.src;
assertTrackSelection(document, audio, {
  title: secondToLastTrack.title,
  expectedSongId: secondToLastSongId,
  expectedPlayCalls: 1,
});

const lastTrack = clickTrackAtIndex(document, trackCount - 1);
const lastSongId = extractSongId(audio.src, lastTrack.title);
assert.notEqual(audio.src, initialSource, "Clicking the last playlist row should load a different source.");
assert.notEqual(audio.src, secondToLastSource, "Clicking the last playlist row should load a different source than the previous row.");
assertTrackSelection(document, audio, {
  title: lastTrack.title,
  expectedSongId: lastSongId,
  expectedPlayCalls: 2,
});

const outsideClickPlayer = loadMusicPlayer();
openExpandedPlaylist(outsideClickPlayer.document);
outsideClickPlayer.document.body.click();
assertPlaylistClosed(outsideClickPlayer.document, "Clicking outside the open playlist");

const insideClickPlayer = loadMusicPlayer();
openExpandedPlaylist(insideClickPlayer.document);
clickTrackAtIndex(insideClickPlayer.document, 1);
assertPlaylistOpen(insideClickPlayer.document, "Clicking inside the open playlist");

const escapePlayer = loadMusicPlayer();
openExpandedPlaylist(escapePlayer.document);
escapePlayer.document.dispatchEvent(new FakeEvent(escapePlayer.document, "keydown", { key: "Escape" }));
assertPlaylistClosed(escapePlayer.document, "Pressing Escape while the playlist is open");

console.log("Playlist clicks select the final tracks, autoplay them, and close on outside clicks.");
