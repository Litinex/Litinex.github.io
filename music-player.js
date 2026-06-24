(() => {
  const playlist = [
    {
      neteaseSongId: "1357960253",
      title: "藍二乗",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/AVhYLte6khAcd3wOO65avw==/109951170245162530.jpg",
    },
    {
      neteaseSongId: "487527984",
      title: "雲と幽霊",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/rD6Ul3DVakQkD8_VeL-aRw==/19162288649094546.jpg",
    },
    {
      neteaseSongId: "487527983",
      title: "靴の花火",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/rD6Ul3DVakQkD8_VeL-aRw==/19162288649094546.jpg",
    },
    {
      neteaseSongId: "2734279861",
      title: "修羅",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/R85bgBy55sUQnWq8NDlgaQ==/109951171812887175.jpg",
    },
    {
      neteaseSongId: "487527980",
      title: "言って。",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/rD6Ul3DVakQkD8_VeL-aRw==/19162288649094546.jpg",
    },
    {
      neteaseSongId: "1357953768",
      title: "だから僕は音楽を辞めた",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/AVhYLte6khAcd3wOO65avw==/109951170245162530.jpg",
    },
    {
      neteaseSongId: "2036445126",
      title: "都落ち",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/aC8zzUP4nr1sGx5qfr5cVw==/109951168523411427.jpg",
    },
    {
      neteaseSongId: "1357628744",
      title: "パレード",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/AVhYLte6khAcd3wOO65avw==/109951170245162530.jpg",
    },
    {
      neteaseSongId: "1870469768",
      title: "老人と海",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/5aHcGADR5i6biE5TSqf_aQ==/109951166295171725.jpg",
    },
    {
      neteaseSongId: "1466519473",
      title: "花人局",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/033ZocR9XnX1MdcXCWW_iQ==/109951165180340452.jpg",
    },
    {
      neteaseSongId: "1485319473",
      title: "風を食む",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/Jh-7TNNm9BhJZejuRx6_EQ==/109951165373693055.jpg",
    },
    {
      neteaseSongId: "1810759765",
      title: "春泥棒",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/kBtj7HlFDuokeO4iyHTXaA==/109951165616927101.jpg",
    },
    {
      neteaseSongId: "1850977722",
      title: "又三郎",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/b2M2BZbgwsk1n_UUAxxfSg==/109951166074391935.jpg",
    },
    {
      neteaseSongId: "1457709580",
      title: "思想犯",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/OWvCQnwUzt-LOcWSCYqW9Q==/109951165084906395.jpg",
    },
    {
      neteaseSongId: "557579321",
      title: "ただ君に晴れ",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/FHi1cWVObsNewrw-Jf2w3g==/109951163289889776.jpg",
    },
    {
      neteaseSongId: "1428153831",
      title: "夜行",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/rX3QUba-6_CacELe4bqL2g==/109951164767615222.jpg",
    },
    {
      neteaseSongId: "1442466883",
      title: "花に亡霊",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/_Os98d4NSKf-vLo_93QoEg==/109951164927614269.jpg",
    },
    {
      neteaseSongId: "1815109509",
      title: "嘘月",
      artist: "ヨルシカ",
      cover: "https://p1.music.126.net/Ok0xk_CpJW21lAUG9UiMww==/109951165666599650.jpg",
    },
    {
      neteaseSongId: "2093433056",
      title: "Ethereal",
      artist: "txmy",
      cover: "https://p2.music.126.net/HDlXcbUwFf9YXObc8aZ2aQ==/109951170245612849.jpg",
    },
    {
      neteaseSongId: "28481734",
      title: "a memories for us feat.\"Day's\"",
      artist: "MANYO / 三輪学",
      cover: "https://p2.music.126.net/GuHMyPqydehCKSPSnjddwQ==/109951171282694931.jpg",
    },
    {
      neteaseSongId: "2106662944",
      title: "Seraphic",
      artist: "txmy",
      cover: "https://p2.music.126.net/waQXFPUyyA8LB8B3_388vA==/109951171329995384.jpg",
    },
    {
      neteaseSongId: "2049977284",
      title: "A New Era",
      artist: "John Lunn / The Chamber Orchestra Of London",
      cover: "https://p2.music.126.net/dw4qiE2NMr3UabCaTIJ5og==/109951168634292660.jpg",
    },
    {
      neteaseSongId: "1856336348",
      title: "8.8",
      artist: "あたらよ",
      cover: "https://p1.music.126.net/33QleQ2pw4RTFTbHD2-z3w==/109951166120531270.jpg",
    },
    {
      neteaseSongId: "2112531307",
      title: "「僕は...」",
      artist: "あたらよ",
      cover: "https://p1.music.126.net/41BC-DD4kBShAYLNvcVzOg==/109951169217397474.jpg",
    },
    {
      neteaseSongId: "1973608593",
      title: "また夏を追う",
      artist: "あたらよ",
      cover: "https://p1.music.126.net/qMj8LmjgfBHlFxOHvTIyUw==/109951167795762268.jpg",
    },
    {
      neteaseSongId: "1867150097",
      title: "夏霞",
      artist: "あたらよ",
      cover: "https://p1.music.126.net/zi2Fm_ckfMEpkM37rZ5UEg==/109951166253940594.jpg",
    },
  ];

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
    <button class="music-collapsed-button" type="button" aria-label="展开音乐播放器" aria-expanded="false">
      <span class="music-collapsed-cover" aria-hidden="true">
        <span class="music-collapsed-disc-rotor">
          <span class="music-collapsed-disc-groove"></span>
          <span class="music-collapsed-disc-art"></span>
          <span class="music-collapsed-disc-hole"></span>
        </span>
      </span>
      <span class="music-collapsed-equalizer" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </button>
    <section class="music-player" aria-label="音乐播放器">
      <button class="music-cover-button" type="button" aria-label="播放音乐" aria-pressed="false">
        <span class="music-cover-shell" aria-hidden="true">
          <span class="music-disc-rotor">
            <span class="music-disc-groove"></span>
            <span class="music-disc-art"></span>
            <span class="music-disc-hole"></span>
          </span>
        </span>
      </button>
      <div class="music-main">
        <div class="music-meta">
          <div class="music-title"></div>
          <div class="music-artist"></div>
        </div>
        <div class="music-progress" aria-hidden="true">
          <span class="music-progress-bar"></span>
        </div>
        <div class="music-status" aria-live="polite"></div>
      </div>
      <div class="music-controls" role="group" aria-label="播放控制">
        <button class="music-icon-button music-prev" type="button" aria-label="上一首">
          <span aria-hidden="true">‹</span>
        </button>
        <button class="music-icon-button music-play" type="button" aria-label="播放音乐" aria-pressed="false">
          <span class="music-play-symbol" aria-hidden="true"></span>
        </button>
        <button class="music-icon-button music-next" type="button" aria-label="下一首">
          <span aria-hidden="true">›</span>
        </button>
        <button class="music-icon-button music-list-toggle" type="button" aria-label="展开播放列表" aria-expanded="false">
          <span aria-hidden="true">≡</span>
        </button>
        <button class="music-icon-button music-collapse-toggle" type="button" aria-label="折叠播放器">
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </section>
    <div class="music-playlist-panel" aria-label="播放列表" hidden>
      <div class="music-playlist-head">
        <span>Playlist</span>
        <strong class="music-playlist-count"></strong>
      </div>
      <ol class="music-playlist"></ol>
    </div>
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
  const prevButton = root.querySelector(".music-prev");
  const nextButton = root.querySelector(".music-next");
  const listToggle = root.querySelector(".music-list-toggle");
  const collapseToggle = root.querySelector(".music-collapse-toggle");
  const playlistPanel = root.querySelector(".music-playlist-panel");
  const playlistEl = root.querySelector(".music-playlist");
  const playlistCountEl = root.querySelector(".music-playlist-count");

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
    !prevButton ||
    !nextButton ||
    !listToggle ||
    !collapseToggle ||
    !playlistPanel ||
    !playlistEl ||
    !playlistCountEl
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

  function setCollapsed(shouldCollapse) {
    isCollapsed = Boolean(shouldCollapse);
    root.classList.toggle("is-collapsed", isCollapsed);
    playerEl.setAttribute("aria-hidden", String(isCollapsed));
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
    playlistPanel.hidden = !isPlaylistOpen;
  }

  function updateProgress() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const percent = duration > 0 ? Math.min(Math.max((currentTime / duration) * 100, 0), 100) : 0;
    progressBar.style.setProperty("--music-progress", `${percent}%`);
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
          setStatus("浏览器阻止了自动播放，请点击唱片开始播放");
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

    tracks.forEach((track, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const cover = document.createElement("span");
      const text = document.createElement("span");
      const title = document.createElement("span");
      const artist = document.createElement("span");

      button.className = "music-track";
      button.type = "button";
      button.dataset.index = String(index);
      button.setAttribute("aria-current", index === currentIndex ? "true" : "false");

      cover.className = "music-track-cover";
      const coverUrl = safeText(track.cover);
      if (coverUrl) {
        cover.style.setProperty("--music-cover", `url("${coverUrl}")`);
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
    if (!isPlaylistOpen) {
      return;
    }

    if (playlistPanel.contains(event.target) || listToggle.contains(event.target)) {
      return;
    }

    setPlaylistOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isPlaylistOpen) {
      setPlaylistOpen(false);
    }
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
    setStatus("正在播放");
  });

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
      setStatus("播放结束，点击唱片重新播放");
    });
  });

  audio.addEventListener("error", () => {
    handlePlaybackFailure("加载失败：已尝试切到下一首");
  });

  renderPlaylist();
  loadTrack(currentIndex, { autoplay: false });
  setCollapsed(true);
})();
