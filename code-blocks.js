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

  const pythonBuiltins = new Set([
    "print",
    "len",
    "range",
    "str",
    "int",
    "float",
    "bool",
    "list",
    "dict",
    "set",
    "tuple",
    "open",
    "input",
    "type",
    "isinstance",
    "enumerate",
    "zip",
    "map",
    "filter",
    "sum",
    "min",
    "max",
    "abs",
    "round",
    "sorted",
  ]);

  const pythonKeywords = new Set([
    "False",
    "None",
    "True",
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "while",
    "with",
    "yield",
  ]);

  async function copyToClipboard(text) {
    const value = typeof text === "string" ? text : "";

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        // Fall through to legacy copy.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";

    const activeElement = document.activeElement;

    try {
      document.body.appendChild(textarea);
      try {
        textarea.focus({ preventScroll: true });
      } catch (error) {
        textarea.focus();
      }
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      return Boolean(document.execCommand("copy"));
    } catch (error) {
      return false;
    } finally {
      textarea.remove();
      if (activeElement && typeof activeElement.focus === "function") {
        try {
          activeElement.focus({ preventScroll: true });
        } catch (error) {
          activeElement.focus();
        }
      }
    }
  }

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

  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function wrapToken(className, text) {
    return `<span class="${className}">${escapeHtml(text)}</span>`;
  }

  function findPythonCommentStart(line) {
    let inSingle = false;
    let inDouble = false;
    let escaped = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\\\") {
        escaped = true;
        continue;
      }

      if (!inDouble && char === "'") {
        inSingle = !inSingle;
        continue;
      }

      if (!inSingle && char === '"') {
        inDouble = !inDouble;
        continue;
      }

      if (!inSingle && !inDouble && char === "#") {
        return index;
      }
    }

    return -1;
  }

  function highlightPythonText(text) {
    if (!text) {
      return "";
    }

    // Split out string literals first.
    const segments = [];
    let cursor = 0;

    while (cursor < text.length) {
      const char = text[cursor];
      const isQuote = char === "'" || char === '"';
      if (!isQuote) {
        cursor += 1;
        continue;
      }

      const quote = char;
      const start = cursor;
      cursor += 1;
      let escaped = false;

      while (cursor < text.length) {
        const current = text[cursor];
        if (escaped) {
          escaped = false;
          cursor += 1;
          continue;
        }
        if (current === "\\\\") {
          escaped = true;
          cursor += 1;
          continue;
        }
        if (current === quote) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }

      const end = cursor;
      segments.push({ type: "string", start, end });
    }

    if (!segments.length) {
      return highlightPythonPlain(text);
    }

    let lastIndex = 0;
    let output = "";

    for (const segment of segments) {
      const before = text.slice(lastIndex, segment.start);
      if (before) {
        output += highlightPythonPlain(before);
      }
      const literal = text.slice(segment.start, segment.end);
      output += wrapToken("token-string", literal);
      lastIndex = segment.end;
    }

    const tail = text.slice(lastIndex);
    if (tail) {
      output += highlightPythonPlain(tail);
    }

    return output;
  }

  function highlightPythonPlain(text) {
    if (!text) {
      return "";
    }

    // Tokenize identifiers / numbers while preserving whitespace and punctuation.
    const regex = /([A-Za-z_][A-Za-z0-9_]*|\d+(?:_?\d)*(?:\.\d+(?:_?\d)*)?)/g;
    let lastIndex = 0;
    let output = "";

    for (const match of text.matchAll(regex)) {
      const start = match.index ?? 0;
      const token = match[0];
      const before = text.slice(lastIndex, start);
      if (before) {
        output += escapeHtml(before);
      }

      if (/^\\d/.test(token)) {
        output += wrapToken("token-number", token);
      } else if (pythonKeywords.has(token)) {
        output += wrapToken("token-keyword", token);
      } else if (pythonBuiltins.has(token)) {
        output += wrapToken("token-builtin", token);
      } else {
        output += escapeHtml(token);
      }

      lastIndex = start + token.length;
    }

    const tail = text.slice(lastIndex);
    if (tail) {
      output += escapeHtml(tail);
    }

    return output;
  }

  function highlightLine(line, language) {
    const safeLine = typeof line === "string" ? line : "";

    if (language !== "python") {
      return escapeHtml(safeLine);
    }

    const commentStart = findPythonCommentStart(safeLine);
    const codePart = commentStart >= 0 ? safeLine.slice(0, commentStart) : safeLine;
    const commentPart = commentStart >= 0 ? safeLine.slice(commentStart) : "";

    let output = highlightPythonText(codePart);

    if (commentPart) {
      output += wrapToken("token-comment", commentPart);
    }

    return output;
  }

  function lineMarkup(text, language) {
    return text
      .split("\n")
      .map((line) => `<span>${highlightLine(line, language) || "&nbsp;"}</span>`)
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
        <button class="code-editor-copy" type="button" data-code-copy aria-label="复制代码" title="复制代码">
          <span class="code-editor-copy-label">复制</span>
        </button>
      </div>
      <div class="code-editor-body">
        <div class="code-editor-lines" aria-hidden="true">
          ${lines.map((_, index) => `<span>${index + 1}</span>`).join("")}
        </div>
        <pre class="code-editor-code"><code class="code-editor-content">${lineMarkup(rawText, language)}</code></pre>
      </div>
    `;

    const copyButton = wrapper.querySelector("[data-code-copy]");
    if (copyButton) {
      const copyLabel = copyButton.querySelector(".code-editor-copy-label");
      const defaultLabel = copyLabel ? copyLabel.textContent : "";
      let resetTimer = 0;

      copyButton.addEventListener("click", async (event) => {
        event.preventDefault();

        if (resetTimer) {
          window.clearTimeout(resetTimer);
          resetTimer = 0;
        }

        copyButton.disabled = true;
        copyButton.classList.remove("is-copied", "is-error");

        const success = await copyToClipboard(rawText);

        copyButton.disabled = false;
        copyButton.classList.toggle("is-copied", success);
        copyButton.classList.toggle("is-error", !success);

        if (copyLabel) {
          copyLabel.textContent = success ? "已复制" : "复制失败";
        }

        resetTimer = window.setTimeout(() => {
          copyButton.classList.remove("is-copied", "is-error");
          if (copyLabel) {
            copyLabel.textContent = defaultLabel || "复制";
          }
          resetTimer = 0;
        }, 1600);
      });
    }

    preElement.replaceWith(wrapper);
  });
})();
