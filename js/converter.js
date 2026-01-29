/**
 * cURL to Python Converter
 * Supports: requests, httpx (sync/async), aiohttp
 */

// ==================== I18N ====================
const translations = {
  ru: {
    inputPlaceholder: "Вставьте cURL команду...",
    outputPlaceholder: "# Python код появится здесь...",
    imports: "Импорты",
    session: "Session",
    hint: "Ctrl+V для вставки",
    example: "Пример",
    paste: "Вставить",
    clear: "Очистить",
    copy: "Копировать",
    download: "Скачать",
    copied: "Скопировано!",
    saved: "Файл сохранён",
    noAccess: "Нет доступа к буферу",
    nothingToCopy: "Нечего копировать",
    nothingToDownload: "Нечего скачивать",
    errorPrefix: 'Команда должна начинаться с "curl"',
    errorNoUrl: "URL не найден",
  },
  en: {
    inputPlaceholder: "Paste cURL command...",
    outputPlaceholder: "# Python code will appear here...",
    imports: "Imports",
    session: "Session",
    hint: "Ctrl+V to paste",
    example: "Example",
    paste: "Paste",
    clear: "Clear",
    copy: "Copy",
    download: "Download",
    copied: "Copied!",
    saved: "File saved",
    noAccess: "No clipboard access",
    nothingToCopy: "Nothing to copy",
    nothingToDownload: "Nothing to download",
    errorPrefix: 'Command must start with "curl"',
    errorNoUrl: "URL not found",
  },
};

class I18n {
  constructor() {
    this.lang = this.detectLanguage();
    this.applyTranslations();
  }

  detectLanguage() {
    // Сначала проверяем сохранённый выбор
    const saved = localStorage.getItem("lang");
    if (saved && translations[saved]) {
      return saved;
    }

    // Иначе определяем по браузеру
    const browserLang = navigator.language.slice(0, 2).toLowerCase();
    return translations[browserLang] ? browserLang : "en";
  }

  toggle() {
    this.lang = this.lang === "ru" ? "en" : "ru";
    localStorage.setItem("lang", this.lang);
    this.applyTranslations();
    return this.lang;
  }

  get(key) {
    return translations[this.lang][key] || translations["en"][key] || key;
  }

  applyTranslations() {
    // Элементы с data-i18n
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = this.get(key);
    });

    // Плейсхолдеры
    document.querySelectorAll("[data-placeholder-key]").forEach((el) => {
      const key = el.getAttribute("data-placeholder-key");
      el.placeholder = this.get(key);
    });

    // Плейсхолдеры для data-placeholder (через атрибут)
    document.querySelectorAll("code[data-placeholder-key]").forEach((el) => {
      const key = el.getAttribute("data-placeholder-key");
      el.setAttribute("data-placeholder", this.get(key));
    });

    // Тултипы
    document.querySelectorAll("[data-tooltip-key]").forEach((el) => {
      const key = el.getAttribute("data-tooltip-key");
      el.title = this.get(key);
    });

    // Кнопка переключения
    const btn = document.getElementById("lang-toggle");
    if (btn) {
      btn.textContent = this.lang === "ru" ? "EN" : "RU";
    }
  }
}

const i18n = new I18n();
// ==================== CURL PARSER ====================
class CurlParser {
  constructor(curlCommand) {
    this.raw = curlCommand.trim();
    this.method = "GET";
    this.url = "";
    this.headers = {};
    this.cookies = {};
    this.data = null;
    this.auth = null;
    this.proxy = null;
    this.proxyAuth = null;
    this.insecure = false;
    this.timeout = null;

    this.parse();
  }

  parse() {
    let command = this.raw
      .replace(/\\\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!command.toLowerCase().startsWith("curl ")) {
      throw new Error(i18n.get("errorPrefix"));
    }
    const tokens = this.tokenize(command);
    this.parseTokens(tokens);
  }

  tokenize(command) {
    const tokens = [];
    let current = "";
    let inQuote = null;
    let escape = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (escape) {
        current += char;
        escape = false;
        continue;
      }

      if (char === "\\") {
        escape = true;
        continue;
      }

      if (char === '"' || char === "'") {
        if (inQuote === null) {
          inQuote = char;
        } else if (inQuote === char) {
          inQuote = null;
        } else {
          current += char;
        }
        continue;
      }

      if (char === " " && inQuote === null) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }

      current += char;
    }

    if (current) tokens.push(current);
    return tokens;
  }

  parseTokens(tokens) {
    let i = 1;

    while (i < tokens.length) {
      const token = tokens[i];
      const next = tokens[i + 1];

      switch (token) {
        case "-X":
        case "--request":
          this.method = next?.toUpperCase() || "GET";
          i += 2;
          break;
        case "-H":
        case "--header":
          if (next) this.parseHeader(next);
          i += 2;
          break;
        case "-d":
        case "--data":
        case "--data-raw":
        case "--data-binary":
          this.data = next;
          if (this.method === "GET") this.method = "POST";
          i += 2;
          break;
        case "-b":
        case "--cookie":
          if (next) this.parseCookies(next);
          i += 2;
          break;
        case "-u":
        case "--user":
          if (next) {
            const [user, pass] = next.split(":");
            this.auth = { user, pass: pass || "" };
          }
          i += 2;
          break;
        case "-x":
        case "--proxy":
          this.proxy = next;
          i += 2;
          break;
        case "-U":
        case "--proxy-user":
          this.proxyAuth = next;
          i += 2;
          break;
        case "-k":
        case "--insecure":
          this.insecure = true;
          i++;
          break;
        case "-A":
        case "--user-agent":
          if (next) this.headers["User-Agent"] = next;
          i += 2;
          break;
        case "-e":
        case "--referer":
          if (next) this.headers["Referer"] = next;
          i += 2;
          break;
        case "-m":
        case "--max-time":
        case "--connect-timeout":
          if (next) this.timeout = parseFloat(next);
          i += 2;
          break;
        case "--compressed":
        case "-s":
        case "--silent":
        case "-S":
        case "-i":
        case "-v":
        case "-L":
        case "--location":
          i++;
          break;
        default:
          if (!token.startsWith("-") && !this.url) {
            this.url = token;
          }
          i++;
      }
    }

    if (!this.url) {
      throw new Error(i18n.get("errorNoUrl"));
    }
  }

  parseHeader(header) {
    const idx = header.indexOf(":");
    if (idx === -1) return;

    const key = header.substring(0, idx).trim();
    const value = header.substring(idx + 1).trim();

    if (key.toLowerCase() === "cookie") {
      this.parseCookies(value);
    } else {
      this.headers[key] = value;
    }
  }

  parseCookies(str) {
    str.split(";").forEach((cookie) => {
      const idx = cookie.indexOf("=");
      if (idx > 0) {
        this.cookies[cookie.substring(0, idx).trim()] = cookie
          .substring(idx + 1)
          .trim();
      }
    });
  }
}

// ==================== CODE GENERATOR ====================
class CodeGenerator {
  constructor(parsed, options) {
    this.p = parsed;
    this.o = options;
    this.i = "    ";
  }

  generate() {
    switch (this.o.library) {
      case "requests":
        return this.genRequests();
      case "httpx_sync":
        return this.genHttpxSync();
      case "httpx_async":
        return this.genHttpxAsync();
      case "aiohttp":
        return this.genAiohttp();
    }
  }

  // Helpers
  str(s) {
    if (s == null) return "''";
    s = String(s);
    if (s.includes("'") && !s.includes('"')) return `"${s}"`;
    return `'${s.replace(/'/g, "\\'")}'`;
  }

  dict(obj, indent = 0) {
    const entries = Object.entries(obj || {});
    if (!entries.length) return "{}";

    if (entries.length <= 2 && JSON.stringify(obj).length < 50) {
      return (
        "{" +
        entries
          .map(
            ([k, v]) =>
              `${this.str(k)}: ${typeof v === "object" ? this.dict(v) : this.str(v)}`,
          )
          .join(", ") +
        "}"
      );
    }

    const base = this.i.repeat(indent);
    const item = this.i.repeat(indent + 1);
    return (
      "{\n" +
      entries
        .map(
          ([k, v]) =>
            `${item}${this.str(k)}: ${typeof v === "object" ? this.dict(v, indent + 1) : this.str(v)}`,
        )
        .join(",\n") +
      `\n${base}}`
    );
  }

  vars() {
    let c = "";
    if (Object.keys(this.p.headers).length)
      c += `headers = ${this.dict(this.p.headers)}\n\n`;
    if (Object.keys(this.p.cookies).length)
      c += `cookies = ${this.dict(this.p.cookies)}\n\n`;
    if (this.p.data) {
      try {
        const parsed = JSON.parse(this.p.data);
        c += `data = ${this.dict(parsed)}\n\n`;
      } catch {
        c += `data = ${this.str(this.p.data)}\n\n`;
      }
    }
    return c;
  }

  dataParam(indent) {
    if (!this.p.data) return "";
    try {
      JSON.parse(this.p.data);
      return `,\n${indent}json=data`;
    } catch {
      const ct = Object.entries(this.p.headers).find(
        ([k]) => k.toLowerCase() === "content-type",
      );
      if (ct?.[1]?.includes("json")) return `,\n${indent}json=data`;
      return `,\n${indent}data=data`;
    }
  }

  proxyUrl() {
    if (!this.p.proxy) return null;
    return this.p.proxyAuth
      ? `http://${this.p.proxyAuth}@${this.p.proxy}`
      : `http://${this.p.proxy}`;
  }

  // ===== REQUESTS =====
  genRequests() {
    let c = this.o.includeImports ? "import requests\n\n" : "";
    c += this.vars();

    const method = this.p.method.toLowerCase();
    const ind = this.i;

    if (this.o.useSession) {
      c += "with requests.Session() as session:\n";
      if (this.o.addErrorHandling) {
        c += `${ind}try:\n`;
        c += `${ind}${ind}response = session.${method}(\n`;
        c += `${ind}${ind}${ind}${this.str(this.p.url)}`;
        c += this.requestsParams(ind.repeat(3));
        c += `\n${ind}${ind})\n`;
        c += `${ind}${ind}response.raise_for_status()\n`;
        c += `${ind}${ind}print(response.json())\n`;
        c += `${ind}except requests.RequestException as e:\n`;
        c += `${ind}${ind}print(f"Error: {e}")\n`;
      } else {
        c += `${ind}response = session.${method}(\n`;
        c += `${ind}${ind}${this.str(this.p.url)}`;
        c += this.requestsParams(ind.repeat(2));
        c += `\n${ind})\n`;
        c += `${ind}print(response.text)\n`;
      }
    } else if (this.o.addErrorHandling) {
      c += "try:\n";
      c += `${ind}response = requests.${method}(\n`;
      c += `${ind}${ind}${this.str(this.p.url)}`;
      c += this.requestsParams(ind.repeat(2));
      c += `\n${ind})\n`;
      c += `${ind}response.raise_for_status()\n`;
      c += `${ind}print(response.json())\n`;
      c += "except requests.RequestException as e:\n";
      c += `${ind}print(f"Error: {e}")\n`;
    } else {
      c += `response = requests.${method}(\n`;
      c += `${ind}${this.str(this.p.url)}`;
      c += this.requestsParams(ind);
      c += "\n)\n";
      c += "print(response.text)\n";
    }
    return c;
  }

  requestsParams(ind) {
    let p = "";
    if (Object.keys(this.p.headers).length) p += `,\n${ind}headers=headers`;
    if (Object.keys(this.p.cookies).length) p += `,\n${ind}cookies=cookies`;
    p += this.dataParam(ind);
    if (this.p.auth)
      p += `,\n${ind}auth=(${this.str(this.p.auth.user)}, ${this.str(this.p.auth.pass)})`;
    if (this.proxyUrl()) {
      const url = this.proxyUrl();
      p += `,\n${ind}proxies={'http': ${this.str(url)}, 'https': ${this.str(url)}}`;
    }
    if (this.p.insecure) p += `,\n${ind}verify=False`;
    if (this.p.timeout) p += `,\n${ind}timeout=${this.p.timeout}`;
    return p;
  }

  // ===== HTTPX SYNC =====
  genHttpxSync() {
    let c = this.o.includeImports ? "import httpx\n\n" : "";
    c += this.vars();

    const method = this.p.method.toLowerCase();
    const ind = this.i;

    if (this.o.useSession) {
      c += "with httpx.Client() as client:\n";
      if (this.o.addErrorHandling) {
        c += `${ind}try:\n`;
        c += `${ind}${ind}response = client.${method}(\n`;
        c += `${ind}${ind}${ind}${this.str(this.p.url)}`;
        c += this.httpxParams(ind.repeat(3));
        c += `\n${ind}${ind})\n`;
        c += `${ind}${ind}response.raise_for_status()\n`;
        c += `${ind}${ind}print(response.json())\n`;
        c += `${ind}except httpx.HTTPError as e:\n`;
        c += `${ind}${ind}print(f"Error: {e}")\n`;
      } else {
        c += `${ind}response = client.${method}(\n`;
        c += `${ind}${ind}${this.str(this.p.url)}`;
        c += this.httpxParams(ind.repeat(2));
        c += `\n${ind})\n`;
        c += `${ind}print(response.text)\n`;
      }
    } else if (this.o.addErrorHandling) {
      c += "try:\n";
      c += `${ind}response = httpx.${method}(\n`;
      c += `${ind}${ind}${this.str(this.p.url)}`;
      c += this.httpxParams(ind.repeat(2));
      c += `\n${ind})\n`;
      c += `${ind}response.raise_for_status()\n`;
      c += `${ind}print(response.json())\n`;
      c += "except httpx.HTTPError as e:\n";
      c += `${ind}print(f"Error: {e}")\n`;
    } else {
      c += `response = httpx.${method}(\n`;
      c += `${ind}${this.str(this.p.url)}`;
      c += this.httpxParams(ind);
      c += "\n)\n";
      c += "print(response.text)\n";
    }
    return c;
  }

  httpxParams(ind) {
    let p = "";
    if (Object.keys(this.p.headers).length) p += `,\n${ind}headers=headers`;
    if (Object.keys(this.p.cookies).length) p += `,\n${ind}cookies=cookies`;
    p += this.dataParam(ind);
    if (this.p.auth)
      p += `,\n${ind}auth=(${this.str(this.p.auth.user)}, ${this.str(this.p.auth.pass)})`;
    if (this.proxyUrl()) p += `,\n${ind}proxies=${this.str(this.proxyUrl())}`;
    if (this.p.insecure) p += `,\n${ind}verify=False`;
    if (this.p.timeout) p += `,\n${ind}timeout=${this.p.timeout}`;
    return p;
  }

  // ===== HTTPX ASYNC =====
  genHttpxAsync() {
    let c = this.o.includeImports ? "import asyncio\nimport httpx\n\n" : "";
    c += this.vars();

    const method = this.p.method.toLowerCase();
    const ind = this.i;

    if (this.o.wrapAsync) {
      c += "async def main():\n";
      if (this.o.addErrorHandling) {
        c += `${ind}try:\n`;
        c += `${ind}${ind}async with httpx.AsyncClient() as client:\n`;
        c += `${ind}${ind}${ind}response = await client.${method}(\n`;
        c += `${ind}${ind}${ind}${ind}${this.str(this.p.url)}`;
        c += this.httpxParams(ind.repeat(4));
        c += `\n${ind}${ind}${ind})\n`;
        c += `${ind}${ind}${ind}response.raise_for_status()\n`;
        c += `${ind}${ind}${ind}return response.json()\n`;
        c += `${ind}except httpx.HTTPError as e:\n`;
        c += `${ind}${ind}print(f"Error: {e}")\n`;
      } else {
        c += `${ind}async with httpx.AsyncClient() as client:\n`;
        c += `${ind}${ind}response = await client.${method}(\n`;
        c += `${ind}${ind}${ind}${this.str(this.p.url)}`;
        c += this.httpxParams(ind.repeat(3));
        c += `\n${ind}${ind})\n`;
        c += `${ind}${ind}return response.text\n`;
      }
      c += '\n\nif __name__ == "__main__":\n';
      c += `${ind}print(asyncio.run(main()))\n`;
    } else {
      c += "async with httpx.AsyncClient() as client:\n";
      c += `${ind}response = await client.${method}(\n`;
      c += `${ind}${ind}${this.str(this.p.url)}`;
      c += this.httpxParams(ind.repeat(2));
      c += `\n${ind})\n`;
      c += `${ind}print(response.text)\n`;
    }
    return c;
  }

  // ===== AIOHTTP =====
  genAiohttp() {
    let c = this.o.includeImports ? "import asyncio\nimport aiohttp\n\n" : "";
    c += this.vars();

    const method = this.p.method.toLowerCase();
    const ind = this.i;

    const sessionParams = [];
    if (this.p.auth) {
      sessionParams.push(
        `auth=aiohttp.BasicAuth(${this.str(this.p.auth.user)}, ${this.str(this.p.auth.pass)})`,
      );
    }
    if (this.p.timeout) {
      sessionParams.push(
        `timeout=aiohttp.ClientTimeout(total=${this.p.timeout})`,
      );
    }
    const sp = sessionParams.join(", ");

    if (this.o.wrapAsync) {
      c += "async def main():\n";
      if (this.o.addErrorHandling) {
        c += `${ind}try:\n`;
        c += `${ind}${ind}async with aiohttp.ClientSession(${sp}) as session:\n`;
        c += `${ind}${ind}${ind}async with session.${method}(\n`;
        c += `${ind}${ind}${ind}${ind}${this.str(this.p.url)}`;
        c += this.aiohttpParams(ind.repeat(4));
        c += `\n${ind}${ind}${ind}) as response:\n`;
        c += `${ind}${ind}${ind}${ind}response.raise_for_status()\n`;
        c += `${ind}${ind}${ind}${ind}return await response.json()\n`;
        c += `${ind}except aiohttp.ClientError as e:\n`;
        c += `${ind}${ind}print(f"Error: {e}")\n`;
      } else {
        c += `${ind}async with aiohttp.ClientSession(${sp}) as session:\n`;
        c += `${ind}${ind}async with session.${method}(\n`;
        c += `${ind}${ind}${ind}${this.str(this.p.url)}`;
        c += this.aiohttpParams(ind.repeat(3));
        c += `\n${ind}${ind}) as response:\n`;
        c += `${ind}${ind}${ind}return await response.text()\n`;
      }
      c += '\n\nif __name__ == "__main__":\n';
      c += `${ind}print(asyncio.run(main()))\n`;
    } else {
      c += `async with aiohttp.ClientSession(${sp}) as session:\n`;
      c += `${ind}async with session.${method}(\n`;
      c += `${ind}${ind}${this.str(this.p.url)}`;
      c += this.aiohttpParams(ind.repeat(2));
      c += `\n${ind}) as response:\n`;
      c += `${ind}${ind}print(await response.text())\n`;
    }
    return c;
  }

  aiohttpParams(ind) {
    let p = "";
    if (Object.keys(this.p.headers).length) p += `,\n${ind}headers=headers`;
    if (Object.keys(this.p.cookies).length) p += `,\n${ind}cookies=cookies`;
    p += this.dataParam(ind);
    if (this.proxyUrl()) p += `,\n${ind}proxy=${this.str(this.proxyUrl())}`;
    if (this.p.insecure) p += `,\n${ind}ssl=False`;
    return p;
  }
}

// ==================== UI ====================
class UI {
  constructor() {
    this.els = {
      input: document.getElementById("curl-input"),
      output: document.getElementById("python-output"),
      error: document.getElementById("error-message"),
      toast: document.getElementById("toast"),
      wrapAsyncOption: document.getElementById("wrap-async-option"),
    };

    this.examples = [
      `curl 'https://api.github.com/users/octocat' -H 'Accept: application/json'`,
      `curl -X POST 'https://httpbin.org/post' -H 'Content-Type: application/json' -d '{"name": "John"}'`,
      `curl 'https://api.example.com/data' -H 'Authorization: Bearer token123' -b 'session=abc'`,
      `curl -X PUT 'https://api.example.com/users/1' -u admin:pass -d '{"status": "active"}' -k`,
    ];
    this.exampleIdx = 0;
    this.debounceTimer = null;

    this.bind();
    this.updateUI();
  }

  bind() {
    // Auto-convert on input
    this.els.input.addEventListener("input", () => this.debounceConvert());

    // Library change
    document.querySelectorAll('input[name="library"]').forEach((el) => {
      el.addEventListener("change", () => {
        this.updateUI();
        this.convert();
      });
    });

    // Options change
    document.querySelectorAll(".option input").forEach((el) => {
      el.addEventListener("change", () => this.convert());
    });

    // Buttons
    document
      .getElementById("paste-btn")
      .addEventListener("click", () => this.paste());
    document
      .getElementById("clear-btn")
      .addEventListener("click", () => this.clear());
    document
      .getElementById("example-btn")
      .addEventListener("click", () => this.loadExample());
    document
      .getElementById("copy-btn")
      .addEventListener("click", () => this.copy());
    document
      .getElementById("download-btn")
      .addEventListener("click", () => this.download());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (
        e.ctrlKey &&
        e.key === "v" &&
        document.activeElement !== this.els.input
      ) {
        this.paste();
      }
    });

    document.getElementById("lang-toggle").addEventListener("click", () => {
      i18n.toggle();
    });
  }

  debounceConvert() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.convert(), 150);
  }

  getLibrary() {
    return document.querySelector('input[name="library"]:checked').value;
  }

  getOptions() {
    return {
      library: this.getLibrary(),
      includeImports: document.getElementById("include-imports").checked,
      wrapAsync: document.getElementById("wrap-async").checked,
      addErrorHandling: document.getElementById("add-error-handling").checked,
      useSession: document.getElementById("use-session").checked,
    };
  }

  updateUI() {
    const lib = this.getLibrary();
    const isAsync = lib === "httpx_async" || lib === "aiohttp";

    if (isAsync) {
      this.els.wrapAsyncOption.classList.remove("disabled");
      document.getElementById("wrap-async").disabled = false;
    } else {
      this.els.wrapAsyncOption.classList.add("disabled");
      document.getElementById("wrap-async").disabled = true;
    }
  }

  convert() {
    const curl = this.els.input.value.trim();

    if (!curl) {
      this.els.output.textContent = "";
      this.hideError();
      return;
    }

    try {
      const parsed = new CurlParser(curl);
      const code = new CodeGenerator(parsed, this.getOptions()).generate();

      this.els.output.textContent = code;
      this.hideError();
      this.els.output.removeAttribute("data-highlighted");
      hljs.highlightElement(this.els.output);
    } catch (e) {
      this.showError(e.message);
      this.els.output.textContent = "";
    }
  }

  async paste() {
    try {
      const text = await navigator.clipboard.readText();
      this.els.input.value = text;
      this.convert();
      this.els.input.focus();
    } catch {
      this.toast(i18n.get("noAccess"));
    }
  }

  clear() {
    this.els.input.value = "";
    this.els.output.textContent = "";
    this.hideError();
    this.els.input.focus();
  }

  loadExample() {
    this.els.input.value = this.examples[this.exampleIdx];
    this.exampleIdx = (this.exampleIdx + 1) % this.examples.length;
    this.convert();
  }

  async copy() {
    const code = this.els.output.textContent;
    if (!code) {
      this.toast(i18n.get("nothingToCopy"));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      this.toast(i18n.get("copied"));
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      this.toast(i18n.get("copied"));
    }
  }

  download() {
    const code = this.els.output.textContent;
    if (!code) {
      this.toast(i18n.get("nothingToDownload"));
      return;
    }
    const lib = this.getLibrary().replace("_", "-");
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `request-${lib}.py`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast(i18n.get("saved"));
  }

  showError(msg) {
    this.els.error.textContent = msg;
    this.els.error.classList.remove("hidden");
  }

  hideError() {
    this.els.error.classList.add("hidden");
  }

  toast(msg) {
    this.els.toast.textContent = msg;
    this.els.toast.classList.add("show");
    setTimeout(() => this.els.toast.classList.remove("show"), 2000);
  }
}

// Init
document.addEventListener("DOMContentLoaded", () => new UI());
