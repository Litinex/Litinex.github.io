(() => {
  const playlist = [
    {
      neteaseSongId: "",
      title: "未配置歌曲",
      artist: "请在 music-player.js 填入网易云歌曲信息",
      cover: "",
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
  root.className = "music-dock";
  root.innerHTML = `
    <button class="music-disc" type="button" aria-label="播放音乐" aria-pressed="false">
      <span class="music-disc-rotor" aria-hidden="true">
        <span class="music-disc-groove"></span>
        <span class="music-disc-art"></span>
        <span class="music-disc-hole"></span>
      </span>
      <span class="music-disc-icon" aria-hidden="true"></span>
    </button>
    <div class="music-panel" aria-live="polite">
      <div class="music-panel-inner">
        <div class="music-title"></div>
        <div class="music-artist"></div>
        <div class="music-status"></div>
      </div>
    </div>
  `;

  const mountPoint = document.body;
  if (!mountPoint) {
    return;
  }

  mountPoint.appendChild(root);

  const discButton = root.querySelector(".music-disc");
  const art = root.querySelector(".music-disc-art");
  const titleEl = root.querySelector(".music-title");
  const artistEl = root.querySelector(".music-artist");
  const statusEl = root.querySelector(".music-status");

  if (!discButton || !art || !titleEl || !artistEl || !statusEl) {
    root.remove();
    return;
  }

  let currentIndex = initialIndex;

  function currentTrack() {
    return tracks[currentIndex] || null;
  }

  function setStatus(text) {
    statusEl.textContent = safeText(text);
  }

  function setPressed(isPressed) {
    discButton.setAttribute("aria-pressed", String(Boolean(isPressed)));
    root.classList.toggle("is-playing", Boolean(isPressed));
  }

  function updateMetadata(track) {
    const title = safeText(track?.title) || "未命名歌曲";
    const artist = safeText(track?.artist) || "未知演唱者";
    const cover = safeText(track?.cover);

    titleEl.textContent = title;
    artistEl.textContent = artist;

    if (cover) {
      art.style.setProperty("--music-cover", `url("${cover}")`);
    } else {
      art.style.removeProperty("--music-cover");
    }

    discButton.setAttribute("aria-label", `${audio.paused ? "播放" : "暂停"}：${title} - ${artist}`);
  }

  function loadTrack(index, { autoplay = false } = {}) {
    currentIndex = Math.min(Math.max(index || 0, 0), Math.max(tracks.length - 1, 0));
    const track = currentTrack();
    const src = resolveTrackSource(track);

    audio.pause();
    audio.src = src;
    audio.currentTime = 0;

    updateMetadata(track);
    setPressed(false);

    if (!src) {
      setStatus("未配置可播放的歌曲");
      return;
    }

    setStatus("就绪");

    if (autoplay) {
      audio
        .play()
        .then(() => {})
        .catch(() => {
          setStatus("浏览器阻止了自动播放，请点击唱片开始播放");
        });
    }
  }

  function togglePlay() {
    if (!audio.src) {
      setStatus("请先在 music-player.js 填入网易云歌曲 ID");
      return;
    }

    if (audio.paused) {
      audio
        .play()
        .then(() => {})
        .catch(() => {
          setStatus("播放失败：可能是歌曲不可用或被限制");
        });
      return;
    }

    audio.pause();
  }

  discButton.addEventListener("click", (event) => {
    event.preventDefault();
    togglePlay();
  });

  audio.addEventListener("play", () => {
    setPressed(true);
    updateMetadata(currentTrack());
    setStatus("正在播放");
  });

  audio.addEventListener("pause", () => {
    setPressed(false);
    updateMetadata(currentTrack());
    setStatus("已暂停");
  });

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
    setPressed(false);
    setStatus("加载失败：请检查歌曲 ID 或网络情况");
  });

  loadTrack(currentIndex, { autoplay: false });
})();
