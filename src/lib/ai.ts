import fs from "fs";
import path from "path";
import OpenAI from "openai";

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
    if (
      forceDeepseek ||
      key.startsWith("DEEPSEEK_") ||
      process.env[key] === undefined ||
      process.env[key] === ""
    ) {
      if (forceDeepseek && key.startsWith("DEEPSEEK_")) {
        process.env[key] = value;
      } else if (!forceDeepseek) {
        if (
          key.startsWith("DEEPSEEK_") ||
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

export function getEnvDiagnostics() {
  loadEnvFile();
  const key = (
    process.env.DEEPSEEK_API_KEY ||
    process.env.XAI_API_KEY ||
    ""
  ).trim();
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

  const lines = [
    "# Fantasy Writer · API 配置（由应用写入，请勿分享）",
    ...[...map.entries()].map(([k, v]) => `${k}=${v}`),
    "",
  ];
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");

  // 立即进当前进程
  if (opts.apiKey !== undefined) {
    process.env.DEEPSEEK_API_KEY = opts.apiKey.trim();
  }
  if (opts.model?.trim()) process.env.DEEPSEEK_MODEL = opts.model.trim();
  if (opts.baseURL?.trim()) process.env.DEEPSEEK_BASE_URL = opts.baseURL.trim();

  return { path: filePath };
}

function resolveApiKey(): string {
  loadEnvFile();
  const apiKey = (
    process.env.DEEPSEEK_API_KEY ||
    process.env.XAI_API_KEY ||
    ""
  ).trim();

  if (!apiKey) {
    throw new Error(
      "未配置 DEEPSEEK_API_KEY。请在首页「API 设置」中填写 DeepSeek 密钥，或编辑 .env.local"
    );
  }
  if (
    /your[-_]?key|changeme|xxx+|placeholder|example/i.test(apiKey) ||
    apiKey === "xai-your-key-here"
  ) {
    throw new Error(
      "检测到仍是示例密钥。请在首页「API 设置」填入真实的 DeepSeek API Key。"
    );
  }
  return apiKey;
}

export function getClient() {
  return new OpenAI({
    apiKey: resolveApiKey(),
    baseURL: baseURL(),
  });
}

function formatAiError(e: unknown): Error {
  const err = e as {
    status?: number;
    message?: string;
    error?: { message?: string };
  };
  const detail =
    err?.error?.message ||
    err?.message ||
    (e instanceof Error ? e.message : String(e));
  const status = err?.status ? `HTTP ${err.status}` : "请求失败";
  const diag = getEnvDiagnostics();
  return new Error(
    `${status}: ${detail} | provider=${diag.baseURL.includes("deepseek") ? "DeepSeek" : "OpenAI-compatible"} model=${diag.model} base=${diag.baseURL} key=${diag.keyPrefix}…(len=${diag.keyLength})`
  );
}

export async function chatComplete(
  system: string,
  user: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const client = getClient();
  const thinkingEnabled = process.env.DEEPSEEK_THINKING === "1";
  const model = getDefaultModel();

  try {
    const resp = await client.chat.completions.create({
      model,
      temperature: thinkingEnabled ? undefined : options?.temperature ?? 0.85,
      max_tokens: options?.maxTokens ?? 8192,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // @ts-expect-error DeepSeek 扩展字段
      thinking: { type: thinkingEnabled ? "enabled" : "disabled" },
    });

    const text = resp.choices[0]?.message?.content;
    if (!text) throw new Error("模型未返回内容");
    return text;
  } catch (e: unknown) {
    throw formatAiError(e);
  }
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
  }
): Promise<string> {
  const client = getClient();
  const thinkingEnabled = process.env.DEEPSEEK_THINKING === "1";
  const model = getDefaultModel();

  try {
    // DeepSeek 扩展字段 thinking；stream 时用 any 规避 OpenAI SDK 重载
    const stream = (await client.chat.completions.create(
      {
        model,
        temperature: thinkingEnabled
          ? undefined
          : options?.temperature ?? 0.85,
        max_tokens: options?.maxTokens ?? 8192,
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        thinking: { type: thinkingEnabled ? "enabled" : "disabled" },
      } as Parameters<typeof client.chat.completions.create>[0],
      { signal: options?.signal }
    )) as AsyncIterable<{
      choices?: { delta?: { content?: string | null } }[];
    }>;

    let full = "";
    for await (const part of stream) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const delta = part.choices?.[0]?.delta?.content || "";
      if (delta) {
        full += delta;
        options?.onDelta?.(delta, full);
      }
    }
    if (!full) throw new Error("模型未返回内容");
    return full;
  } catch (e: unknown) {
    if (
      (e instanceof Error && e.name === "AbortError") ||
      (typeof DOMException !== "undefined" && e instanceof DOMException)
    ) {
      throw e;
    }
    throw formatAiError(e);
  }
}
