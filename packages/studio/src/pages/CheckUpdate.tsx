import { useEffect, useState } from "react";
import { RefreshCw, Download, RotateCcw, Loader2 } from "lucide-react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import {
  getDesktopBridge,
  updateActionsFromCheck,
  type CheckUpdateResult,
  type DesktopAppInfo,
} from "../lib/desktop-bridge";

interface Nav {
  toDashboard: () => void;
}

export function CheckUpdate({ nav, theme, t }: { nav: Nav; theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const bridge = getDesktopBridge();
  const [info, setInfo] = useState<DesktopAppInfo | null>(null);
  const [busy, setBusy] = useState<"check" | "download" | "install" | null>(null);
  const [result, setResult] = useState<CheckUpdateResult | null>(null);
  const [installerPath, setInstallerPath] = useState("");
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"ok" | "err" | "info">("info");

  useEffect(() => {
    if (!bridge) return;
    void bridge.getAppInfo?.().then((next) => setInfo(next)).catch(() => undefined);
  }, [bridge]);

  const actions = updateActionsFromCheck(result);
  const canInstall = Boolean(installerPath || actions.canInstall);

  const show = (text: string, next: "ok" | "err" | "info") => {
    setNote(text);
    setTone(next);
  };

  const handleCheck = async () => {
    if (!bridge) return;
    setBusy("check");
    show(t("update.checking"), "info");
    try {
      const next = await bridge.checkUpdate();
      setResult(next);
      const nextPath = String(next.installerPath || "").trim();
      setInstallerPath(nextPath);
      if (next.hasUpdate) {
        show(next.message || `${t("update.found")} ${next.latest || ""}`, "ok");
      } else {
        show(next.message || t("update.latest"), "ok");
      }
    } catch (error) {
      show(error instanceof Error ? error.message : String(error), "err");
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (!bridge || !result) return;
    setBusy("download");
    show(t("update.downloading"), "info");
    try {
      const next = await bridge.downloadUpdate({
        downloadUrl: result.downloadUrl,
        assetApiUrl: result.assetApiUrl,
        version: result.latest || undefined,
      });
      if (!next.ok) {
        show(next.message || t("update.downloadFailed"), "err");
        return;
      }
      if (next.path) setInstallerPath(next.path);
      show(t("update.downloaded"), "ok");
    } catch (error) {
      show(error instanceof Error ? error.message : String(error), "err");
    } finally {
      setBusy(null);
    }
  };

  const handleInstall = async () => {
    if (!bridge) return;
    const target = installerPath || actions.installerPath;
    if (!target) return;
    setBusy("install");
    show(t("update.installing"), "info");
    try {
      const next = await bridge.installUpdate(target);
      if (!next.ok) {
        show(next.message || t("update.installFailed"), "err");
      }
    } catch (error) {
      show(error instanceof Error ? error.message : String(error), "err");
    } finally {
      setBusy(null);
    }
  };

  const handlePick = async () => {
    if (!bridge?.pickInstaller) return;
    const picked = await bridge.pickInstaller();
    if (picked.ok && picked.path) {
      setInstallerPath(picked.path);
      show(`${t("update.picked")} ${picked.version || picked.path}`, "ok");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={nav.toDashboard} className={c.link}>{t("bread.home")}</button>
        <span className="text-border">/</span>
        <span className="text-foreground">{t("nav.checkUpdate")}</span>
      </div>

      <div>
        <h1 className="font-serif text-3xl flex items-center gap-3">
          <RefreshCw size={28} className="text-primary" />
          {t("update.title")}
        </h1>
      </div>

      {!bridge ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${c.error}`}>
          {t("update.noDesktop")}
        </div>
      ) : (
        <div className={`border ${c.cardStatic} rounded-lg p-5 space-y-5`}>
          <div className="grid gap-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("update.current")}</span>
              <span className="font-mono">{info?.version || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("update.latestLabel")}</span>
              <span className="font-mono">{result?.latest || "—"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="check-update"
              disabled={busy !== null}
              onClick={() => void handleCheck()}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg ${c.btnPrimary} disabled:opacity-50`}
            >
              {busy === "check" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {busy === "check" ? t("update.checking") : t("update.check")}
            </button>
            <button
              type="button"
              data-testid="download-update"
              disabled={busy !== null || !actions.canDownload}
              onClick={() => void handleDownload()}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg ${c.btnSecondary} disabled:opacity-50`}
            >
              {busy === "download" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {busy === "download" ? t("update.downloading") : t("update.download")}
            </button>
            <button
              type="button"
              data-testid="install-update"
              disabled={busy !== null || !canInstall}
              onClick={() => void handleInstall()}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg ${c.btnSuccess} disabled:opacity-50`}
            >
              {busy === "install" ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              {busy === "install" ? t("update.installing") : t("update.install")}
            </button>
          </div>

          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void handlePick()}
          >
            {t("update.pick")}
          </button>
        </div>
      )}

      {note && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          tone === "err" ? "bg-destructive/10 text-destructive"
            : tone === "ok" ? "bg-emerald-500/10 text-emerald-600"
              : "bg-primary/8 text-primary"
        }`}>
          {note}
        </div>
      )}
    </div>
  );
}
