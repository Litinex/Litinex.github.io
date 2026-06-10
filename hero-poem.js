(() => {
  const target = document.querySelector("[data-hero-poem]");
  if (!target) return;

  const setTitle = (poem) => {
    const base = (document.title || "").split("|")[0].trim() || "风迁夏回";
    document.title = `${base} | ${poem}`;
  };

  const fallbackPoems = [
    "行到水穷处，坐看云起时。",
    "明月松间照，清泉石上流。",
    "采菊东篱下，悠然见南山。",
    "大漠孤烟直，长河落日圆。",
    "落霞与孤鹜齐飞，秋水共长天一色。",
    "浮云游子意，落日故人情。",
    "山重水复疑无路，柳暗花明又一村。",
    "长风破浪会有时，直挂云帆济沧海。",
    "欲穷千里目，更上一层楼。",
    "松风吹解带，山月照弹琴。",
    "人生如逆旅，我亦是行人。",
  ];

  const maxDisplayLength = 16;

  const cleanPoem = (value) => String(value || "").replace(/\s+/g, "").trim();

  const isDisplayablePoem = (value) => {
    const poem = cleanPoem(value);
    return poem.length > 0 && poem.length <= maxDisplayLength;
  };

  const pickFallback = () =>
    fallbackPoems[Math.floor(Math.random() * fallbackPoems.length)];

  const fitPoemToLine = () => {
    target.style.removeProperty("--hero-poem-scale");

    const availableWidth = target.parentElement
      ? target.parentElement.getBoundingClientRect().width
      : target.getBoundingClientRect().width;
    const actualWidth = target.scrollWidth;

    if (!availableWidth || !actualWidth || actualWidth <= availableWidth) {
      return;
    }

    const scale = Math.max(0.48, Math.min(1, availableWidth / actualWidth));
    target.style.setProperty("--hero-poem-scale", String(scale));
  };

  const setPoem = (poem) => {
    const displayPoem = isDisplayablePoem(poem) ? cleanPoem(poem) : pickFallback();
    target.textContent = displayPoem;
    setTitle(displayPoem);
    window.requestAnimationFrame(fitPoemToLine);
  };

  const requestPoem = async () => {
    const endpoint = "https://v1.jinrishici.com/all.json";
    const controller = new AbortController();
    const timeoutMs = 2500;
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = (data && data.content ? String(data.content) : "").trim();
      if (!content) {
        throw new Error("Empty poem content");
      }

      setPoem(content);
    } catch (error) {
      setPoem(pickFallback());
    } finally {
      window.clearTimeout(timer);
    }
  };

  window.addEventListener("resize", fitPoemToLine);
  requestPoem();
})();
