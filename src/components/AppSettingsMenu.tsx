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
import { downloadFullBackup } from "@/lib/storage";

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
  onHasKeyChange,
}: {
  hasKey: boolean | null;
  keyPrefix: string;
  usageHint?: string;
  onImportClick: () => void;
  onHasKeyChange?: () => void;
}) {
  const toast = useToast();
  const desktop = isDesktopApp();
  const rootRef = useRef<HTMLDivElement>(null);

  const [panel, setPanel] = useState<Panel>("none");
  const [theme, setTheme] = useState<AppTheme>("dark");

  const [apiKey, setApiKey] = useState("");
  const [apiModel, setApiModel] = useState("deepseek-v4-pro");
  const [apiBaseURL, setApiBaseURL] = useState("https://api.deepseek.com");
  const [apiSaving, setApiSaving] = useState(false);

  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const silentCheck = useCallback(async () => {
    const bridge = getDesktop();
    if (!bridge) return;
    try {
      const info = await bridge.getAppInfo();
      setAppInfo(info);
      const r = await bridge.checkUpdate();
      setUpdate(r);
    } catch {
      /* ignore silent */
    }
  }, []);

  useEffect(() => {
    void silentCheck();
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
    if (panel !== "api") return;
    (async () => {
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        if (data.env?.model) setApiModel(data.env.model);
        if (data.env?.baseURL) setApiBaseURL(data.env.baseURL);
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
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          model: apiModel.trim() || "deepseek-v4-pro",
          baseURL: apiBaseURL.trim() || "https://api.deepseek.com",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setApiKey("");
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

  async function installUpdate(path?: string) {
    const bridge = getDesktop();
    const installer = path || update?.installerPath;
    if (!bridge || !installer) {
      toast.warning("无可用安装包");
      return;
    }
    if (!confirm(`退出应用并安装？\n${installer}`)) return;
    setUpdateBusy(true);
    try {
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
    desktop && update?.hasUpdate && update.installerPath
  );

  return (
    <div className="flex items-center gap-2" ref={rootRef}>
      {showUpdateBtn ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={updateBusy}
          onClick={() => void installUpdate()}
          title={update?.installerPath}
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
