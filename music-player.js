(() => {
  const config = window.siteMusicConfig || {};
  const typeMap = {
    playlist: 0,
    album: 1,
    song: 2,
  };
  const routeMap = {
    playlist: "playlist",
    album: "album",
    song: "song",
  };

  function normalizeType(type) {
    return routeMap[type] ? type : "playlist";
  }

  function resolveMusicTarget() {
    const directId = String(config.id || "").trim();

    if (directId) {
      return {
        type: normalizeType(config.type),
        id: directId,
      };
    }

    const shareUrl = String(config.shareUrl || "").trim();

    if (!shareUrl) {
      return null;
    }

    const normalized = shareUrl.replace(/%23/g, "#");
    const match =
      normalized.match(/(?:#\/|\/)(playlist|album|song)\?[^#]*?id=(\d+)/i) ||
      normalized.match(/[?&]id=(\d+)/i);

    if (!match) {
      return null;
    }

    return {
      type: normalizeType(match[1] ? match[1].toLowerCase() : config.type),
      id: match[2],
    };
  }

  function createPlayer() {
    const target = resolveMusicTarget();

    if (config.provider !== "netease" || !target) {
      return;
    }

    const musicType = target.type;
    const musicId = target.id;
    const outerType = typeMap[musicType];
    const panelHeight = musicType === "song" ? 118 : 430;
    const iframeHeight = musicType === "song" ? 86 : 450;
    const storageKey = "music-player-open";
    const source = `https://music.163.com/outchain/player?type=${outerType}&id=${encodeURIComponent(
      musicId
    )}&auto=${config.autoPlay ? 1 : 0}&height=${panelHeight}`;
    const detailUrl = `https://music.163.com/#/${routeMap[musicType]}?id=${encodeURIComponent(musicId)}`;
    const shell = document.createElement("aside");
    const playerName = config.title || "Music";
    const initialOpen = (() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved === "open") {
          return true;
        }
        if (saved === "closed") {
          return false;
        }
      } catch (error) {
        // Ignore storage failures and fall back to config.
      }

      return Boolean(config.startOpen);
    })();

    shell.className = "music-dock";
    shell.innerHTML = `
      <button
        class="music-dock-toggle"
        type="button"
        data-music-toggle
        aria-expanded="${String(initialOpen)}"
        aria-controls="music-panel"
        aria-label="${initialOpen ? `收起音乐播放器：${playerName}` : `打开音乐播放器：${playerName}`}"
        title="${initialOpen ? "收起音乐播放器" : "打开音乐播放器"}"
      >
        <span class="music-dock-hint" aria-hidden="true">音乐</span>
        <span class="music-dock-vinyl" aria-hidden="true"></span>
        <span class="sr-only music-dock-sr">${initialOpen ? `收起音乐播放器：${playerName}` : `打开音乐播放器：${playerName}`}</span>
      </button>
      <section class="music-panel${initialOpen ? " is-open" : ""}" id="music-panel" data-music-panel>
        <div class="music-panel-head">
          <div>
            <p class="music-panel-kicker">Now Playing</p>
            <h2>${playerName}</h2>
          </div>
          <a href="${detailUrl}" target="_blank" rel="noreferrer">Open in NetEase</a>
        </div>
        <iframe
          title="${playerName}"
          src="${source}"
          loading="lazy"
          allow="autoplay"
          referrerpolicy="strict-origin-when-cross-origin"
          frameborder="0"
          marginwidth="0"
          marginheight="0"
          width="100%"
          height="${iframeHeight}"
        ></iframe>
      </section>
    `;

    document.body.appendChild(shell);

    const toggle = shell.querySelector("[data-music-toggle]");
    const panel = shell.querySelector("[data-music-panel]");
    const srLabel = shell.querySelector(".music-dock-sr");

    if (!toggle || !panel) {
      return;
    }

    function syncToggle(isOpen) {
      const text = `${isOpen ? "收起" : "打开"}音乐播放器：${playerName}`;
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", text);
      toggle.setAttribute("title", isOpen ? "收起音乐播放器" : "打开音乐播放器");

      if (srLabel) {
        srLabel.textContent = text;
      }
    }

    syncToggle(initialOpen);

    toggle.addEventListener("click", () => {
      const isOpen = panel.classList.toggle("is-open");
      syncToggle(isOpen);

      try {
        localStorage.setItem(storageKey, isOpen ? "open" : "closed");
      } catch (error) {
        // Ignore storage failures and keep the current session functional.
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createPlayer, { once: true });
  } else {
    createPlayer();
  }
})();
