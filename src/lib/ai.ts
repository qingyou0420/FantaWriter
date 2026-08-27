import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import OpenAI from "openai";
import { UserFacingError } from "./user-error";
import { CONFIG_FILE_HEADER } from "./brand";

function parseEnvText(text: string, forceDeepseek = false) {
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
    const managed =
      key.startsWith("DEEPSEEK_") || key.startsWith("FINE_");
    if (
      forceDeepseek ||
      managed ||
      process.env[key] === undefined ||
      process.env[key] === ""
    ) {
      if (forceDeepseek && managed) {
        process.env[key] = value;
      } else if (!forceDeepseek) {
        if (
          managed ||
          process.env[key] === undefined ||
          process.env[key] === ""
        ) {
          process.env[key] = value;
        }
      } else {
        process.env[key] = value;
      }
    }
  }
}

/** 强制从配置文件 / 项目目录读取环境变量 */
function loadEnvFile() {
  // turbopackIgnore：避免 Next 把整个项目目录打进 standalone
  const cwd = /* turbopackIgnore: true */ process.cwd();
  const candidates = [
    // 桌面安装版：Electron 传入的用户配置路径（优先，强制覆盖）
    process.env.APP_CONFIG_PATH || "",
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
  ].filter(Boolean);

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const text = fs.readFileSync(file, "utf8");
      const isAppConfig = file === process.env.APP_CONFIG_PATH;
      parseEnvText(text, isAppConfig);
      if (file.endsWith(".env.local") || isAppConfig) {
        // app config 优先后可继续读其它作为补充；.env.local 读完可 break
        if (!isAppConfig) break;
      }
    } catch {
      /* ignore */
    }
  }
}

loadEnvFile();

function baseURL() {
  return process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
}

export function getDefaultModel() {
  return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro";
}

/** 精写档接管的正文四任务；其它大宗任务永远走主力档 */
export const FINE_WRITING_MODES = [
  "chapter",
  "continue",
  "rewrite",
  "scene_chapter",
] as const;

export type ModelSlot = "main" | "fine";

export function usesFineWritingSlot(mode?: string): boolean {
  return Boolean(
    mode && (FINE_WRITING_MODES as readonly string[]).includes(mode)
  );
}

export function isFineSlotConfigured(): boolean {
  return Boolean(process.env.FINE_MODEL?.trim());
}

export function resolveModelSlot(mode?: string): ModelSlot {
  return usesFineWritingSlot(mode) && isFineSlotConfigured() ? "fine" : "main";
}

export function getFineModel() {
  return process.env.FINE_MODEL?.trim() || "";
}

function fineBaseURL() {
  return process.env.FINE_BASE_URL?.trim() || "";
}

export function thinkingEnabled(): boolean {
  return process.env.DEEPSEEK_THINKING === "1";
}

export function getEnvDiagnostics() {
  loadEnvFile();
  const key = (
    process.env.DEEPSEEK_API_KEY ||
    process.env.XAI_API_KEY ||
    ""
  ).trim();
  const fineKey = (process.env.FINE_API_KEY || "").trim();
  return {
    cwd: process.cwd(),
    baseURL: baseURL(),
    model: getDefaultModel(),
    hasKey: Boolean(key),
    keyLength: key.length,
    keyPrefix: key ? key.slice(0, 7) : "",
    keyLooksLikeDeepSeek: key.startsWith("sk-"),
    envLocalExists: fs.existsSync(
      path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local")
    ),
    appConfigPath: process.env.APP_CONFIG_PATH || "",
    appConfigExists: Boolean(
      process.env.APP_CONFIG_PATH &&
        fs.existsSync(process.env.APP_CONFIG_PATH)
    ),
    isDesktop: Boolean(process.env.APP_CONFIG_PATH),
    thinkingEnabled: thinkingEnabled(),
    fineHasKey: Boolean(fineKey),
    fineKeyLength: fineKey.length,
    fineKeyPrefix: fineKey ? fineKey.slice(0, 7) : "",
    fineModel: getFineModel(),
    fineBaseURL: fineBaseURL(),
    fineConfigured: isFineSlotConfigured(),
  };
}

export function getConfigFilePath(): string {
  if (process.env.APP_CONFIG_PATH) return process.env.APP_CONFIG_PATH;
  return path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local");
}

export function saveApiConfig(opts: {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  fineApiKey?: string;
  fineModel?: string;
  fineBaseURL?: string;
}): { path: string } {
  const filePath = getConfigFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let existing = "";
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, "utf8");
  }

  const map = new Map<string, string>();
  for (const line of existing.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }

  if (opts.apiKey !== undefined) {
    const k = opts.apiKey.trim();
    if (k) map.set("DEEPSEEK_API_KEY", k);
    else map.delete("DEEPSEEK_API_KEY");
  }
  if (opts.model !== undefined && opts.model.trim()) {
    map.set("DEEPSEEK_MODEL", opts.model.trim());
  }
  if (opts.baseURL !== undefined && opts.baseURL.trim()) {
    map.set("DEEPSEEK_BASE_URL", opts.baseURL.trim());
  }
  if (opts.fineApiKey !== undefined) {
    const k = opts.fineApiKey.trim();
    if (k) map.set("FINE_API_KEY", k);
    else map.delete("FINE_API_KEY");
  }
  if (opts.fineModel !== undefined) {
    const m = opts.fineModel.trim();
    if (m) map.set("FINE_MODEL", m);
    else map.delete("FINE_MODEL");
  }
  if (opts.fineBaseURL !== undefined) {
    const u = opts.fineBaseURL.trim();
    if (u) map.set("FINE_BASE_URL", u);
    else map.delete("FINE_BASE_URL");
  }

  const lines = [
    CONFIG_FILE_HEADER,
    ...[...map.entries()].map(([k, v]) => `${k}=${v}`),
    "",
  ];
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  tightenConfigAcl(filePath);

  // 立即进当前进程
  if (opts.apiKey !== undefined) {
    process.env.DEEPSEEK_API_KEY = opts.apiKey.trim();
  }
  if (opts.model?.trim()) process.env.DEEPSEEK_MODEL = opts.model.trim();
  if (opts.baseURL?.trim()) process.env.DEEPSEEK_BASE_URL = opts.baseURL.trim();
  if (opts.fineApiKey !== undefined) {
    process.env.FINE_API_KEY = opts.fineApiKey.trim();
  }
  if (opts.fineModel !== undefined) {
    const m = opts.fineModel.trim();
    if (m) process.env.FINE_MODEL = m;
    else delete process.env.FINE_MODEL;
  }
  if (opts.fineBaseURL !== undefined) {
    const u = opts.fineBaseURL.trim();
    if (u) process.env.FINE_BASE_URL = u;
    else delete process.env.FINE_BASE_URL;
  }

  return { path: filePath };
}

function tightenConfigAcl(filePath: string) {
  if (process.platform !== "win32") return;
  const user = process.env.USERNAME || process.env.USER || "";
  if (!user) return;
  execFile(
    "icacls",
    [filePath, "/inheritance:r", `/grant:r`, `${user}:F`],
    { windowsHide: true },
    () => {
      /* 尽力收紧，失败不阻断 */
    }
  );
}

function resolveApiKey(): string {
  loadEnvFile();
  const apiKey = (
    process.env.DEEPSEEK_API_KEY ||
    process.env.XAI_API_KEY ||
    ""
  ).trim();
  const desktop = Boolean(process.env.APP_CONFIG_PATH);

  if (!apiKey) {
    throw new UserFacingError(
      desktop
        ? "未配置密钥。请在设置 → API 设置里填写密钥。"
        : "未配置密钥。请在首页「API 设置」中填写。"
    );
  }
  if (
    /your[-_]?key|changeme|xxx+|placeholder|example/i.test(apiKey) ||
    apiKey === "xai-your-key-here"
  ) {
    throw new UserFacingError(
      desktop
        ? "检测到仍是示例密钥。请在设置 → API 设置里填入真实密钥。"
        : "检测到仍是示例密钥。请在首页「API 设置」填入真实密钥。"
    );
  }
  return apiKey;
}

export const OPENAI_CLIENT_TIMEOUT_MS = 120_000;
export const STREAM_IDLE_WATCHDOG_MS = 90_000;

function resolveSlotApiKey(slot: ModelSlot): string {
  if (slot === "fine") {
    const fine = (process.env.FINE_API_KEY || "").trim();
    if (fine) {
      if (
        /your[-_]?key|changeme|xxx+|placeholder|example/i.test(fine) ||
        fine === "xai-your-key-here"
      ) {
        throw new UserFacingError(
          "精写档密钥仍是示例。请在设置 → API 设置里填入真实精写密钥。"
        );
      }
      return fine;
    }
  }
  return resolveApiKey();
}

function resolveSlotBaseURL(slot: ModelSlot): string {
  if (slot === "fine") {
    const url = fineBaseURL();
    if (url) return url;
  }
  return baseURL();
}

export function getClient(slot: ModelSlot = "main") {
  return new OpenAI({
    apiKey: resolveSlotApiKey(slot),
    baseURL: resolveSlotBaseURL(slot),
    timeout: OPENAI_CLIENT_TIMEOUT_MS,
  });
}

export function resolveSlotModel(slot: ModelSlot): string {
  if (slot === "fine") {
    return getFineModel() || getDefaultModel();
  }
  return getDefaultModel();
}

export type ChatRequestOptions = {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  mode?: string;
};

/** 可单测的请求体：未开 thinking 时完全不带该字段 */
export function buildChatRequestBody(
  system: string,
  user: string,
  options?: ChatRequestOptions
): Record<string, unknown> {
  const slot = resolveModelSlot(options?.mode);
  const think = thinkingEnabled();
  const body: Record<string, unknown> = {
    model: resolveSlotModel(slot),
    temperature: think ? undefined : options?.temperature ?? 0.85,
    max_tokens: options?.maxTokens ?? 8192,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (options?.stream) body.stream = true;
  if (think) {
    body.thinking = { type: "enabled" };
  }
  return body;
}

function formatAiError(e: unknown): Error {
  if (e instanceof UserFacingError) return e;
  const err = e as {
    status?: number;
    message?: string;
    error?: { message?: string };
  };
  const detail =
    err?.error?.message ||
    err?.message ||
    (e instanceof Error ? e.message : String(e));
  const status = err?.status;
  const desktop = Boolean(process.env.APP_CONFIG_PATH);
  let message = "生成失败，请稍后重试。";
  if (status === 401 || status === 403 || /api key|invalid_api_key|authentication/i.test(detail)) {
    message = desktop
      ? "鉴权失败。请在设置 → API 设置里核对密钥。"
      : "鉴权失败。请在首页「API 设置」里核对密钥。";
  } else if (status && status >= 500) {
    message = "中转服务暂时不可用，请稍后重试。";
  } else if (/timeout|etimedout|timed out/i.test(detail)) {
    message = "请求超时，请稍后重试。";
  } else if (/network|econnreset|enotfound|fetch failed/i.test(detail)) {
    message = "网络中断，请检查连接后重试。";
  } else if (detail && !/provider=|base=|key=|\.env\.local/i.test(detail)) {
    const first = detail.split(/[|\n]/)[0].trim();
    if (first && first.length < 80 && !/[A-Za-z]{8,}/.test(first)) {
      message = first;
    }
  }
  const diag = getEnvDiagnostics();
  const diagnostic = [
    status ? `HTTP ${status}` : "请求失败",
    detail,
    `model=${diag.model}`,
    `hasKey=${diag.hasKey}`,
  ].join(" · ");
  return new UserFacingError(message, diagnostic);
}

export async function chatComplete(
  system: string,
  user: string,
  options?: { temperature?: number; maxTokens?: number; mode?: string }
): Promise<string> {
  const slot = resolveModelSlot(options?.mode);
  const client = getClient(slot);
  const body = buildChatRequestBody(system, user, options);

  try {
    const resp = await client.chat.completions.create(
      body as Parameters<typeof client.chat.completions.create>[0]
    );

    const text = resp.choices[0]?.message?.content;
    if (!text) throw new Error("模型未返回内容");
    return text;
  } catch (e: unknown) {
    throw formatAiError(e);
  }
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof Error && e.name === "AbortError") ||
    (typeof DOMException !== "undefined" && e instanceof DOMException)
  );
}

/** 流式补全：按增量文本回调；返回完整字符串 */
export async function chatCompleteStream(
  system: string,
  user: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    onDelta?: (chunk: string, full: string) => void;
    mode?: string;
  }
): Promise<string> {
  const slot = resolveModelSlot(options?.mode);
  const client = getClient(slot);
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  let lastDeltaAt = Date.now();
  let idleTimedOut = false;
  const watchdog = setInterval(() => {
    if (Date.now() - lastDeltaAt >= STREAM_IDLE_WATCHDOG_MS) {
      idleTimedOut = true;
      controller.abort();
    }
  }, 1000);

  if (options?.signal) {
    if (options.signal.aborted) {
      clearInterval(watchdog);
      throw new DOMException("Aborted", "AbortError");
    }
    options.signal.addEventListener("abort", onOuterAbort);
  }

  try {
    const stream = (await client.chat.completions.create(
      buildChatRequestBody(system, user, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: true,
        mode: options?.mode,
      }) as Parameters<typeof client.chat.completions.create>[0],
      { signal: controller.signal }
    )) as AsyncIterable<{
      choices?: { delta?: { content?: string | null } }[];
    }>;

    let full = "";
    for await (const part of stream) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (idleTimedOut) {
        throw new Error("中转长时间无响应（timeout）");
      }
      const delta = part.choices?.[0]?.delta?.content || "";
      if (delta) {
        lastDeltaAt = Date.now();
        full += delta;
        options?.onDelta?.(delta, full);
      }
    }
    if (idleTimedOut) {
      throw new Error("中转长时间无响应（timeout）");
    }
    if (!full) throw new Error("模型未返回内容");
    return full;
  } catch (e: unknown) {
    if (idleTimedOut) {
      throw formatAiError(new Error("中转长时间无响应（timeout）"));
    }
    if (isAbortError(e)) throw e;
    throw formatAiError(e);
  } finally {
    clearInterval(watchdog);
    options?.signal?.removeEventListener("abort", onOuterAbort);
  }
}
