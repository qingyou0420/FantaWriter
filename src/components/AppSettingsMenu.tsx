"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDesktop,
  isDesktopApp,
  type DesktopAppInfo,
  type UpdateCheckResult,
} from "@/lib/desktop";
import { useToast } from "@/components/Toast";
import {
  applyTheme,
  dispatchThemeChange,
  getStoredTheme,
  loadAppPrefs,
  saveAppPrefs,
  type AppTheme,
} from "@/lib/theme";
import { scheduleIdleWork } from "@/lib/schedule-idle";
import { downloadFullBackup, importFullBackup } from "@/lib/storage";

type Panel = "none" | "api" | "menu";

/**
 * 首页右上角：设置菜单收敛 API / 配色 / 更新；
 * 有可用更新时才在外侧显示一键更新按钮。
 */
export function AppSettingsMenu({
  hasKey,
  keyPrefix,
  usageHint,
  onImportClick,
  onImportFullBackup,
  onHasKeyChange,
}: {
  hasKey: boolean | null;
  keyPrefix: string;
  usageHint?: string;
  onImportClick: () => void;
  onImportFullBackup?: () => void;
  onHasKeyChange?: () => void;
}) {
  const toast = useToast();
  const desktop = isDesktopApp();
  const rootRef = useRef<HTMLDivElement>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);

  const [panel, setPanel] = useState<Panel>("none");
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme());
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [apiModel, setApiModel] = useState("deepseek-v4-pro");
  const [apiBaseURL, setApiBaseURL] = useState("https://api.deepseek.com");
  const [fineOpen, setFineOpen] = useState(false);
  const [fineApiKey, setFineApiKey] = useState("");
  const [fineModel, setFineModel] = useState("");
  const [fineBaseURL, setFineBaseURL] = useState("");
  const [fineHasKey, setFineHasKey] = useState(false);
  const [fineKeyPrefix, setFineKeyPrefix] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [apiSaving, setApiSaving] = useState(false);

  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [ghToken, setGhToken] = useState("");
  const [ghTokenSaved, setGhTokenSaved] = useState(false);
  const [ghTokenPrefix, setGhTokenPrefix] = useState("");
  const [ghTokenSaving, setGhTokenSaving] = useState(false);

  const silentCheck = useCallback(async () => {
    const bridge = getDesktop();
    if (!bridge) return;
    try {
      const info = await bridge.getAppInfo();
      setAppInfo(info);
      const r = await bridge.checkUpdate({ silent: true });
      setUpdate(r);
    } catch {
      /* ignore silent */
    }
  }, []);

  useEffect(() => {
    // 等首屏能点输入框之后再查更新，避免主进程扫盘卡住打字
    return scheduleIdleWork(() => {
      void silentCheck();
    });
  }, [silentCheck]);

  useEffect(() => {
    if (panel === "none") return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPanel("none");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel("none");
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  useEffect(() => {
    if (panel !== "menu" || !desktop) return;
    const bridge = getDesktop();
    if (!bridge?.getUpdateSettings) return;
    void bridge.getUpdateSettings().then((s) => {
      setGhTokenSaved(s.hasGithubToken);
      setGhTokenPrefix(s.tokenPrefix || "");
    });
  }, [panel, desktop]);

  useEffect(() => {
    if (panel !== "api") return;
    setConfigLoaded(false);
    (async () => {
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        if (!res.ok) return;
        if (data.env?.model) setApiModel(data.env.model);
        if (data.env?.baseURL) setApiBaseURL(data.env.baseURL);
        if (typeof data.env?.thinkingEnabled === "boolean") {
          setThinkingEnabled(data.env.thinkingEnabled);
        }
        if (data.env?.fineModel) setFineModel(data.env.fineModel);
        if (data.env?.fineBaseURL) setFineBaseURL(data.env.fineBaseURL);
        setFineHasKey(Boolean(data.env?.fineHasKey));
        setFineKeyPrefix(String(data.env?.fineKeyPrefix || ""));
        if (data.env?.fineConfigured || data.env?.fineHasKey || data.env?.fineModel) {
          setFineOpen(true);
        }
        setConfigLoaded(true);
      } catch {
        /* ignore */
      }
    })();
  }, [panel]);

  function setThemeMode(next: AppTheme) {
    setTheme(next);
    applyTheme(next);
    saveAppPrefs({ ...loadAppPrefs(), theme: next });
    dispatchThemeChange();
  }

  async function saveApi() {
    setApiSaving(true);
    try {
      const body: {
        apiKey?: string;
        model: string;
        baseURL: string;
        fineApiKey?: string;
        fineModel?: string;
        fineBaseURL?: string;
      } = {
        apiKey: apiKey.trim() || undefined,
        model: apiModel.trim() || "deepseek-v4-pro",
        baseURL: apiBaseURL.trim() || "https://api.deepseek.com",
        fineApiKey: fineApiKey.trim() || undefined,
      };
      // GET 失败时输入框是空的，空字符串会删掉已有 FINE_*，故不要带上
      if (configLoaded || fineModel.trim()) body.fineModel = fineModel.trim();
      if (configLoaded || fineBaseURL.trim()) body.fineBaseURL = fineBaseURL.trim();
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setApiKey("");
      setFineApiKey("");
      toast.success("API 已保存");
      onHasKeyChange?.();
      setPanel("menu");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setApiSaving(false);
    }
  }

  async function checkUpdate(manual = true) {
    const bridge = getDesktop();
    if (!bridge) {
      if (manual) toast.info("仅桌面版支持检查更新");
      return;
    }
    setUpdateBusy(true);
    try {
      const r = await bridge.checkUpdate();
      setUpdate(r);
      if (manual) {
        if (r.hasUpdate) toast.success(`发现 v${r.latest}`);
        else toast.info(r.message || "已是最新");
      }
    } catch (e) {
      if (manual) toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdateBusy(false);
    }
  }

  async function resolveInstallerPath(path?: string): Promise<string | null> {
    const bridge = getDesktop();
    if (!bridge) return null;
    if (path) return path;
    if (update?.installerPath) return update.installerPath;
    if (update?.downloadUrl || update?.assetApiUrl) {
      if (!bridge.downloadUpdate) {
        toast.warning("当前桌面版不支持云端下载，请升级后重试");
        return null;
      }
      toast.info("正在从 GitHub 下载安装包…");
      const d = await bridge.downloadUpdate({
        downloadUrl: update.downloadUrl,
        assetApiUrl: update.assetApiUrl,
        version: update.latest || undefined,
        sha256: update.sha256,
        sha256DownloadUrl: update.sha256DownloadUrl,
        sha256AssetApiUrl: update.sha256AssetApiUrl,
      });
      if (!d.ok || !d.path) {
        toast.error(d.message || "下载失败");
        return null;
      }
      setUpdate((prev) => (prev ? { ...prev, installerPath: d.path } : prev));
      return d.path;
    }
    return null;
  }

  async function installUpdate(path?: string) {
    const bridge = getDesktop();
    if (!bridge) {
      toast.warning("无可用安装包");
      return;
    }
    const remote = !path && !update?.installerPath && Boolean(update?.downloadUrl || update?.assetApiUrl);
    const confirmMsg = remote
      ? `从 GitHub 下载并安装 v${update?.latest}？应用将退出。`
      : `退出应用并安装？\n${path || update?.installerPath || ""}`;
    if (!confirm(confirmMsg)) return;
    setUpdateBusy(true);
    try {
      const installer = await resolveInstallerPath(path);
      if (!installer) {
        setUpdateBusy(false);
        if (!remote) toast.warning("无可用安装包");
        return;
      }
      const r = await bridge.installUpdate(installer);
      if (!r.ok) {
        toast.error(r.message);
        setUpdateBusy(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setUpdateBusy(false);
    }
  }

  async function saveGithubToken() {
    const bridge = getDesktop();
    if (!bridge?.setGithubUpdateToken) {
      toast.info("仅桌面版可保存更新令牌");
      return;
    }
    setGhTokenSaving(true);
    try {
      const r = await bridge.setGithubUpdateToken(ghToken.trim());
      if (!r.ok) throw new Error("保存失败");
      setGhTokenSaved(r.hasGithubToken);
      setGhTokenPrefix(ghToken.trim() ? ghToken.trim().slice(0, 4) : "");
      setGhToken("");
      toast.success(r.hasGithubToken ? "更新令牌已保存到本机" : "已清除更新令牌");
      await checkUpdate(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setGhTokenSaving(false);
    }
  }

  async function pickInstaller() {
    const bridge = getDesktop();
    if (!bridge) return;
    setUpdateBusy(true);
    try {
      const picked = await bridge.pickInstaller();
      if (!picked.ok || !picked.path) return;
      await installUpdate(picked.path);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdateBusy(false);
    }
  }

  const showUpdateBtn = Boolean(
    desktop &&
      update?.hasUpdate &&
      (update.installerPath || update.downloadUrl || update.assetApiUrl)
  );

  return (
    <div className="flex items-center gap-2" ref={rootRef}>
      {showUpdateBtn ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={updateBusy}
          onClick={() => void installUpdate()}
          title={update?.installerPath || update?.message}
        >
          {updateBusy ? (
            <>
              <span className="spinner" /> 安装中
            </>
          ) : (
            `更新到 v${update?.latest}`
          )}
        </button>
      ) : null}

      <div className="menu-wrap">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-expanded={panel !== "none"}
          onClick={() => setPanel((p) => (p === "none" ? "menu" : "none"))}
        >
          设置
          {hasKey === false ? (
            <span className="badge !ml-1">API</span>
          ) : null}
          ▾
        </button>

        {panel === "menu" ? (
          <div className="menu-dropdown menu-dropdown-wide">
            <div className="menu-section-label">配色</div>
            <div className="menu-row">
              <button
                type="button"
                className={`menu-chip ${theme === "dark" ? "on" : ""}`}
                onClick={() => setThemeMode("dark")}
              >
                深色
              </button>
              <button
                type="button"
                className={`menu-chip ${theme === "light" ? "on" : ""}`}
                onClick={() => setThemeMode("light")}
              >
                浅色
              </button>
            </div>

            <div className="menu-sep" />

            <button
              type="button"
              className="menu-item"
              onClick={() => setPanel("api")}
            >
              API 设置
              {hasKey === false ? (
                <span className="badge !ml-2">未配置</span>
              ) : keyPrefix ? (
                <span className="menu-item-meta">{keyPrefix}…</span>
              ) : null}
            </button>

            {desktop ? (
              <>
                <div className="menu-sep" />
                <div className="menu-section-label">
                  更新
                  <span className="menu-item-meta tabular-nums">
                    v{appInfo?.version || "…"}
                  </span>
                </div>
                <button
                  type="button"
                  className="menu-item"
                  disabled={updateBusy}
                  onClick={() => void checkUpdate(true)}
                >
                  {updateBusy ? "检查中…" : "检查更新"}
                </button>
                <button
                  type="button"
                  className="menu-item"
                  disabled={updateBusy}
                  onClick={() => void pickInstaller()}
                >
                  选择安装包…
                </button>
                <button
                  type="button"
                  className="menu-item"
                  disabled={updateBusy}
                  onClick={async () => {
                    const bridge = getDesktop();
                    if (!bridge) return;
                    const r = await bridge.openUpdateDir();
                    if (r.ok) toast.info(`更新目录：${r.path}`);
                    else toast.warning(r.message || "无法打开");
                  }}
                >
                  打开更新目录
                </button>
                <div className="field !mb-1 !mt-1 px-2">
                  <label className="field-label">
                    更新用 GitHub 令牌
                    {ghTokenSaved ? (
                      <span className="menu-item-meta">
                        已保存 {ghTokenPrefix ? `${ghTokenPrefix}…` : ""}
                      </span>
                    ) : null}
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={ghTokenSaved ? "留空再保存即清除" : "可选"}
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="menu-item"
                  disabled={ghTokenSaving || updateBusy}
                  onClick={() => void saveGithubToken()}
                >
                  {ghTokenSaving ? "保存令牌…" : "保存更新令牌"}
                </button>
                <div className="menu-footer-hint">
                  默认读本仓公开 GitHub Releases（qingyou0420/FantaWriter），无需令牌。令牌仅在需要时可选，只存本机，不进 git。
                </div>
                {update?.hasUpdate ? (
                  <button
                    type="button"
                    className="menu-item"
                    disabled={updateBusy}
                    onClick={() => void installUpdate()}
                  >
                    安装 v{update.latest}
                  </button>
                ) : update && !update.hasUpdate ? (
                  <div className="menu-footer-hint">
                    {update.message || "未发现更高版本安装包"}
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="menu-sep" />
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setPanel("none");
                onImportClick();
              }}
            >
              导入项目
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                downloadFullBackup();
                toast.success("已下载备份");
                setPanel("none");
              }}
            >
              下载完整备份
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                backupFileRef.current?.click();
              }}
            >
              导入完整备份…
            </button>
            <input
              ref={backupFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const result = importFullBackup(String(reader.result));
                    toast.success(
                      `已导入 ${result.imported} 个项目` +
                        (result.skipped ? `，跳过 ${result.skipped} 个已有` : "")
                    );
                    setPanel("none");
                    onImportFullBackup?.();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "导入备份失败"
                    );
                  }
                };
                reader.readAsText(f);
              }}
            />
            {usageHint ? (
              <div className="menu-footer-hint">{usageHint}</div>
            ) : null}
          </div>
        ) : null}

        {panel === "api" ? (
          <div className="menu-dropdown menu-dropdown-wide menu-dropdown-form">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-semibold">API 设置</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPanel("menu")}
              >
                返回
              </button>
            </div>
            <div className="field !mb-2">
              <label className="field-label">
                API Key{hasKey ? `（${keyPrefix}…，留空不改）` : ""}
              </label>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div className="field !mb-2">
              <label className="field-label">Base URL</label>
              <input
                value={apiBaseURL}
                onChange={(e) => setApiBaseURL(e.target.value)}
              />
            </div>
            <div className="field !mb-2">
              <label className="field-label">模型</label>
              <input
                list="model-presets"
                value={apiModel}
                onChange={(e) => setApiModel(e.target.value)}
              />
              <datalist id="model-presets">
                <option value="deepseek-v4-pro" />
                <option value="deepseek-v4-flash" />
                <option value="deepseek-chat" />
                <option value="gpt-4o-mini" />
              </datalist>
            </div>
            {thinkingEnabled != null ? (
              <p className="text-xs text-[var(--text-muted)] m-0 mb-2">
                推理开关 DEEPSEEK_THINKING：{thinkingEnabled ? "已开启" : "未开启"}
                （由环境变量控制）
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm w-full !justify-between mb-2"
              onClick={() => setFineOpen((v) => !v)}
            >
              <span>精写模型（可选）</span>
              <span>{fineOpen ? "▴" : "▾"}</span>
            </button>
            {fineOpen ? (
              <div className="mb-2">
                <p className="text-xs text-[var(--text-muted)] m-0 mb-2">
                  正文 / 续写 / 改写 / 按拍扩写走此档；未填则回落主力模型。摘要、大纲、检查等大宗任务仍走上面的主力档。
                </p>
                <div className="field !mb-2">
                  <label className="field-label">
                    精写 API Key
                    {fineHasKey ? `（${fineKeyPrefix}…，留空不改）` : ""}
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={fineApiKey}
                    onChange={(e) => setFineApiKey(e.target.value)}
                    placeholder="FINE_API_KEY"
                  />
                </div>
                <div className="field !mb-2">
                  <label className="field-label">精写 Base URL</label>
                  <input
                    value={fineBaseURL}
                    onChange={(e) => setFineBaseURL(e.target.value)}
                    placeholder="FINE_BASE_URL"
                  />
                </div>
                <div className="field !mb-2">
                  <label className="field-label">精写模型</label>
                  <input
                    value={fineModel}
                    onChange={(e) => setFineModel(e.target.value)}
                    placeholder="FINE_MODEL"
                  />
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-sm w-full"
              disabled={apiSaving}
              onClick={() => void saveApi()}
            >
              {apiSaving ? "保存中…" : "保存"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
