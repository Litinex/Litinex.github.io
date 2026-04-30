(() => {
  const uptimeValue = document.querySelector("[data-site-uptime]");

  if (!uptimeValue) {
    return;
  }

  const startRaw =
    uptimeValue.getAttribute("data-site-start") ||
    uptimeValue.getAttribute("data-start") ||
    "2026-04-25T20:42:08+08:00";

  const startTime = new Date(startRaw);
  const startMs = startTime.getTime();

  if (!Number.isFinite(startMs)) {
    uptimeValue.textContent = "未设置";
    return;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatDuration(deltaSeconds) {
    const total = Math.max(0, Math.floor(deltaSeconds));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${days} 天 ${pad2(hours)} 小时 ${pad2(minutes)} 分 ${pad2(seconds)} 秒`;
  }

  function render() {
    const nowMs = Date.now();
    const deltaSeconds = (nowMs - startMs) / 1000;
    uptimeValue.textContent = formatDuration(deltaSeconds);
  }

  let timerId = 0;
  const tick = () => {
    render();
    const now = Date.now();
    const nextDelay = 1000 - (now % 1000);
    timerId = window.setTimeout(tick, Math.max(60, nextDelay));
  };

  window.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        render();
      }
    },
    { passive: true }
  );

  render();
  timerId = window.setTimeout(tick, 1000);

  window.addEventListener(
    "beforeunload",
    () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }
    },
    { passive: true }
  );
})();
