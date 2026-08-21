/**
 * Electron 主进程：启动内嵌 Next.js 服务并打开窗口；一键更新检测
 */
const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.ENS_PORT || 17831);
const HOST = "127.0.0.1";
const { versionFromSetupName } = require("./setup-artifact.cjs");
const {
  DEFAULT_GITHUB_REPO,
  githubLatestApiUrl,
  githubApiHeaders,
  githubAssetHeaders,
  isGithubApiHost,
  isAllowedDownloadUrl,
  parseGithubLatestRelease,
  setupFileNameFromUrl,
  githubCheckErrorMessage,
} = require("./github-release.cjs");

const GITHUB_UPDATE_TOKEN_KEY = "GITHUB_UPDATE_TOKEN";

/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
let quitting = false;
/** @type {string[]} */
const serverLog = [];

function isDev() {
  return !app.isPackaged;
}

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.env");
}

function getLogPath() {
  return path.join(app.getPath("userData"), "server.log");
}

function appendLog(line) {
  const text = `[${new Date().toISOString()}] ${line}`;
  serverLog.push(text);
  if (serverLog.length > 500) serverLog.shift();
  try {
    fs.appendFileSync(getLogPath(), text + "\n", "utf8");
  } catch {
    /* ignore */
  }
  console.log(line);
}

function applyConfigFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch (e) {
    appendLog("读取配置失败: " + e);
  }
}

function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      if (serverProcess && serverProcess.exitCode !== null) {
        reject(
          new Error(
            `内嵌服务提前退出（代码 ${serverProcess.exitCode}）。\n日志：${getLogPath()}`
          )
        );
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(
            new Error(
              `等待本地服务超时：${url}\n日志：${getLogPath()}\n最近输出：\n${serverLog.slice(-20).join("\n")}`
            )
          );
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function getStandaloneDir() {
  return path.join(process.resourcesPath, "standalone");
}

function startProductionServer() {
  const standaloneDir = getStandaloneDir();
  const serverJs = path.join(standaloneDir, "server.js");
  const nextModule = path.join(standaloneDir, "node_modules", "next");

  appendLog(`standaloneDir=${standaloneDir}`);
  appendLog(`server.js exists=${fs.existsSync(serverJs)}`);
  appendLog(`next module exists=${fs.existsSync(nextModule)}`);

  if (!fs.existsSync(serverJs)) {
    throw new Error(`找不到服务入口：${serverJs}`);
  }
  if (!fs.existsSync(nextModule)) {
    throw new Error(
      `缺少 next 模块：${nextModule}\n安装包可能不完整，请重新执行 npm run dist:win 打包。`
    );
  }

  try {
    fs.writeFileSync(getLogPath(), "", "utf8");
  } catch {
    /* ignore */
  }

  applyConfigFile(getConfigPath());
  applyConfigFile(path.join(path.dirname(app.getPath("exe")), "config.env"));

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: HOST,
    APP_CONFIG_PATH: getConfigPath(),
  };

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: standaloneDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout?.on("data", (d) => {
    appendLog(`[stdout] ${d.toString().trim()}`);
  });
  serverProcess.stderr?.on("data", (d) => {
    appendLog(`[stderr] ${d.toString().trim()}`);
  });
  serverProcess.on("exit", (code, signal) => {
    appendLog(`Next server exited code=${code} signal=${signal}`);
    serverProcess = null;
    if (!quitting && code && code !== 0) {
      const tail = serverLog.slice(-30).join("\n");
      dialog.showErrorBox(
        "内嵌服务已退出",
        `退出代码：${code}\n\n常见原因：安装包缺少 node_modules（请用新版安装包重装）。\n\n日志文件：\n${getLogPath()}\n\n最近日志：\n${tail}`
      );
    }
  });

  return `http://${HOST}:${PORT}`;
}

async function resolveAppUrl() {
  if (isDev()) {
    const devUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
    process.env.APP_CONFIG_PATH = getConfigPath();
    applyConfigFile(getConfigPath());
    await waitForServer(devUrl, 120000);
    return devUrl;
  }
  const url = startProductionServer();
  await waitForServer(url, 90000);
  return url;
}

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: "Fantasy Writer",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(appUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    try {
      if (process.platform === "win32" && serverProcess.pid) {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], {
          windowsHide: true,
        });
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
    serverProcess = null;
  }
}

/* ───────── 版本 / 更新 ───────── */

function parseSemver(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareVersions(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}



function getPrimaryUpdateDir() {
  if (process.env.UPDATE_DIR && process.env.UPDATE_DIR.trim()) {
    return process.env.UPDATE_DIR.trim();
  }
  return path.join(path.dirname(app.getPath("exe")), "updates");
}

function getUpdateSearchDirs() {
  const dirs = [];
  const push = (d) => {
    if (d && !dirs.includes(d)) dirs.push(d);
  };
  push(process.env.UPDATE_DIR?.trim());
  // 安装目录旁 updates（优先）
  push(path.join(path.dirname(app.getPath("exe")), "updates"));
  // Electron userData/updates（publish-update 脚本会写这里）
  push(path.join(app.getPath("userData"), "updates"));
  // 桌面固定文件夹（publish-update 脚本会写这里）
  try {
    push(path.join(app.getPath("desktop"), "H-NoveList-Updates"));
    push(path.join(app.getPath("desktop"), "Fantasy-Writer-Updates"));
  } catch {
    /* ignore */
  }
  // 桌面根目录（用户直接把 Setup 扔桌面）
  try {
    push(app.getPath("desktop"));
  } catch {
    /* ignore */
  }
  try {
    push(app.getPath("downloads"));
  } catch {
    /* ignore */
  }
  try {
    push(app.getPath("documents"));
  } catch {
    /* ignore */
  }
  // 开发态 / 本机源码旁的打包输出（仅未打包时 cwd 才是项目目录）
  if (!app.isPackaged) {
    push(path.join(process.cwd(), "dist-installer"));
  }
  // 安装包旁（有人把 Setup 与 exe 放同级）
  push(path.dirname(app.getPath("exe")));
  return dirs.filter(Boolean);
}

function scanInstallersInDir(dir) {
  /** @type {{ path: string, version: string, mtime: number }[]} */
  const found = [];
  if (!dir || !fs.existsSync(dir)) return found;
  let st;
  try {
    st = fs.statSync(dir);
  } catch {
    return found;
  }
  if (!st.isDirectory()) return found;
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return found;
  }
  for (const name of names) {
    const ver = versionFromSetupName(name);
    if (!ver) continue;
    const full = path.join(dir, name);
    try {
      const s = fs.statSync(full);
      if (!s.isFile()) continue;
      found.push({ path: full, version: ver, mtime: s.mtimeMs });
    } catch {
      /* ignore */
    }
  }
  return found;
}

function findLatestInstaller(currentVersion) {
  const searched = getUpdateSearchDirs();
  /** @type {{ path: string, version: string, mtime: number, source: string }[]} */
  const all = [];
  for (const dir of searched) {
    for (const item of scanInstallersInDir(dir)) {
      all.push({ ...item, source: dir });
    }
  }
  // 仅保留比当前新的；若没有则仍返回目录内最新供提示
  const newer = all.filter((x) => compareVersions(x.version, currentVersion) > 0);
  const pool = newer.length ? newer : all;
  pool.sort((a, b) => {
    const c = compareVersions(b.version, a.version);
    if (c !== 0) return c;
    return b.mtime - a.mtime;
  });
  return { candidates: pool, searchedDirs: searched, allCount: all.length };
}

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
}

function readConfigMap(filePath) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!filePath || !fs.existsSync(filePath)) return map;
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
    }
  } catch {
    /* ignore */
  }
  return map;
}

function writeConfigMap(filePath, map) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const lines = [
    "# Fantasy Writer · 本机配置（由应用写入，请勿分享）",
    ...[...map.entries()].map(([k, v]) => `${k}=${v}`),
    "",
  ];
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

function getGithubUpdateToken() {
  applyConfigFile(getConfigPath());
  return (
    process.env.GITHUB_UPDATE_TOKEN ||
    process.env.UPDATE_GITHUB_TOKEN ||
    ""
  ).trim();
}

function setGithubUpdateToken(token) {
  const filePath = getConfigPath();
  const map = readConfigMap(filePath);
  const t = String(token || "").trim();
  if (t) {
    map.set(GITHUB_UPDATE_TOKEN_KEY, t);
    process.env.GITHUB_UPDATE_TOKEN = t;
  } else {
    map.delete(GITHUB_UPDATE_TOKEN_KEY);
    delete process.env.GITHUB_UPDATE_TOKEN;
  }
  writeConfigMap(filePath, map);
}

function getGithubUpdateRepo() {
  applyConfigFile(getConfigPath());
  return (process.env.UPDATE_GITHUB_REPO || DEFAULT_GITHUB_REPO).trim();
}

function isAllowedFeedDownloadUrl(url) {
  if (isAllowedDownloadUrl(url)) return true;
  const feed = process.env.UPDATE_FEED_URL?.trim();
  if (!feed) return false;
  try {
    const feedHost = new URL(feed).hostname.toLowerCase();
    const u = new URL(String(url || ""));
    return u.protocol === "https:" && u.hostname.toLowerCase() === feedHost;
  } catch {
    return false;
  }
}

function registerIpc() {
  ipcMain.handle("app:getInfo", () => {
    applyConfigFile(getConfigPath());
    return {
      version: app.getVersion(),
      isDesktop: true,
      isPackaged: app.isPackaged,
      platform: process.platform,
      updateDir: getPrimaryUpdateDir(),
      exeDir: path.dirname(app.getPath("exe")),
    };
  });

  ipcMain.handle("app:getUpdateSettings", () => {
    applyConfigFile(getConfigPath());
    const token = getGithubUpdateToken();
    return {
      hasGithubToken: Boolean(token),
      tokenPrefix: token ? token.slice(0, 4) : "",
      repo: getGithubUpdateRepo(),
    };
  });

  ipcMain.handle("app:setGithubUpdateToken", (_e, token) => {
    const t = String(token || "").trim();
    setGithubUpdateToken(t);
    appendLog(
      t
        ? "已保存更新用 GitHub 令牌（本机 config.env）"
        : "已清除更新用 GitHub 令牌"
    );
    return { ok: true, hasGithubToken: Boolean(t) };
  });

  ipcMain.handle("app:checkUpdate", async () => {
    applyConfigFile(getConfigPath());
    const current = app.getVersion();

    // 可选远程 feed：UPDATE_FEED_URL → JSON { version, url }
    const feed = process.env.UPDATE_FEED_URL?.trim();
    if (feed) {
      try {
        const data = await fetchJson(feed);
        const latest = String(data.version || data.latest || "").replace(/^v/i, "");
        const downloadUrl = String(data.url || data.downloadUrl || "");
        if (latest && parseSemver(latest)) {
          const hasUpdate = compareVersions(latest, current) > 0;
          return {
            ok: true,
            current,
            latest,
            hasUpdate,
            downloadUrl: downloadUrl || undefined,
            source: feed,
            message: hasUpdate
              ? `远程源发现新版本 ${latest}（当前 ${current}）`
              : `已是最新（远程 ${latest}）`,
          };
        }
      } catch (e) {
        appendLog("UPDATE_FEED 失败: " + e);
      }
    }

    // 默认：GitHub Releases latest
    let githubHint = "";
    try {
      const remote = await checkGithubLatest(current);
      return remote;
    } catch (e) {
      appendLog("GitHub latest 失败: " + e);
      githubHint = githubCheckErrorMessage(e);
    }

    const { candidates, searchedDirs, allCount } = findLatestInstaller(current);
    const hint = githubHint ? `${githubHint}。已回退本地目录。` : "";
    if (!candidates.length) {
      return {
        ok: true,
        current,
        latest: null,
        hasUpdate: false,
        message:
          (hint ? hint + " " : "") +
          `未找到安装包。请将 Fantasy-Writer-Setup-x.y.z.exe 或 H-NoveList-Setup-x.y.z.exe 放入更新目录后重试。主目录：${getPrimaryUpdateDir()}`,
        searchedDirs,
      };
    }
    const best = candidates[0];
    const hasUpdate = compareVersions(best.version, current) > 0;
    return {
      ok: true,
      current,
      latest: best.version,
      hasUpdate,
      installerPath: best.path,
      source: best.source,
      message: hasUpdate
        ? `${hint}发现新版本 ${best.version}（当前 ${current}），可一键安装`
        : allCount
          ? `${hint}本地最新安装包为 ${best.version}，不高于当前 ${current}`
          : `${hint}未发现可用更新`,
      searchedDirs,
    };
  });

  ipcMain.handle("app:downloadUpdate", async (_e, payload) => {
    applyConfigFile(getConfigPath());
    const opts =
      payload && typeof payload === "object" ? payload : { downloadUrl: payload };
    const token = getGithubUpdateToken();
    const assetApiUrl = String(opts.assetApiUrl || "").trim();
    const downloadUrl = String(opts.downloadUrl || "").trim();
    const preferApi = Boolean(token && assetApiUrl);
    const url = preferApi ? assetApiUrl : downloadUrl;
    if (!url) {
      return { ok: false, message: "没有可下载的安装包地址" };
    }
    if (!isAllowedFeedDownloadUrl(url)) {
      return { ok: false, message: "拒绝从非 GitHub 地址下载安装包" };
    }
    const fileName =
      setupFileNameFromUrl(downloadUrl) ||
      setupFileNameFromUrl(url) ||
      (opts.version && parseSemver(String(opts.version))
        ? `Fantasy-Writer-Setup-${String(opts.version).replace(/^v/i, "")}.exe`
        : null);
    if (!fileName || !versionFromSetupName(fileName)) {
      return { ok: false, message: "安装包文件名不符合 Fantasy-Writer-Setup-x.y.z.exe" };
    }
    const destDir = path.join(app.getPath("temp"), "Fantasy-Writer-Updates");
    ensureDir(destDir);
    const dest = path.join(destDir, fileName);
    try {
      appendLog(`下载安装包: ${preferApi ? "GitHub asset API" : "browser_download_url"} → ${fileName}`);
      await downloadFile(url, dest, githubAssetHeaders(token));
      if (!fs.existsSync(dest)) {
        return { ok: false, message: "下载完成但文件不存在" };
      }
      return {
        ok: true,
        path: dest,
        version: versionFromSetupName(fileName) || undefined,
        message: `已下载到 ${dest}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog("下载安装包失败: " + msg);
      return { ok: false, message: `下载失败：${msg}` };
    }
  });

  ipcMain.handle("app:installUpdate", async (_e, installerPath) => {
    const target = String(installerPath || "");
    if (!target || !fs.existsSync(target)) {
      return { ok: false, message: "安装包不存在" };
    }
    if (!/\.exe$/i.test(target)) {
      return { ok: false, message: "仅支持 .exe 安装包" };
    }
    try {
      appendLog(`启动安装包: ${target}`);
      // 优先 shell.openPath：更好触发 UAC / 关联启动
      const openErr = await shell.openPath(target);
      if (openErr) {
        // 回退 spawn
        const child = spawn(target, [], {
          detached: true,
          stdio: "ignore",
          windowsHide: false,
          shell: true,
        });
        child.unref();
        appendLog(`openPath 失败(${openErr})，已 spawn 回退`);
      }
      setTimeout(() => {
        quitting = true;
        stopServer();
        app.quit();
      }, 800);
      return { ok: true, message: "正在启动安装程序并退出…" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  });

  ipcMain.handle("app:pickInstaller", async () => {
    const win = mainWindow || undefined;
    const res = await dialog.showOpenDialog(win, {
      title: "选择 Fantasy Writer 安装包",
      filters: [{ name: "安装程序", extensions: ["exe"] }],
      properties: ["openFile"],
      defaultPath: getPrimaryUpdateDir(),
    });
    if (res.canceled || !res.filePaths?.[0]) {
      return { ok: false, message: "已取消" };
    }
    const p = res.filePaths[0];
    const version = versionFromSetupName(path.basename(p)) || undefined;
    return { ok: true, path: p, version, message: "已选择" };
  });

  ipcMain.handle("app:openPath", async (_e, target) => {
    const t = String(target || "");
    if (!t) return { ok: false, message: "路径为空" };
    const err = await shell.openPath(t);
    if (err) return { ok: false, message: err };
    return { ok: true };
  });

  ipcMain.handle("app:openUpdateDir", async () => {
    const dir = getPrimaryUpdateDir();
    ensureDir(dir);
    const err = await shell.openPath(dir);
    if (err) return { ok: false, path: dir, message: err };
    return { ok: true, path: dir };
  });

  ipcMain.handle("fs:getSuggestedExportRoot", () => {
    if (!app.isPackaged) {
      return { ok: true, path: process.cwd() };
    }
    try {
      return {
        ok: true,
        path: path.join(app.getPath("documents"), "Fantasy Writer"),
      };
    } catch {
      return { ok: true, path: path.dirname(app.getPath("exe")) };
    }
  });

  ipcMain.handle("fs:pickDirectory", async (_e, opts) => {
    const win = mainWindow || undefined;
    const res = await dialog.showOpenDialog(win, {
      title: (opts && opts.title) || "选择章节 Markdown 写入目录",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: opts && opts.defaultPath ? String(opts.defaultPath) : undefined,
    });
    if (res.canceled || !res.filePaths?.[0]) {
      return { ok: false, canceled: true, message: "已取消" };
    }
    return { ok: true, path: res.filePaths[0], message: "已选择" };
  });

  ipcMain.handle("fs:writeTextFiles", async (_e, payload) => {
    const root = String((payload && payload.root) || "").trim();
    const files = Array.isArray(payload && payload.files) ? payload.files : [];
    if (!root) return { ok: false, written: [], message: "导出根目录为空" };
    if (!files.length) return { ok: false, written: [], message: "没有要写入的文件" };

    let rootAbs;
    try {
      rootAbs = path.resolve(root);
    } catch {
      return { ok: false, written: [], message: "根目录无效" };
    }
    const rootPrefix = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
    const written = [];

    try {
      ensureDir(rootAbs);
      for (const item of files) {
        const rel = String((item && item.relativePath) || "").replace(/\\/g, "/");
        if (!rel || rel.startsWith("/") || /^[a-zA-Z]:/.test(rel)) {
          return { ok: false, written, message: "相对路径非法" };
        }
        const parts = rel.split("/").filter(Boolean);
        if (!parts.length || parts.some((p) => p === ".." || p === ".")) {
          return { ok: false, written, message: "相对路径含越界片段" };
        }
        const target = path.resolve(rootAbs, ...parts);
        if (target !== rootAbs && !target.startsWith(rootPrefix)) {
          return { ok: false, written, message: "拒绝写出根目录之外" };
        }
        ensureDir(path.dirname(target));
        fs.writeFileSync(target, String((item && item.content) || ""), "utf8");
        written.push(target);
      }
      return { ok: true, written, message: `已写入 ${written.length} 个文件` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, written, message: msg };
    }
  });
}

function stripAuthIfLeavingGithub(headers, hostname) {
  /** @type {Record<string, string>} */
  const next = { ...headers };
  if (!isGithubApiHost(hostname)) {
    delete next.Authorization;
    delete next.authorization;
  }
  return next;
}

/**
 * GET，跟随重定向；离开 GitHub 时去掉 Authorization，避免把令牌带到 CDN。
 * @returns {Promise<import('http').IncomingMessage>}
 */
function httpGet(url, options = {}) {
  const headers = options.headers || {};
  const timeout = options.timeout || 20000;
  const maxRedirects = options.maxRedirects ?? 5;
  return new Promise((resolve, reject) => {
    const go = (current, left) => {
      let u;
      try {
        u = new URL(current);
      } catch (e) {
        reject(e);
        return;
      }
      const lib = u.protocol === "https:" ? require("https") : http;
      const reqHeaders = stripAuthIfLeavingGithub(headers, u.hostname);
      const req = lib.get(current, { headers: reqHeaders, timeout }, (res) => {
        const code = res.statusCode || 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          if (left <= 0) {
            reject(new Error("重定向过多"));
            return;
          }
          go(new URL(res.headers.location, current).toString(), left - 1);
          return;
        }
        if (code >= 400) {
          res.resume();
          reject(new Error(`HTTP ${code}`));
          return;
        }
        resolve(res);
      });
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("请求超时"));
      });
    };
    go(String(url), maxRedirects);
  });
}

function fetchJson(url, headers) {
  return httpGet(url, { headers: headers || {}, timeout: 15000 }).then(
    (res) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      })
  );
}

function downloadFile(url, dest, headers) {
  return httpGet(url, { headers: headers || {}, timeout: 60000 }).then(
    (res) =>
      new Promise((resolve, reject) => {
        const tmp = dest + ".part";
        try {
          if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
        const ws = fs.createWriteStream(tmp);
        res.pipe(ws);
        ws.on("finish", () => {
          try {
            fs.renameSync(tmp, dest);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        ws.on("error", reject);
        res.on("error", reject);
      })
  );
}

async function checkGithubLatest(current) {
  const repo = getGithubUpdateRepo();
  const token = getGithubUpdateToken();
  const url = githubLatestApiUrl(repo);
  appendLog(
    `检查 GitHub latest: ${repo} token=${token ? "yes" : "no"}`
  );
  const data = await fetchJson(url, githubApiHeaders(token));
  const parsed = parseGithubLatestRelease(data);
  if (!parsed) {
    throw new Error("latest release 没有 Fantasy-Writer-Setup / H-NoveList-Setup 安装包");
  }
  const hasUpdate = compareVersions(parsed.version, current) > 0;
  return {
    ok: true,
    current,
    latest: parsed.version,
    hasUpdate,
    downloadUrl: parsed.downloadUrl || undefined,
    assetApiUrl: parsed.assetApiUrl || undefined,
    source: `github:${repo}`,
    message: hasUpdate
      ? `GitHub 发现新版本 ${parsed.version}（当前 ${current}）`
      : `已是最新（GitHub ${parsed.version}）`,
  };
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    appendLog(`userData=${app.getPath("userData")}`);
    registerIpc();
    try {
      const url = await resolveAppUrl();
      createWindow(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      dialog.showErrorBox("启动失败", msg + `\n\n日志：${getLogPath()}`);
      app.quit();
    }
  });

  app.on("before-quit", () => {
    quitting = true;
    stopServer();
  });

  app.on("window-all-closed", () => {
    quitting = true;
    stopServer();
    app.quit();
  });
}
