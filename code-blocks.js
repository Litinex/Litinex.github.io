(() => {
  const languageNames = {
    python: "Python",
    javascript: "JavaScript",
    typescript: "TypeScript",
    html: "HTML",
    css: "CSS",
    bash: "Shell",
    code: "Code",
  };

  function detectLanguage(text) {
    const source = text.trim();

    if (!source) {
      return "code";
    }

    if (/<[a-z][\s\S]*?>/i.test(source)) {
      return "html";
    }

    if (/(^|\n)\s*[.#]?[a-zA-Z0-9_-]+\s*\{[\s\S]*:\s*[^;]+;?/m.test(source)) {
      return "css";
    }

    if (/\b(const|let|var|function|import|export|console\.log|=>)\b/.test(source)) {
      return "javascript";
    }

    if (/(^|\n)\s*(git|npm|pnpm|yarn|python|pip|cd|ls|mkdir)\b/m.test(source)) {
      return "bash";
    }

    if (/\b(print|def|class|import|from|for|while|if|elif|else|return|with|try|except)\b|:\s*(#.*)?$/m.test(source)) {
      return "python";
    }

    return "code";
  }

  function resolveLanguage(codeElement, text) {
    const className = codeElement.className || "";
    const explicit = className.match(/language-([a-z0-9_-]+)/i);

    if (explicit) {
      return explicit[1].toLowerCase();
    }

    return detectLanguage(text);
  }

  function fileLabel(language) {
    switch (language) {
      case "python":
        return "main.py";
      case "javascript":
        return "app.js";
      case "typescript":
        return "app.ts";
      case "html":
        return "index.html";
      case "css":
        return "styles.css";
      case "bash":
        return "terminal";
      default:
        return "snippet";
    }
  }

  function normalizeCodeText(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");

    while (lines.length && !lines[0].trim()) {
      lines.shift();
    }

    while (lines.length && !lines[lines.length - 1].trim()) {
      lines.pop();
    }

    return lines.join("\n");
  }

  function lineMarkup(text) {
    return text
      .split("\n")
      .map((line) => `<span>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "&nbsp;"}</span>`)
      .join("");
  }

  document.querySelectorAll("pre code").forEach((codeElement) => {
    if (codeElement.closest(".code-editor")) {
      return;
    }

    const preElement = codeElement.parentElement;
    const rawText = normalizeCodeText(codeElement.textContent);
    const language = resolveLanguage(codeElement, rawText);
    const wrapper = document.createElement("figure");
    const lines = rawText ? rawText.split("\n") : [""];

    wrapper.className = "code-editor";
    wrapper.innerHTML = `
      <div class="code-editor-bar">
        <div class="code-editor-dots" aria-hidden="true">
          <span class="code-editor-dot code-editor-dot-red"></span>
          <span class="code-editor-dot code-editor-dot-yellow"></span>
          <span class="code-editor-dot code-editor-dot-green"></span>
        </div>
        <div class="code-editor-meta">
          <span class="code-editor-filename">${fileLabel(language)}</span>
          <span class="code-editor-language">${languageNames[language] || languageNames.code}</span>
        </div>
      </div>
      <div class="code-editor-body">
        <div class="code-editor-lines" aria-hidden="true">
          ${lines.map((_, index) => `<span>${index + 1}</span>`).join("")}
        </div>
        <pre class="code-editor-code"><code class="code-editor-content">${lineMarkup(rawText)}</code></pre>
      </div>
    `;

    preElement.replaceWith(wrapper);
  });
})();
