import { buildMemoryPack } from "./memory-pack";
import { originalContextFrom } from "./original";
import { recordUsage } from "./storage";
import type { GenerateTaskMode } from "./prompts/registry";
import type { NovelProject, WritingBoard } from "./types";

export type GenerateRequest = {
  mode: GenerateTaskMode;
  writingBoard: WritingBoard;
  stream?: boolean;
  [key: string]: unknown;
};

export function generateBody(
  project: Pick<NovelProject, "writingBoard" | "original" | "canon">,
  task: GenerateTaskMode,
  rest: Omit<GenerateRequest, "mode" | "writingBoard"> = {}
): GenerateRequest {
  return {
    ...rest,
    ...originalContextFrom(project),
    mode: task,
    writingBoard: project.writingBoard,
  };
}

/** 统一调用 /api/generate（非流式） */
export async function postGenerate(
  body: GenerateRequest,
  opts?: { signal?: AbortSignal }
) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "请求失败");
  const mode = String(body.mode || "unknown");
  const out =
    typeof data.content === "string"
      ? data.content.length
      : JSON.stringify(data).length;
  recordUsage(mode, JSON.stringify(body).length, out);
  return data;
}

/**
 * 流式生成：服务端 SSE（data: {"delta":"..."} / data: {"done":true,"content":"..."}）
 */
export async function streamGenerate(
  body: GenerateRequest,
  opts: {
    signal?: AbortSignal;
    onDelta?: (chunk: string, full: string) => void;
  } = {}
): Promise<string> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
    signal: opts.signal,
  });

  if (!res.ok) {
    let msg = "请求失败";
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      msg = await res.text();
    }
    throw new Error(msg);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("浏览器不支持流式读取");

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload) as {
          delta?: string;
          content?: string;
          error?: string;
          done?: boolean;
        };
        if (obj.error) throw new Error(obj.error);
        if (obj.delta) {
          full += obj.delta;
          opts.onDelta?.(obj.delta, full);
        }
        if (obj.done && obj.content) {
          full = obj.content;
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
          if ((e as Error).message && !e.message.includes("JSON")) throw e;
        }
      }
    }
  }

  if (!full.trim()) throw new Error("模型未返回内容");
  recordUsage(String(body.mode || "stream"), JSON.stringify(body).length, full.length);
  return full;
}

/** 构建前几章摘要 + 上章结尾 + 角色状态卡，供正文生成衔接 */
export function buildPreviousContext(
  project: Pick<
    NovelProject,
    "characters" | "outline" | "chapters" | "plotThreads" | "lore"
  >,
  currentOrder: number
): {
  previousSnippet?: string;
  previousSummaries?: string;
  characterStateCard?: string;
  plotThreads?: string;
  lore?: string;
  priorBlock?: string;
} {
  const pack = buildMemoryPack(project, currentOrder);
  return {
    previousSummaries: pack.previousSummaries || undefined,
    previousSnippet: pack.previousSnippet,
    characterStateCard: pack.characterStateCard || undefined,
    plotThreads: pack.plotThreads || undefined,
    lore: pack.lore || undefined,
    priorBlock: pack.priorBlock || undefined,
  };
}

export function formatPlotThreadsForPrompt(
  threads?: {
    title: string;
    note: string;
    status: string;
  }[]
): string {
  if (!threads?.length) return "";
  return threads
    .filter((t) => t.status !== "resolved")
    .map((t) => `- [${t.status}] ${t.title}${t.note ? `：${t.note}` : ""}`)
    .join("\n");
}
