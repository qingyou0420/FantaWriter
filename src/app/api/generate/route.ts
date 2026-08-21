import { NextRequest, NextResponse } from "next/server";
import { chatComplete, chatCompleteStream, getEnvDiagnostics } from "@/lib/ai";
import {
  buildChapterSummaryUserPrompt,
  buildConsistencyCheckUserPrompt,
  buildOutlineVsContentUserPrompt,
  parseBackgroundFields,
  parseCastBundle,
  parseCharacterFields,
  parseConsistencyResult,
  parseLearnedStyleFields,
  parseOutlineCheckResult,
  parseOutlineJson,
  parsePolishedChapterOutline,
  parseScenePlan,
  parseSettingsFields,
  type RewriteMode,
} from "@/lib/prompts";
import type {
  Character,
  GenerationSettings,
  LockedCanonFact,
  OutlineChapter,
  StoryBackground,
  WritingBoard,
} from "@/lib/types";
import { AssembleError, assemble } from "@/lib/prompts/registry";
import {
  assertCharactersRespectCanon,
  CanonViolationError,
  parseCanonFacts,
} from "@/lib/original";
import { sampleTextForStyleLearning } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any> & { mode: string; stream?: boolean };

function sseEncode(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

function streamResponse(
  system: string,
  user: string,
  options: { temperature?: number; maxTokens?: number },
  signal: AbortSignal
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const content = await chatCompleteStream(system, user, {
          ...options,
          signal,
          onDelta: (delta) => {
            controller.enqueue(encoder.encode(sseEncode({ delta })));
          },
        });
        controller.enqueue(
          encoder.encode(sseEncode({ done: true, content }))
        );
        controller.close();
      } catch (e) {
        const message =
          e instanceof Error
            ? e.name === "AbortError"
              ? "已取消生成"
              : e.message
            : String(e);
        controller.enqueue(encoder.encode(sseEncode({ error: message })));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, env: getEnvDiagnostics() });
}

function parseWritingBoard(_body: Body): WritingBoard {
  return "general";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const signal = req.signal;
    const wantStream = Boolean(body.stream);
    const writingBoard = parseWritingBoard(body);

    if (body.mode === "outline" || body.mode === "outline_volume") {
      const { system, user } = assemble(
        body.mode === "outline_volume" ? "outline_volume" : "outline",
        writingBoard,
        body
      );
      const text = await chatComplete(system, user, {
        temperature: 0.8,
        maxTokens: 8192,
      });
      try {
        const volumeId =
          body.mode === "outline_volume"
            ? String(body.volume?.id || body.volumeId || "")
            : "";
        const outline = parseOutlineJson(
          text,
          volumeId ? { volumeId } : undefined
        );
        return NextResponse.json({ ok: true, outline, raw: text });
      } catch {
        return NextResponse.json({
          ok: true,
          outline: {
            premise: "",
            endingNote: "",
            chapters: [],
            raw: text,
          },
          parseError: "JSON 解析失败，已返回原始文本，请手动整理大纲",
          raw: text,
        });
      }
    }

    if (body.mode === "chapter") {
      const assembled = assemble("chapter", writingBoard, body);
      if (wantStream) {
        return streamResponse(
          assembled.system,
          assembled.user,
          { temperature: 0.9, maxTokens: 8192 },
          signal
        );
      }
      const text = await chatComplete(assembled.system, assembled.user, {
        temperature: 0.9,
        maxTokens: 8192,
      });
      return NextResponse.json({ ok: true, content: text });
    }

    if (body.mode === "rewrite") {
      const rewriteMode = (body.rewriteMode || "polish") as RewriteMode;
      const { system, user } = assemble("rewrite", writingBoard, {
        ...body,
        mode: rewriteMode,
        rewriteMode,
      });
      const rewriteTokens = rewriteMode === "expand" ? 8192 : 4096;
      if (wantStream) {
        return streamResponse(
          system,
          user,
          { temperature: 0.75, maxTokens: rewriteTokens },
          signal
        );
      }
      const text = await chatComplete(system, user, {
        temperature: 0.75,
        maxTokens: rewriteTokens,
      });
      return NextResponse.json({ ok: true, content: text });
    }

    if (body.mode === "continue") {
      const { system, user } = assemble("continue", writingBoard, body);
      if (wantStream) {
        return streamResponse(
          system,
          user,
          { temperature: 0.9, maxTokens: 8192 },
          signal
        );
      }
      const text = await chatComplete(system, user, {
        temperature: 0.9,
        maxTokens: 8192,
      });
      return NextResponse.json({ ok: true, content: text });
    }

    if (body.mode === "chapter_summary") {
      const text = await chatComplete(
        "你是小说编辑，只输出简洁中文摘要。",
        buildChapterSummaryUserPrompt(
          String(body.content || ""),
          String(body.title || "")
        ),
        { temperature: 0.4, maxTokens: 512 }
      );
      return NextResponse.json({ ok: true, summary: text.trim() });
    }

    if (body.mode === "consistency_check") {
      const text = await chatComplete(
        "你是严格的小说连续性审稿人。只输出 JSON。",
        buildConsistencyCheckUserPrompt({
          characters: body.characters as Character[],
          background: body.background as StoryBackground,
          chapters: body.chapters as {
            order: number;
            title: string;
            content: string;
          }[],
        }),
        { temperature: 0.3, maxTokens: 3072 }
      );
      try {
        const result = parseConsistencyResult(text);
        return NextResponse.json({ ok: true, result, raw: text });
      } catch {
        return NextResponse.json({
          ok: true,
          result: { score: 0, summary: "解析失败", issues: [] },
          raw: text,
        });
      }
    }

    if (body.mode === "outline_vs_content") {
      const text = await chatComplete(
        "你是小说大纲对照审稿人。只输出 JSON。",
        buildOutlineVsContentUserPrompt({
          chapter: body.chapter as OutlineChapter,
          content: String(body.content || ""),
          projectTags: body.projectTags as string[] | undefined,
        }),
        { temperature: 0.3, maxTokens: 2048 }
      );
      try {
        const result = parseOutlineCheckResult(text);
        return NextResponse.json({ ok: true, result, raw: text });
      } catch {
        return NextResponse.json({
          ok: true,
          result: {
            covered: [],
            missing: [],
            extra: [],
            score: 0,
            advice: "解析失败",
          },
          raw: text,
        });
      }
    }

    if (body.mode === "scene_plan") {
      const { system, user } = assemble("scene_plan", writingBoard, body);
      const text = await chatComplete(system, user, {
        temperature: 0.7,
        maxTokens: 2048,
      });
      try {
        const scenes = parseScenePlan(text);
        return NextResponse.json({ ok: true, scenes, raw: text });
      } catch {
        return NextResponse.json(
          { error: "场景规划解析失败", raw: text },
          { status: 500 }
        );
      }
    }

    if (body.mode === "scene_chapter") {
      const { system, user } = assemble("scene_chapter", writingBoard, body);
      if (wantStream) {
        return streamResponse(
          system,
          user,
          { temperature: 0.9, maxTokens: 4096 },
          signal
        );
      }
      const text = await chatComplete(system, user, {
        temperature: 0.9,
        maxTokens: 4096,
      });
      return NextResponse.json({ ok: true, content: text });
    }

    if (body.mode === "expand_character") {
      const { system, user } = assemble("expand_character", writingBoard, body);
      const text = await chatComplete(system, user, {
        temperature: 0.85,
        maxTokens: 2048,
      });
      const fields = parseCharacterFields(text);
      assertCharactersRespectCanon([fields], body.canon);
      return NextResponse.json({ ok: true, character: fields, raw: text });
    }

    if (body.mode === "optimize_character") {
      const { system, user } = assemble("optimize_character", writingBoard, body);
      const text = await chatComplete(system, user, {
        temperature: 0.75,
        maxTokens: 2048,
      });
      const fields = parseCharacterFields(text);
      assertCharactersRespectCanon([fields], body.canon);
      return NextResponse.json({ ok: true, character: fields, raw: text });
    }

    if (body.mode === "expand_background") {
      const { system, user } = assemble("expand_background", writingBoard, body);
      const text = await chatComplete(system, user, {
        temperature: 0.85,
        maxTokens: 2048,
      });
      const fields = parseBackgroundFields(text);
      return NextResponse.json({ ok: true, background: fields, raw: text });
    }

    if (body.mode === "optimize_background") {
      const { system, user } = assemble("optimize_background", writingBoard, body);
      const text = await chatComplete(system, user, {
        temperature: 0.75,
        maxTokens: 2048,
      });
      const fields = parseBackgroundFields(text);
      return NextResponse.json({ ok: true, background: fields, raw: text });
    }

    if (body.mode === "expand_cast") {
      const { system, user } = assemble("expand_cast", writingBoard, body);
      const text = await chatComplete(system, user, {
        temperature: 0.85,
        maxTokens: 4096,
      });
      const bundle = parseCastBundle(text);
      assertCharactersRespectCanon(bundle.characters, body.canon);
      return NextResponse.json({ ok: true, ...bundle, raw: text });
    }

    if (body.mode === "optimize_settings") {
      const { system, user } = assemble("optimize_settings", writingBoard, body);
      const text = await chatComplete(system, user, {
        temperature: 0.7,
        maxTokens: 1024,
      });
      const settings = parseSettingsFields(
        text,
        body.settings as GenerationSettings
      );
      return NextResponse.json({ ok: true, settings, raw: text });
    }

    if (body.mode === "learn_style") {
      const sample = (body.sampleText || "").trim();
      if (sample.length < 80) {
        return NextResponse.json(
          { error: "范文过短，请至少导入约 80 字以上文本" },
          { status: 400 }
        );
      }
      const capped =
        sample.length > 16000
          ? sample.slice(0, 8000) + "\n\n…\n\n" + sample.slice(-8000)
          : sample;
      const { system, user } = assemble("learn_style", writingBoard, {
        ...body,
        sampleText: capped,
      });
      const text = await chatComplete(system, user, {
        temperature: 0.55,
        maxTokens: 4096,
      });
      const fields = parseLearnedStyleFields(text);
      if (!fields.styleGuide.trim()) {
        return NextResponse.json(
          {
            error: "未能解析出有效风格指南，请换一篇更长的范文重试",
            raw: text,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, style: fields, raw: text });
    }

    if (body.mode === "extract_canon") {
      const sample = String(body.sampleText || body.originalText || "").trim();
      if (sample.length < 40) {
        return NextResponse.json(
          { error: "原文过短，请先粘贴或导入原作后再抽取设定" },
          { status: 400 }
        );
      }
      const capped =
        sample.length > 16000 ? sampleTextForStyleLearning(sample, 14000) : sample;
      const { system, user } = assemble("extract_canon", writingBoard, {
        ...body,
        sampleText: capped,
        titleHint: body.titleHint || body.original?.title,
      });
      const text = await chatComplete(system, user, {
        temperature: 0.4,
        maxTokens: 3072,
      });
      const facts = parseCanonFacts(text);
      if (!facts.length) {
        return NextResponse.json(
          { error: "未能抽出设定条目，请检查原文或改为手工添加锁定", raw: text },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, facts, raw: text });
    }

    if (body.mode === "polish_chapter_outline") {
      const { system, user } = assemble(
        "polish_chapter_outline",
        writingBoard,
        body
      );
      const text = await chatComplete(system, user, {
        temperature: 0.75,
        maxTokens: 2048,
      });
      const polished = parsePolishedChapterOutline(text);
      if (!polished.summary.trim() && !polished.title.trim()) {
        return NextResponse.json(
          { error: "大纲润色结果解析失败，请重试", raw: text },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, chapter: polished, raw: text });
    }

    return NextResponse.json({ error: "未知 mode" }, { status: 400 });
  } catch (e) {
    if (e instanceof AssembleError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    if (e instanceof CanonViolationError) {
      return NextResponse.json(
        { error: e.message, code: e.code, violations: e.violations },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "已取消生成" }, { status: 499 });
    }
    const isAuth =
      /incorrect api key|invalid api key|invalid_api_key|authentication_error/i.test(
        message
      ) && /api key|api_key|sk-|Bearer/i.test(message);
    return NextResponse.json(
      {
        error: isAuth
          ? `鉴权失败（Key 可能无效或未加载）：${message}`
          : message,
        env: getEnvDiagnostics(),
      },
      { status: isAuth ? 401 : 500 }
    );
  }
}
