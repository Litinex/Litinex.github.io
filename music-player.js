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
  let consecutiveFailures = 0;

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

  function loadTrack(index, { autoplay = false, statusText = "" } = {}) {
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

  discButton.addEventListener("click", (event) => {
    event.preventDefault();
    togglePlay();
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

  loadTrack(currentIndex, { autoplay: false });
})();
