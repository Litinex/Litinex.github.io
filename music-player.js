(() => {
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

  const tracks = normalizePlaylist(playlist);
  const initialIndex = Math.min(Math.max(settings.startIndex || 0, 0), Math.max(tracks.length - 1, 0));
  const audio = new Audio();
  audio.preload = "none";
  audio.volume = typeof settings.volume === "number" ? settings.volume : 0.7;

  const root = document.createElement("div");
  root.className = "music-dock is-collapsed";
  root.innerHTML = `
    <button class="music-collapsed-button" type="button" aria-label="展开音乐播放器" aria-expanded="false" aria-controls="music-player">
      <span class="music-collapsed-disc-art" aria-hidden="true"></span>
      <span class="music-playing-dot" aria-hidden="true"></span>
    </button>
    <section class="music-player" id="music-player" aria-label="音乐播放器" hidden>
      <div class="music-player-heading">
        <span>随身听</span>
        <button class="music-icon-button music-collapse-toggle" type="button" aria-label="折叠播放器"><span aria-hidden="true">×</span></button>
      </div>
      <div class="music-now-playing">
        <button class="music-cover-button" type="button" aria-label="播放音乐" aria-pressed="false">
          <span class="music-disc-art" aria-hidden="true"></span>
        </button>
        <div class="music-meta">
          <div class="music-title"></div>
          <div class="music-artist"></div>
        </div>
      </div>
      <div class="music-timeline">
        <input class="music-progress-bar" type="range" min="0" max="100" step="0.1" value="0" aria-label="播放进度" disabled>
        <div class="music-times"><span class="music-elapsed">0:00</span><span class="music-duration">--:--</span></div>
      </div>
      <div class="music-controls" role="group" aria-label="播放控制">
        <button class="music-icon-button music-prev" type="button" aria-label="上一首">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M19 5 9 12l10 7Z"/></svg>
        </button>
        <button class="music-icon-button music-play" type="button" aria-label="播放音乐" aria-pressed="false"><span class="music-play-symbol" aria-hidden="true"></span></button>
        <button class="music-icon-button music-next" type="button" aria-label="下一首">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M5 5l10 7-10 7Z"/></svg>
        </button>
      </div>
      <div class="music-player-footer">
        <div class="music-status" role="status" aria-live="polite"></div>
        <button class="music-icon-button music-list-toggle" type="button" aria-label="展开播放列表" aria-expanded="false" aria-controls="music-playlist">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg><span>歌单</span>
        </button>
      </div>
    </section>
    <section class="music-playlist-panel" id="music-playlist" aria-label="播放列表" hidden>
      <div class="music-playlist-head"><a class="music-playlist-source" href="https://music.163.com/playlist?id=2427750321" target="_blank" rel="noopener noreferrer">网易云歌单</a><strong class="music-playlist-count"></strong></div>
      <ol class="music-playlist"></ol>
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

  function currentTrack() {
    return tracks[currentIndex] || null;
  }

  function setStatus(text) {
    statusEl.textContent = safeText(text);
  }

  function setPressed(isPressed) {
    const pressed = Boolean(isPressed);
    coverButton.setAttribute("aria-pressed", String(pressed));
    playButton.setAttribute("aria-pressed", String(pressed));
    root.classList.toggle("is-playing", pressed);
  }

  function setControlLabels(track) {
    const title = safeText(track?.title) || "未命名歌曲";
    const artist = safeText(track?.artist) || "未知演唱者";
    const action = audio.paused ? "播放" : "暂停";

    coverButton.setAttribute("aria-label", `${action}：${title} - ${artist}`);
    playButton.setAttribute("aria-label", `${action}：${title} - ${artist}`);
    collapsedButton.setAttribute("aria-label", `展开音乐播放器：${title} - ${artist}`);
  }

  const disclosureAnimations = new WeakMap();

  function setDisclosureVisible(element, visible) {
    const previous = disclosureAnimations.get(element);
    if (!previous && element.hidden === !visible) return;

    const canAnimate = typeof element.animate === "function"
      && !matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    progressBar.value = String(percent);
    progressBar.disabled = duration <= 0;
    elapsedEl.textContent = formatTime(currentTime);
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
    const cover = safeText(track?.cover);

    titleEl.textContent = title;
    titleEl.title = title;
    artistEl.title = artist;
    artistEl.textContent = artist;

    if (cover) {
      art.style.setProperty("--music-cover", `url("${cover}")`);
      collapsedArt.style.setProperty("--music-cover", `url("${cover}")`);
    } else {
      art.style.removeProperty("--music-cover");
      collapsedArt.style.removeProperty("--music-cover");
    }

    setControlLabels(track);
    updatePlaylistActive();
  }

  function loadTrack(index, { autoplay = false, statusText = "" } = {}) {
    currentIndex = Math.min(Math.max(index || 0, 0), Math.max(tracks.length - 1, 0));
    const track = currentTrack();
    const src = resolveTrackSource(track);

    updateSkipButtons();

    audio.pause();
    audio.src = src;
    audio.currentTime = 0;
    updateProgress();

    updateMetadata(track);
    setPressed(false);

    if (!src) {
      setStatus("未配置可播放的歌曲");
      return;
    }

    setStatus(safeText(statusText) || "就绪");

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

  function skip(delta) {
    if (tracks.length <= 1) {
      setStatus("只有一首歌，无法切歌");
      return;
    }

    consecutiveFailures = 0;
    const wasPlaying = !audio.paused;
    const nextIndex = indexWithDelta(delta);
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

    const nextIndex = (currentIndex + 1) % tracks.length;
    loadTrack(nextIndex, { autoplay: true, statusText: safeText(message) || "已切到下一首" });
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
      cover.width = 32;
      cover.height = 32;
      cover.loading = "lazy";
      cover.decoding = "async";
      const coverUrl = safeText(track.cover);
      if (coverUrl) {
        cover.src = `${coverUrl}?param=64y64`;
      }

      text.className = "music-track-text";
      title.className = "music-track-title";
      artist.className = "music-track-artist";
      title.textContent = safeText(track.title) || "未命名歌曲";
      artist.textContent = safeText(track.artist) || "未知演唱者";

      text.append(title, artist);
      button.append(cover, text);
      item.appendChild(button);
      fragment.appendChild(item);
    });

    playlistEl.appendChild(fragment);
    updatePlaylistActive();
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

  document.addEventListener("click", (event) => {
    if (isCollapsed || root.contains(event.target)) return;
    const shouldRestoreFocus = root.contains(document.activeElement);
    setCollapsed(true);
    if (shouldRestoreFocus) collapsedButton.focus({ preventScroll: true });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || isCollapsed) return;
    if (isPlaylistOpen) {
      setPlaylistOpen(false);
      listToggle.focus({ preventScroll: true });
    } else {
      setCollapsed(true);
      collapsedButton.focus({ preventScroll: true });
    }
  });

  progressBar.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = audio.duration * Number(progressBar.value) / 100;
    updateProgress();
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
    loadTrack(nextIndex, { autoplay: true, statusText: "已切换歌曲" });
  });

  audio.addEventListener("play", () => {
    consecutiveFailures = 0;
    setPressed(true);
    updateMetadata(currentTrack());
    setStatus("正在加载…");
  });

  audio.addEventListener("playing", () => setStatus("正在播放"));
  audio.addEventListener("waiting", () => setStatus("正在缓冲…"));

  audio.addEventListener("pause", () => {
    setPressed(false);
    updateMetadata(currentTrack());
    setStatus("已暂停");
  });

  audio.addEventListener("timeupdate", updateProgress);

  audio.addEventListener("loadedmetadata", updateProgress);

  audio.addEventListener("emptied", updateProgress);

  audio.addEventListener("ended", () => {
    setPressed(false);
    setStatus("播放结束");

    if (!settings.loop) {
      return;
    }

    if (tracks.length > 1) {
      const nextIndex = (currentIndex + 1) % tracks.length;
      loadTrack(nextIndex, { autoplay: true });
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

  renderPlaylist();
  loadTrack(currentIndex, { autoplay: false });
  setCollapsed(true);
})();
