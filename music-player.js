(() => {
  const SHELL_FLAG = "__BLOG_MUSIC_SHELL__";
  const STORAGE_KEY = "blog-music-state-v1";

  // ---------------------------------------------------------------------------
  // 页面被放进“不断播外壳”的 iframe 时，不再创建播放器，只负责把站外链接交给顶层窗口打开。
  // ---------------------------------------------------------------------------
  function findShellParent() {
    try {
      if (window.parent && window.parent !== window && window.parent[SHELL_FLAG]) {
        return window.parent;
      }
    } catch (error) {
      // Cross-origin parents are not our shell.
    }
    return null;
  }

  const shellParent = typeof window.parent !== "undefined" ? findShellParent() : null;

  if (shellParent) {
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      shellParent.location.href = url.href;
    }, true);
    return;
  }

  const playlistData = window.BLOG_MUSIC_PLAYLIST || {};
  const playlist = playlistData.tracks || [];

  const settings = {
    startIndex: 0,
    volume: 0.7,
    loop: true,
  };

  function resolveTrackSource(track) {
    if (!track) {
      return "";
    }

    if (track.src) {
      return track.src;
    }

    const songId = String(track.neteaseSongId || "").trim();
    if (!songId) {
      return "";
    }

    return `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(songId)}.mp3`;
  }

  function safeText(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizePlaylist(list) {
    return Array.isArray(list) ? list.filter((item) => item && typeof item === "object") : [];
  }

  function coverUrl(track, size) {
    const cover = safeText(track?.cover);
    return cover ? `${cover}?param=${size}y${size}` : "";
  }

  function prefersReducedMotion() {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ---------------------------------------------------------------------------
  // 本地记忆：上次的歌曲、进度、音量、随机模式
  // ---------------------------------------------------------------------------
  const storage = (() => {
    try {
      const store = window.localStorage;
      store.setItem("__music_probe__", "1");
      store.removeItem("__music_probe__");
      return store;
    } catch (error) {
      return null;
    }
  })();

  function readSavedState() {
    if (!storage) return {};
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (error) {
      return {};
    }
  }

  const tracks = normalizePlaylist(playlist);
  const savedState = readSavedState();
  const savedIndex = tracks.findIndex((track) => String(track.neteaseSongId || "") === String(savedState.id || ""));
  const initialIndex = savedIndex >= 0
    ? savedIndex
    : Math.min(Math.max(settings.startIndex || 0, 0), Math.max(tracks.length - 1, 0));
  let pendingResumeTime = savedIndex >= 0 && Number(savedState.time) > 0 ? Number(savedState.time) : 0;

  const audio = new Audio();
  audio.preload = "none";
  const savedVolume = Number(savedState.volume);
  audio.volume = Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1 ? savedVolume : settings.volume;
  audio.muted = savedState.muted === true;

  const icons = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M19 5 9 12l10 7Z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M5 5l10 7-10 7Z"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h3.5c4 0 6 10 10 10H21M3 17h3.5c1.6 0 2.8-1.6 3.9-3.6M13.6 9.6C14.7 8 15.6 7 16.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
    volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="music-volume-body" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path class="music-volume-wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="music-volume-mute" d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
  };

  const root = document.createElement("div");
  root.className = "music-dock is-collapsed";
  root.innerHTML = `
    <button class="music-collapsed-button" type="button" aria-label="展开音乐播放器" aria-expanded="false" aria-controls="music-player">
      <span class="music-collapsed-disc-art" aria-hidden="true"></span>
      <span class="music-playing-dot" aria-hidden="true"></span>
    </button>
    <section class="music-player" id="music-player" aria-label="音乐播放器" hidden>
      <div class="music-player-heading">
        <span class="music-player-label">随身听</span>
        <button class="music-icon-button music-collapse-toggle" type="button" aria-label="折叠播放器"><span aria-hidden="true">×</span></button>
      </div>
      <div class="music-now-playing">
        <button class="music-cover-button" type="button" aria-label="播放音乐" aria-pressed="false">
          <span class="music-disc-art" aria-hidden="true"></span>
        </button>
        <div class="music-meta">
          <div class="music-title"></div>
          <div class="music-artist"></div>
          <div class="music-status" role="status" aria-live="polite"></div>
        </div>
      </div>
      <div class="music-timeline">
        <input class="music-progress-bar" type="range" min="0" max="100" step="0.1" value="0" aria-label="播放进度" disabled>
        <div class="music-times"><span class="music-elapsed">0:00</span><span class="music-duration">--:--</span></div>
      </div>
      <div class="music-controls" role="group" aria-label="播放控制">
        <button class="music-icon-button music-shuffle" type="button" aria-label="随机播放" aria-pressed="false" title="随机播放">${icons.shuffle}</button>
        <button class="music-icon-button music-prev" type="button" aria-label="上一首">${icons.prev}</button>
        <button class="music-icon-button music-play" type="button" aria-label="播放音乐" aria-pressed="false"><span class="music-play-symbol" aria-hidden="true"></span></button>
        <button class="music-icon-button music-next" type="button" aria-label="下一首">${icons.next}</button>
        <button class="music-icon-button music-list-toggle" type="button" aria-label="展开播放列表" aria-expanded="false" aria-controls="music-playlist" title="歌单">${icons.list}</button>
      </div>
      <div class="music-player-footer">
        <button class="music-icon-button music-mute" type="button" aria-label="静音" aria-pressed="false" title="静音">${icons.volume}</button>
        <input class="music-volume" type="range" min="0" max="100" step="1" value="70" aria-label="音量">
      </div>
    </section>
    <section class="music-playlist-panel" id="music-playlist" aria-label="播放列表" hidden>
      <div class="music-playlist-head"><a class="music-playlist-source" href="https://music.163.com/playlist?id=2427750321" target="_blank" rel="noopener noreferrer">网易云歌单</a><strong class="music-playlist-count"></strong></div>
      <input class="music-playlist-search" type="search" placeholder="搜索歌名或歌手" aria-label="搜索歌单" autocomplete="off" spellcheck="false">
      <ol class="music-playlist"></ol>
      <p class="music-playlist-empty" hidden>没有匹配的歌曲</p>
    </section>
  `;

  const mountPoint = document.documentElement;
  if (!mountPoint) {
    return;
  }

  mountPoint.appendChild(root);

  const collapsedButton = root.querySelector(".music-collapsed-button");
  const collapsedArt = root.querySelector(".music-collapsed-disc-art");
  const playerEl = root.querySelector(".music-player");
  const coverButton = root.querySelector(".music-cover-button");
  const playButton = root.querySelector(".music-play");
  const art = root.querySelector(".music-disc-art");
  const titleEl = root.querySelector(".music-title");
  const artistEl = root.querySelector(".music-artist");
  const statusEl = root.querySelector(".music-status");
  const progressBar = root.querySelector(".music-progress-bar");
  const elapsedEl = root.querySelector(".music-elapsed");
  const durationEl = root.querySelector(".music-duration");
  const prevButton = root.querySelector(".music-prev");
  const nextButton = root.querySelector(".music-next");
  const listToggle = root.querySelector(".music-list-toggle");
  const collapseToggle = root.querySelector(".music-collapse-toggle");
  const playlistPanel = root.querySelector(".music-playlist-panel");
  const playlistEl = root.querySelector(".music-playlist");
  const playlistCountEl = root.querySelector(".music-playlist-count");
  const playlistSourceEl = root.querySelector(".music-playlist-source");
  // Optional controls: the player still works if a trimmed template leaves them out.
  const shuffleButton = root.querySelector(".music-shuffle");
  const muteButton = root.querySelector(".music-mute");
  const volumeSlider = root.querySelector(".music-volume");
  const searchInput = root.querySelector(".music-playlist-search");
  const emptyEl = root.querySelector(".music-playlist-empty");

  if (
    !collapsedButton ||
    !collapsedArt ||
    !playerEl ||
    !coverButton ||
    !playButton ||
    !art ||
    !titleEl ||
    !artistEl ||
    !statusEl ||
    !progressBar ||
    !elapsedEl ||
    !durationEl ||
    !prevButton ||
    !nextButton ||
    !listToggle ||
    !collapseToggle ||
    !playlistPanel ||
    !playlistEl ||
    !playlistCountEl ||
    !playlistSourceEl
  ) {
    root.remove();
    return;
  }

  let currentIndex = initialIndex;
  let consecutiveFailures = 0;
  let isPlaylistOpen = false;
  let isCollapsed = true;
  let isShuffle = savedState.shuffle === true;
  const playHistory = [];

  function currentTrack() {
    return tracks[currentIndex] || null;
  }

  function setStatus(text) {
    statusEl.textContent = safeText(text);
  }

  // ---------------------------------------------------------------------------
  // 保存状态
  // ---------------------------------------------------------------------------
  let lastSavedAt = 0;

  function saveState() {
    if (!storage) return;
    lastSavedAt = Date.now();
    const time = pendingResumeTime || (Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        id: String(currentTrack()?.neteaseSongId || ""),
        time: Math.floor(time),
        volume: audio.volume,
        muted: Boolean(audio.muted),
        shuffle: isShuffle,
      }));
    } catch (error) {
      // Storage can be full or blocked; playback does not depend on it.
    }
  }

  // ---------------------------------------------------------------------------
  // 系统媒体控制（锁屏、耳机按键、键盘媒体键）
  // ---------------------------------------------------------------------------
  const mediaSession = typeof navigator !== "undefined" && navigator.mediaSession ? navigator.mediaSession : null;

  function setMediaAction(action, handler) {
    if (!mediaSession) return;
    try {
      mediaSession.setActionHandler(action, handler);
    } catch (error) {
      // Unsupported actions throw in some browsers.
    }
  }

  function updateMediaMetadata(track) {
    if (!mediaSession || typeof MediaMetadata !== "function" || !track) return;
    const artwork = [96, 256, 512]
      .map((size) => ({ src: coverUrl(track, size), sizes: `${size}x${size}`, type: "image/jpeg" }))
      .filter((item) => item.src);
    try {
      mediaSession.metadata = new MediaMetadata({
        title: safeText(track.title) || "未命名歌曲",
        artist: safeText(track.artist) || "未知演唱者",
        album: safeText(playlistData.name) || "风迁夏回",
        artwork,
      });
    } catch (error) {
      // Ignore metadata errors; playback continues.
    }
  }

  let lastPositionUpdate = 0;

  function updateMediaPosition(force = false) {
    if (!mediaSession || typeof mediaSession.setPositionState !== "function") return;
    const now = Date.now();
    if (!force && now - lastPositionUpdate < 1000) return;
    lastPositionUpdate = now;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (duration <= 0) return;
    try {
      mediaSession.setPositionState({
        duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(Math.max(audio.currentTime || 0, 0), duration),
      });
    } catch (error) {
      // Some browsers reject transient states while loading.
    }
  }

  function setPressed(isPressed) {
    const pressed = Boolean(isPressed);
    coverButton.setAttribute("aria-pressed", String(pressed));
    playButton.setAttribute("aria-pressed", String(pressed));
    root.classList.toggle("is-playing", pressed);
    if (mediaSession) {
      mediaSession.playbackState = pressed ? "playing" : "paused";
    }
  }

  function setControlLabels(track) {
    const title = safeText(track?.title) || "未命名歌曲";
    const artist = safeText(track?.artist) || "未知演唱者";
    const action = audio.paused ? "播放" : "暂停";

    coverButton.setAttribute("aria-label", `${action}：${title} - ${artist}`);
    playButton.setAttribute("aria-label", `${action}：${title} - ${artist}`);
    collapsedButton.setAttribute("aria-label", `展开音乐播放器：${title} - ${artist}`);
    collapsedButton.setAttribute("title", `${title} - ${artist}`);
  }

  const disclosureAnimations = new WeakMap();

  function setDisclosureVisible(element, visible) {
    const previous = disclosureAnimations.get(element);
    if (!previous && element.hidden === !visible) return;

    const canAnimate = typeof element.animate === "function" && !prefersReducedMotion();
    const closedFrame = { opacity: 0, transform: "translateY(8px) scale(0.96)" };
    const openFrame = { opacity: 1, transform: "translateY(0) scale(1)" };
    const style = canAnimate && !element.hidden ? getComputedStyle(element) : null;
    const start = style ? { opacity: style.opacity, transform: style.transform } : closedFrame;
    previous?.cancel();
    disclosureAnimations.delete(element);
    element.inert = !visible;
    element.setAttribute("aria-hidden", String(!visible));

    if (!canAnimate) {
      element.hidden = !visible;
      return;
    }

    element.hidden = false;
    const animation = element.animate([start, visible ? openFrame : closedFrame], {
      duration: visible ? 260 : 180,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both",
    });
    disclosureAnimations.set(element, animation);
    animation.finished.then(() => {
      if (disclosureAnimations.get(element) !== animation) return;
      element.hidden = !visible;
      disclosureAnimations.delete(element);
      animation.cancel();
    }, () => {
      // A newer interaction owns the state after cancelling this transition.
    });
  }

  function setCollapsed(shouldCollapse) {
    isCollapsed = Boolean(shouldCollapse);
    root.classList.toggle("is-collapsed", isCollapsed);
    setDisclosureVisible(playerEl, !isCollapsed);
    setDisclosureVisible(collapsedButton, isCollapsed);
    collapsedButton.setAttribute("aria-expanded", String(!isCollapsed));

    if (isCollapsed) {
      setPlaylistOpen(false);
    }
  }

  function setPlaylistOpen(isOpen) {
    isPlaylistOpen = Boolean(isOpen);
    root.classList.toggle("is-playlist-open", isPlaylistOpen);
    listToggle.setAttribute("aria-expanded", String(isPlaylistOpen));
    listToggle.setAttribute("aria-label", isPlaylistOpen ? "收起播放列表" : "展开播放列表");
    setDisclosureVisible(playlistPanel, isPlaylistOpen);

    if (isPlaylistOpen) {
      const current = playlistEl.querySelector(".music-track.is-current");
      if (current && typeof current.scrollIntoView === "function") {
        current.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function updateProgress() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const percent = duration > 0 ? Math.min(Math.max((currentTime / duration) * 100, 0), 100) : 0;
    progressBar.style.setProperty("--music-progress", `${percent}%`);
    root.style.setProperty("--music-ring", `${(percent * 3.6).toFixed(1)}deg`);
    progressBar.value = String(percent);
    progressBar.disabled = duration <= 0;
    elapsedEl.textContent = formatTime(currentTime || pendingResumeTime);
    durationEl.textContent = duration > 0 ? formatTime(duration) : "--:--";
    progressBar.setAttribute("aria-valuetext", `${formatTime(currentTime)} / ${durationEl.textContent}`);
  }

  function updatePlaylistActive() {
    playlistEl.querySelectorAll(".music-track").forEach((button) => {
      const isCurrent = Number(button.dataset.index) === currentIndex;
      button.classList.toggle("is-current", isCurrent);
      button.setAttribute("aria-current", isCurrent ? "true" : "false");
    });
  }

  function updateSkipButtons() {
    if (tracks.length <= 1) {
      prevButton.disabled = true;
      nextButton.disabled = true;
      return;
    }

    if (settings.loop) {
      prevButton.disabled = false;
      nextButton.disabled = false;
      return;
    }

    prevButton.disabled = currentIndex <= 0;
    nextButton.disabled = currentIndex >= tracks.length - 1;
  }

  function updateMetadata(track) {
    const title = safeText(track?.title) || "未命名歌曲";
    const artist = safeText(track?.artist) || "未知演唱者";
    const mainCover = coverUrl(track, 200);
    const smallCover = coverUrl(track, 96);

    titleEl.textContent = title;
    titleEl.title = title;
    artistEl.title = artist;
    artistEl.textContent = artist;

    if (mainCover) {
      art.style.setProperty("--music-cover", `url("${mainCover}")`);
      collapsedArt.style.setProperty("--music-cover", `url("${smallCover}")`);
    } else {
      art.style.removeProperty("--music-cover");
      collapsedArt.style.removeProperty("--music-cover");
    }

    setControlLabels(track);
    updatePlaylistActive();
  }

  function updateShuffleButton() {
    if (!shuffleButton) return;
    shuffleButton.setAttribute("aria-pressed", String(isShuffle));
    shuffleButton.setAttribute("title", isShuffle ? "随机播放：开" : "随机播放：关");
  }

  function updateVolumeControls() {
    const level = audio.muted ? 0 : Math.round(audio.volume * 100);
    root.classList.toggle("is-muted", audio.muted || audio.volume === 0);
    if (volumeSlider) {
      volumeSlider.value = String(level);
      volumeSlider.style.setProperty("--music-volume", `${level}%`);
      volumeSlider.setAttribute("aria-valuetext", `${level}%`);
    }
    if (muteButton) {
      const muted = audio.muted || audio.volume === 0;
      muteButton.setAttribute("aria-pressed", String(muted));
      muteButton.setAttribute("aria-label", muted ? "取消静音" : "静音");
      muteButton.setAttribute("title", muted ? "取消静音" : "静音");
    }
  }

  function loadTrack(index, { autoplay = false, statusText = "", resumeTime = 0 } = {}) {
    currentIndex = Math.min(Math.max(index || 0, 0), Math.max(tracks.length - 1, 0));
    const track = currentTrack();
    const src = resolveTrackSource(track);
    pendingResumeTime = resumeTime > 0 ? resumeTime : 0;

    updateSkipButtons();

    audio.pause();
    audio.src = src;
    audio.currentTime = 0;
    updateProgress();

    updateMetadata(track);
    updateMediaMetadata(track);
    setPressed(false);
    saveState();

    if (!src) {
      setStatus("未配置可播放的歌曲");
      return;
    }

    setStatus(safeText(statusText));

    if (autoplay) {
      audio
        .play()
        .then(() => {})
        .catch(() => {
          setStatus("浏览器阻止了自动播放，请点击播放按钮");
        });
    }
  }

  function indexWithDelta(delta) {
    const total = tracks.length;
    if (total <= 0) {
      return 0;
    }

    if (settings.loop) {
      return (currentIndex + delta + total) % total;
    }

    return Math.min(Math.max(currentIndex + delta, 0), total - 1);
  }

  function rememberCurrent() {
    playHistory.push(currentIndex);
    if (playHistory.length > 100) playHistory.shift();
  }

  function followingIndex() {
    if (isShuffle && tracks.length > 2) {
      let candidate = currentIndex;
      while (candidate === currentIndex) {
        candidate = Math.floor(Math.random() * tracks.length);
      }
      return candidate;
    }
    return indexWithDelta(1);
  }

  function skip(delta) {
    if (tracks.length <= 1) {
      setStatus("只有一首歌，无法切歌");
      return;
    }

    consecutiveFailures = 0;
    const wasPlaying = !audio.paused;
    let nextIndex;
    if (delta < 0) {
      nextIndex = isShuffle && playHistory.length > 0 ? playHistory.pop() : indexWithDelta(-1);
    } else {
      rememberCurrent();
      nextIndex = followingIndex();
    }
    loadTrack(nextIndex, { autoplay: wasPlaying, statusText: delta < 0 ? "已切到上一首" : "已切到下一首" });
  }

  function handlePlaybackFailure(message) {
    setPressed(false);

    if (!settings.loop || tracks.length <= 1) {
      setStatus(safeText(message));
      return;
    }

    consecutiveFailures += 1;
    if (consecutiveFailures >= tracks.length) {
      setStatus("多首歌曲不可播放，已停止自动切歌");
      return;
    }

    rememberCurrent();
    loadTrack(followingIndex(), { autoplay: true, statusText: safeText(message) || "已切到下一首" });
  }

  function togglePlay() {
    if (!audio.src) {
      setStatus("没有可播放的音源，请检查歌单配置");
      return;
    }

    if (audio.paused) {
      audio
        .play()
        .then(() => {})
        .catch(() => {
          handlePlaybackFailure("播放失败：可能是歌曲不可用或被限制，已尝试切到下一首");
        });
      return;
    }

    audio.pause();
  }

  function renderPlaylist() {
    const fragment = document.createDocumentFragment();
    playlistCountEl.textContent = `${tracks.length} 首`;
    playlistSourceEl.textContent = safeText(playlistData.name) || "网易云歌单";
    playlistSourceEl.href = playlistData.source || "https://music.163.com/";

    tracks.forEach((track, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const cover = document.createElement("img");
      const text = document.createElement("span");
      const title = document.createElement("span");
      const artist = document.createElement("span");

      button.className = "music-track";
      button.type = "button";
      button.dataset.index = String(index);
      button.setAttribute("aria-current", index === currentIndex ? "true" : "false");

      cover.className = "music-track-cover";
      cover.alt = "";
      cover.width = 36;
      cover.height = 36;
      cover.loading = "lazy";
      cover.decoding = "async";
      const thumbnail = coverUrl(track, 72);
      if (thumbnail) {
        cover.src = thumbnail;
      }

      text.className = "music-track-text";
      title.className = "music-track-title";
      artist.className = "music-track-artist";
      title.textContent = safeText(track.title) || "未命名歌曲";
      artist.textContent = safeText(track.artist) || "未知演唱者";
      item.dataset.search = `${title.textContent} ${artist.textContent}`.toLowerCase();

      text.append(title, artist);
      button.append(cover, text);
      item.appendChild(button);
      fragment.appendChild(item);
    });

    playlistEl.appendChild(fragment);
    updatePlaylistActive();
  }

  function filterPlaylist(query) {
    const keyword = safeText(query).trim().toLowerCase();
    let visible = 0;
    playlistEl.querySelectorAll("li").forEach((item) => {
      const match = !keyword || safeText(item.dataset.search).includes(keyword);
      item.hidden = !match;
      if (match) visible += 1;
    });
    playlistCountEl.textContent = keyword ? `${visible} / ${tracks.length} 首` : `${tracks.length} 首`;
    if (emptyEl) emptyEl.hidden = visible > 0;
  }

  collapsedButton.addEventListener("click", (event) => {
    event.preventDefault();
    setCollapsed(false);
    playButton.focus({ preventScroll: true });
  });

  coverButton.addEventListener("click", (event) => {
    event.preventDefault();
    togglePlay();
  });

  playButton.addEventListener("click", (event) => {
    event.preventDefault();
    togglePlay();
  });

  prevButton.addEventListener("click", (event) => {
    event.preventDefault();
    skip(-1);
  });

  nextButton.addEventListener("click", (event) => {
    event.preventDefault();
    skip(1);
  });

  listToggle.addEventListener("click", (event) => {
    event.preventDefault();
    setPlaylistOpen(!isPlaylistOpen);
  });

  if (shuffleButton) {
    shuffleButton.addEventListener("click", (event) => {
      event.preventDefault();
      isShuffle = !isShuffle;
      playHistory.length = 0;
      updateShuffleButton();
      setStatus(isShuffle ? "随机播放已开启" : "已恢复顺序播放");
      saveState();
    });
  }

  if (muteButton) {
    muteButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (audio.volume === 0) {
        audio.volume = settings.volume;
        audio.muted = false;
      } else {
        audio.muted = !audio.muted;
      }
      updateVolumeControls();
      saveState();
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
      const level = Math.min(Math.max(Number(volumeSlider.value) || 0, 0), 100);
      audio.volume = level / 100;
      audio.muted = level === 0;
      updateVolumeControls();
    });
    volumeSlider.addEventListener("change", saveState);
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => filterPlaylist(searchInput.value));
  }

  function handleOutsidePointer(target) {
    if (isCollapsed || root.contains(target)) return;
    const shouldRestoreFocus = root.contains(document.activeElement);
    setCollapsed(true);
    if (shouldRestoreFocus) collapsedButton.focus({ preventScroll: true });
  }

  function handleEscape(event) {
    if (event.key !== "Escape" || isCollapsed) return;
    if (searchInput && event.target === searchInput && searchInput.value) {
      searchInput.value = "";
      filterPlaylist("");
      return;
    }
    if (isPlaylistOpen) {
      setPlaylistOpen(false);
      listToggle.focus({ preventScroll: true });
    } else {
      setCollapsed(true);
      collapsedButton.focus({ preventScroll: true });
    }
  }

  document.addEventListener("click", (event) => handleOutsidePointer(event.target));
  document.addEventListener("keydown", handleEscape);

  progressBar.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    pendingResumeTime = 0;
    audio.currentTime = audio.duration * Number(progressBar.value) / 100;
    updateProgress();
    updateMediaPosition(true);
  });

  collapseToggle.addEventListener("click", (event) => {
    event.preventDefault();
    setCollapsed(true);
    collapsedButton.focus({ preventScroll: true });
  });

  playlistEl.addEventListener("click", (event) => {
    const trackButton = event.target.closest(".music-track");
    if (!trackButton) {
      return;
    }

    const nextIndex = Number(trackButton.dataset.index);
    if (!Number.isInteger(nextIndex)) {
      return;
    }

    if (nextIndex === currentIndex) {
      if (audio.paused) {
        togglePlay();
      }
      return;
    }

    consecutiveFailures = 0;
    rememberCurrent();
    loadTrack(nextIndex, { autoplay: true, statusText: "已切换歌曲" });
  });

  audio.addEventListener("play", () => {
    consecutiveFailures = 0;
    setPressed(true);
    updateMetadata(currentTrack());
    setStatus("正在加载…");
  });

  audio.addEventListener("playing", () => setStatus(""));
  audio.addEventListener("waiting", () => setStatus("正在缓冲…"));

  audio.addEventListener("pause", () => {
    setPressed(false);
    updateMetadata(currentTrack());
    setStatus("已暂停");
    saveState();
  });

  audio.addEventListener("timeupdate", () => {
    updateProgress();
    updateMediaPosition();
    if (Date.now() - lastSavedAt > 5000) saveState();
  });

  audio.addEventListener("loadedmetadata", () => {
    if (pendingResumeTime > 0 && Number.isFinite(audio.duration) && pendingResumeTime < audio.duration - 3) {
      audio.currentTime = pendingResumeTime;
    }
    pendingResumeTime = 0;
    updateProgress();
    updateMediaPosition(true);
  });

  audio.addEventListener("emptied", updateProgress);

  audio.addEventListener("volumechange", updateVolumeControls);

  audio.addEventListener("ended", () => {
    setPressed(false);
    setStatus("播放结束");

    if (!settings.loop) {
      return;
    }

    if (tracks.length > 1) {
      rememberCurrent();
      loadTrack(followingIndex(), { autoplay: true });
      return;
    }

    audio.currentTime = 0;
    audio.play().catch(() => {
      setStatus("播放结束，点击播放按钮重新播放");
    });
  });

  audio.addEventListener("error", () => {
    handlePlaybackFailure("加载失败：已尝试切到下一首");
  });

  setMediaAction("play", () => { if (audio.paused) togglePlay(); });
  setMediaAction("pause", () => { if (!audio.paused) togglePlay(); });
  setMediaAction("stop", () => audio.pause());
  setMediaAction("previoustrack", () => skip(-1));
  setMediaAction("nexttrack", () => skip(1));
  setMediaAction("seekbackward", (details) => {
    audio.currentTime = Math.max((audio.currentTime || 0) - (details?.seekOffset || 10), 0);
    updateMediaPosition(true);
  });
  setMediaAction("seekforward", (details) => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : Infinity;
    audio.currentTime = Math.min((audio.currentTime || 0) + (details?.seekOffset || 10), duration);
    updateMediaPosition(true);
  });
  setMediaAction("seekto", (details) => {
    if (!details || !Number.isFinite(details.seekTime)) return;
    audio.currentTime = details.seekTime;
    updateMediaPosition(true);
  });

  // ---------------------------------------------------------------------------
  // 跨页面不断播：音乐播放时，站内跳转在一个全屏 iframe 里完成，
  // 本页（以及播放器）保持不动，地址栏、标题和主题跟随 iframe 同步。
  // ---------------------------------------------------------------------------
  const shellSupported = typeof window.addEventListener === "function"
    && typeof history !== "undefined"
    && typeof history.pushState === "function"
    && typeof URL === "function"
    && typeof window.location !== "undefined";

  let shellFrame = null;
  let shellVisible = false;
  let shellPendingReveal = false;
  let savedScrollY = 0;
  let themeObserver = null;

  if (shellSupported) {
    window[SHELL_FLAG] = true;
  }

  function isNavigableUrl(url) {
    if (url.origin !== window.location.origin) return false;
    if (!/(\/|\.html?)$/i.test(url.pathname) && /\.[a-z0-9]+$/i.test(url.pathname)) return false;
    const here = new URL(window.location.href);
    if (url.pathname === here.pathname && url.search === here.search && url.hash) return false;
    return true;
  }

  function shouldKeepPlaying() {
    return !audio.paused;
  }

  function syncFromFrame() {
    if (!shellFrame || !shellVisible) return;
    try {
      const frameWindow = shellFrame.contentWindow;
      const frameDocument = shellFrame.contentDocument;
      if (!frameWindow || !frameDocument) return;
      const href = frameWindow.location.href;
      if (href && href !== "about:blank" && href !== window.location.href) {
        history.replaceState({ musicShell: true }, "", href);
      }
      if (frameDocument.title) document.title = frameDocument.title;
      const theme = frameDocument.documentElement.dataset.theme;
      if (theme) document.documentElement.dataset.theme = theme;
    } catch (error) {
      // The frame is not readable (it left our origin); keep the last synced URL.
    }
  }

  function onShellFrameLoad() {
    let frameWindow;
    let frameDocument;
    try {
      frameWindow = shellFrame.contentWindow;
      frameDocument = shellFrame.contentDocument;
      void frameWindow.location.href;
    } catch (error) {
      return;
    }
    if (!frameWindow || !frameDocument) return;

    frameDocument.addEventListener("click", (event) => handleOutsidePointer(event.target));
    frameDocument.addEventListener("keydown", handleEscape);
    frameWindow.addEventListener("hashchange", syncFromFrame);
    frameWindow.addEventListener("popstate", syncFromFrame);

    if (themeObserver) themeObserver.disconnect();
    if (typeof MutationObserver === "function") {
      themeObserver = new MutationObserver(syncFromFrame);
      themeObserver.observe(frameDocument.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    if (shellPendingReveal) {
      shellPendingReveal = false;
      showShell(true);
    }
    syncFromFrame();
  }

  function showShell(visible) {
    if (!shellFrame) return;
    const html = document.documentElement;
    if (visible && !shellVisible) {
      savedScrollY = window.scrollY || 0;
    }
    shellVisible = visible;
    html.classList.remove("music-shell-loading");
    html.classList.toggle("music-shell-active", visible);
    shellFrame.setAttribute("aria-hidden", String(!visible));
    shellFrame.tabIndex = visible ? 0 : -1;
    if (visible) {
      try {
        shellFrame.contentWindow.focus();
      } catch (error) {
        // Focus is best-effort.
      }
    } else {
      window.scrollTo(0, savedScrollY);
    }
  }

  function navigateInShell(href) {
    const url = new URL(href, window.location.href);
    document.documentElement.classList.add("music-shell-loading");
    shellPendingReveal = true;
    history.pushState({ musicShell: true }, "", url.href);

    if (!shellFrame) {
      shellFrame = document.createElement("iframe");
      shellFrame.className = "music-shell-frame";
      shellFrame.title = "页面内容";
      shellFrame.setAttribute("aria-hidden", "true");
      shellFrame.tabIndex = -1;
      shellFrame.addEventListener("load", onShellFrameLoad);
      shellFrame.src = url.href;
      document.documentElement.insertBefore(shellFrame, root);
      return;
    }

    try {
      shellFrame.contentWindow.location.replace(url.href);
    } catch (error) {
      shellFrame.src = url.href;
    }
  }

  if (shellSupported) {
    window.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!shouldKeepPlaying() || root.contains(event.target)) return;
      const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      if (link.dataset.noTransition === "true") return;
      const url = new URL(link.href, window.location.href);
      if (!isNavigableUrl(url)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigateInShell(url.href);
    }, true);

    window.addEventListener("submit", (event) => {
      if (event.defaultPrevented || !shouldKeepPlaying()) return;
      const form = event.target;
      if (!form || (form.method || "get").toLowerCase() !== "get" || (form.target && form.target !== "_self")) return;
      const url = new URL(form.action || window.location.href, window.location.href);
      if (!isNavigableUrl(url)) return;
      url.search = new URLSearchParams(new FormData(form)).toString();
      event.preventDefault();
      event.stopImmediatePropagation();
      navigateInShell(url.href);
    }, true);

    window.addEventListener("popstate", (event) => {
      if (!shellFrame) return;
      if (event.state && event.state.musicShell) {
        showShell(true);
        syncFromFrame();
      } else {
        showShell(false);
      }
    });

    window.addEventListener("pagehide", saveState);
  }

  renderPlaylist();
  updateShuffleButton();
  updateVolumeControls();
  loadTrack(currentIndex, { autoplay: false, resumeTime: pendingResumeTime });
  if (pendingResumeTime > 0) {
    setStatus(`上次听到 ${formatTime(pendingResumeTime)}，点播放继续`);
  }
  setCollapsed(true);
})();
