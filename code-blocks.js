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

  const runSupport = {
    python: true,
    javascript: true,
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

  function getLineCount(text) {
    if (!text) {
      return 1;
    }

    return text.split("\n").length;
  }

  function updateLineNumbers(linesContainer, text) {
    if (!linesContainer) return;
    const count = getLineCount(text);
    linesContainer.innerHTML = Array.from({ length: count }, (_, index) => `<span>${index + 1}</span>`).join("");
  }

  function debounce(fn, delayMs) {
    let timer = 0;
    return (...args) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = 0;
        fn(...args);
      }, delayMs);
    };
  }

  function setBusy(button, busy, labelEl, labelText) {
    if (!button) return;
    button.disabled = Boolean(busy);
    if (labelEl && typeof labelText === "string") {
      labelEl.textContent = labelText;
    }
  }

  // --- Runtime: Pyodide (lazy-loaded) ---
  let pyodideReadyPromise = null;

  function injectScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((s) => s.src === src);
      if (existing) {
        if (existing.dataset && existing.dataset.loaded === "true") {
          resolve();
          return;
        }
        if (existing.dataset && existing.dataset.error === "true") {
          reject(new Error(`Script 加载失败: ${src}`));
          return;
        }

        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", (e) => reject(e), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          resolve();
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        (e) => {
          script.dataset.error = "true";
          reject(e);
        },
        { once: true },
      );
      document.head.appendChild(script);
    });
  }

  async function ensurePyodide(outputWriteLine) {
    if (pyodideReadyPromise) {
      return pyodideReadyPromise;
    }

    pyodideReadyPromise = (async () => {
      const baseUrl = "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/";
      await injectScript(`${baseUrl}pyodide.js`);

      if (typeof globalThis.loadPyodide !== "function") {
        throw new Error("Pyodide 加载失败：loadPyodide 不存在");
      }

      const pyodide = await globalThis.loadPyodide({ indexURL: baseUrl });

      // Redirect stdout/stderr to our output panel.
      try {
        pyodide.setStdout({
          batched: (msg) => {
            if (typeof msg === "string") outputWriteLine(msg);
          },
        });
        pyodide.setStderr({
          batched: (msg) => {
            if (typeof msg === "string") outputWriteLine(msg);
          },
        });
      } catch (error) {
        // If API changes, keep going with default stdout.
      }

      return pyodide;
    })();

    return pyodideReadyPromise;
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
        <div class="code-editor-actions">
          <button class="code-editor-action code-editor-edit" type="button" data-code-edit aria-label="编辑代码" title="编辑代码">
            <span class="code-editor-action-label">编辑</span>
          </button>
          <button class="code-editor-action code-editor-run" type="button" data-code-run aria-label="运行代码" title="运行代码" ${runSupport[language] ? "" : "disabled"}>
            <span class="code-editor-action-label">运行</span>
          </button>
          <button class="code-editor-action code-editor-copy" type="button" data-code-copy aria-label="复制代码" title="复制代码">
            <span class="code-editor-copy-label">复制</span>
          </button>
        </div>
      </div>
      <div class="code-editor-body">
        <div class="code-editor-lines" aria-hidden="true">
          ${lines.map((_, index) => `<span>${index + 1}</span>`).join("")}
        </div>
        <div class="code-editor-main">
          <pre class="code-editor-code" data-code-view><code class="code-editor-content">${lineMarkup(rawText, language)}</code></pre>
          <textarea class="code-editor-input" data-code-input spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" hidden></textarea>
        </div>
      </div>
      <div class="code-editor-output" data-code-output hidden>
        <div class="code-editor-output-bar">
          <span class="code-editor-output-title">输出</span>
          <button class="code-editor-action code-editor-clear" type="button" data-code-clear aria-label="清空输出" title="清空输出">
            <span class="code-editor-action-label">清空</span>
          </button>
        </div>
        <pre class="code-editor-output-content" data-code-output-content></pre>
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

    const linesContainer = wrapper.querySelector(".code-editor-lines");
    const viewCode = wrapper.querySelector(".code-editor-content");
    const viewPre = wrapper.querySelector("[data-code-view]");
    const input = wrapper.querySelector("[data-code-input]");
    const editButton = wrapper.querySelector("[data-code-edit]");
    const runButton = wrapper.querySelector("[data-code-run]");
    const output = wrapper.querySelector("[data-code-output]");
    const outputContent = wrapper.querySelector("[data-code-output-content]");
    const clearButton = wrapper.querySelector("[data-code-clear]");

    const state = {
      text: rawText,
      language,
      editing: false,
      running: false,
    };

    const writeOutputLine = (line) => {
      if (!output || !outputContent) return;
      output.hidden = false;
      const msg = typeof line === "string" ? line : String(line);
      outputContent.textContent += msg.endsWith("\n") ? msg : `${msg}\n`;
      // Keep scrolled to bottom.
      outputContent.scrollTop = outputContent.scrollHeight;
    };

    const clearOutput = () => {
      if (!output || !outputContent) return;
      outputContent.textContent = "";
    };

    if (clearButton) {
      clearButton.addEventListener("click", (event) => {
        event.preventDefault();
        clearOutput();
      });
    }

    const renderView = () => {
      if (!viewCode) return;
      viewCode.innerHTML = lineMarkup(state.text, state.language);
      updateLineNumbers(linesContainer, state.text);
    };

    const renderViewDebounced = debounce(renderView, 60);

    const setEditing = (nextEditing) => {
      const next = Boolean(nextEditing);
      state.editing = next;
      if (!input || !viewPre || !editButton) return;

      const editLabel = editButton.querySelector(".code-editor-action-label");
      if (next) {
        input.hidden = false;
        viewPre.hidden = true;
        input.value = state.text;
        updateLineNumbers(linesContainer, state.text);
        if (editLabel) editLabel.textContent = "完成";
        try {
          input.focus({ preventScroll: true });
        } catch (error) {
          input.focus();
        }
        return;
      }

      state.text = normalizeCodeText(input.value);
      input.hidden = true;
      viewPre.hidden = false;
      if (editLabel) editLabel.textContent = "编辑";
      renderView();
    };

    if (editButton) {
      editButton.addEventListener("click", (event) => {
        event.preventDefault();
        setEditing(!state.editing);
      });
    }

    if (input) {
      input.value = state.text;
      input.addEventListener("input", () => {
        state.text = input.value.replace(/\r\n/g, "\n");
        updateLineNumbers(linesContainer, state.text);
        // Live update preview in background (when editing) for a nicer feel.
        renderViewDebounced();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          const value = input.value;
          input.value = value.slice(0, start) + "  " + value.slice(end);
          input.selectionStart = start + 2;
          input.selectionEnd = start + 2;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "enter") {
          // Ctrl/Cmd + Enter runs.
          runButton?.click();
        }
      });
      // Keep horizontal scroll similar to pre for long lines.
      input.addEventListener("scroll", () => {
        if (!viewPre) return;
        viewPre.scrollTop = input.scrollTop;
        viewPre.scrollLeft = input.scrollLeft;
      });
    }

    const runPython = async () => {
      const buttonLabel = runButton?.querySelector(".code-editor-action-label");
      clearOutput();
      writeOutputLine("正在加载运行环境…（首次会较慢）");
      try {
        const pyodide = await ensurePyodide(writeOutputLine);
        clearOutput();
        await pyodide.runPythonAsync(state.text);
      } catch (error) {
        clearOutput();
        writeOutputLine(String(error?.message || error));
      } finally {
        setBusy(runButton, false, buttonLabel, "运行");
      }
    };

    const runJavaScript = async () => {
      const buttonLabel = runButton?.querySelector(".code-editor-action-label");
      clearOutput();

      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      const capture = (...args) => writeOutputLine(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));

      console.log = (...args) => {
        originalLog(...args);
        capture(...args);
      };
      console.warn = (...args) => {
        originalWarn(...args);
        capture(...args);
      };
      console.error = (...args) => {
        originalError(...args);
        capture(...args);
      };

      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(state.text);
        const result = fn();
        if (result !== undefined) {
          writeOutputLine(String(result));
        }
      } catch (error) {
        writeOutputLine(String(error?.message || error));
      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
        setBusy(runButton, false, buttonLabel, "运行");
      }
    };

    if (runButton) {
      runButton.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!runSupport[state.language]) return;

        const buttonLabel = runButton.querySelector(".code-editor-action-label");
        setBusy(runButton, true, buttonLabel, "运行中…");

        if (state.language === "python") {
          await runPython();
          return;
        }

        if (state.language === "javascript") {
          await runJavaScript();
        }
      });
    }

    preElement.replaceWith(wrapper);
  });
})();
