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
  parseTouchedThreads,
  stripTouchedThreadLine,
  type RewriteMode,
} from "@/lib/prompts";
import type {
  Character,
  GenerationSettings,
  LockedCanonFact,
  Outline,
  OutlineChapter,
  StoryBackground,
  Volume,
  WritingBoard,
} from "@/lib/types";
import { resolveChapterTemperature, sampleTextForStyleLearning } from "@/lib/types";
import { AssembleError, assemble } from "@/lib/prompts/registry";
import { UserFacingError } from "@/lib/user-error";
import {
  assertCharactersRespectCanon,
  CanonViolationError,
  parseCanonFacts,
} from "@/lib/original";
import { parseStorySkeleton } from "@/lib/skeleton";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChapterSample = {
  order: number;
  title: string;
  content?: string;
  summary?: string;
};

type BodyBase = {
  stream?: boolean;
  writingBoard?: WritingBoard;
  settings?: GenerationSettings;
  characters?: Character[];
  background?: StoryBackground;
  outline?: Outline;
  chapter?: OutlineChapter;
  projectTags?: string[];
  original?: unknown;
  canon?: LockedCanonFact[];
  instruction?: string;
  extraRules?: string;
  priorBlock?: string;
  rewriteMode?: RewriteMode | string;
};

type Body =
  | (BodyBase & { mode: "outline" })
  | (BodyBase & {
      mode: "outline_volume";
      volume?: Volume;
      volumeId?: string;
      previousEnding?: string;
      chapterCount?: number;
    })
  | (BodyBase & { mode: "chapter" })
  | (BodyBase & { mode: "rewrite"; selectedText?: string; fullContext?: string })
  | (BodyBase & { mode: "continue"; existingText?: string })
  | (BodyBase & {
      mode: "chapter_summary";
      content?: string;
      title?: string;
      openThreads?: string[];
    })
  | (BodyBase & { mode: "consistency_check"; chapters?: ChapterSample[] })
  | (BodyBase & { mode: "outline_vs_content"; content?: string })
  | (BodyBase & { mode: "scene_plan" })
  | (BodyBase & {
      mode: "scene_chapter";
      scene?: {
        order: number;
        title: string;
        summary: string;
        verbatimAnchors?: string[];
      };
      beatContractBlock?: string;
    })
  | (BodyBase & { mode: "expand_character"; seed?: string; character?: Character })
  | (BodyBase & { mode: "optimize_character"; character?: Character })
  | (BodyBase & { mode: "expand_background"; seed?: string })
  | (BodyBase & { mode: "optimize_background" })
  | (BodyBase & { mode: "expand_cast"; seed?: string; characterCount?: number })
  | (BodyBase & { mode: "optimize_settings" })
  | (BodyBase & { mode: "learn_style"; sampleText?: string; nameHint?: string })
  | (BodyBase & {
      mode: "extract_canon";
      sampleText?: string;
      originalText?: string;
      titleHint?: string;
    })
  | (BodyBase & {
      mode: "extract_skeleton";
      sampleText?: string;
      originalText?: string;
      titleHint?: string;
    })
  | (BodyBase & { mode: "polish_chapter_outline" })
  | (BodyBase & {
      mode: "volume_summary";
      volume?: Volume;
      chapterSummaries?: { order: number; title: string; summary: string }[];
    });

function asAssemblePayload(body: Body): Record<string, unknown> {
  return body as unknown as Record<string, unknown>;
}

function chapterTemperature(settings?: GenerationSettings): number {
  return resolveChapterTemperature(settings);
}

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
        asAssemblePayload(body)
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
      const assembled = assemble("chapter", writingBoard, asAssemblePayload(body));
      const temperature = chapterTemperature(body.settings);
      if (wantStream) {
        return streamResponse(
          assembled.system,
          assembled.user,
          { temperature, maxTokens: 8192 },
          signal
        );
      }
      const text = await chatComplete(assembled.system, assembled.user, {
        temperature,
        maxTokens: 8192,
      });
      return NextResponse.json({ ok: true, content: text });
    }

    if (body.mode === "rewrite") {
      const rewriteMode = (body.rewriteMode || "polish") as RewriteMode;
      const { system, user } = assemble("rewrite", writingBoard, {
        ...asAssemblePayload(body),
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
      const { system, user } = assemble("continue", writingBoard, asAssemblePayload(body));
      const temperature = chapterTemperature(body.settings);
      if (wantStream) {
        return streamResponse(
          system,
          user,
          { temperature, maxTokens: 8192 },
          signal
        );
      }
      const text = await chatComplete(system, user, {
        temperature,
        maxTokens: 8192,
      });
      return NextResponse.json({ ok: true, content: text });
    }

    if (body.mode === "chapter_summary") {
      const text = await chatComplete(
        "你是小说编辑，只输出简洁中文摘要。",
        buildChapterSummaryUserPrompt({
          content: String(body.content || ""),
          title: String(body.title || ""),
          openThreads: body.openThreads,
        }),
        { temperature: 0.4, maxTokens: 512 }
      );
      const raw = text.trim();
      return NextResponse.json({
        ok: true,
        summary: stripTouchedThreadLine(raw) || raw,
        touchedThreads: parseTouchedThreads(raw),
        raw,
      });
    }

    if (body.mode === "consistency_check") {
      const text = await chatComplete(
        "你是严格的小说连续性审稿人。只输出 JSON。",
        buildConsistencyCheckUserPrompt({
          characters: body.characters || [],
          background: body.background || {
            title: "",
            synopsis: "",
            setting: "",
            era: "",
            themes: "",
            tone: "",
            extra: "",
          },
          chapters: body.chapters || [],
        }),
        { temperature: 0.3, maxTokens: 8192 }
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
      const { system, user } = assemble(
        "scene_plan",
        writingBoard,
        asAssemblePayload(body)
      );
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
      const { system, user } = assemble(
        "scene_chapter",
        writingBoard,
        asAssemblePayload(body)
      );
      const temperature = chapterTemperature(body.settings);
      if (wantStream) {
        return streamResponse(
          system,
          user,
          { temperature, maxTokens: 4096 },
          signal
        );
      }
      const text = await chatComplete(system, user, {
        temperature,
        maxTokens: 4096,
      });
      return NextResponse.json({ ok: true, content: text });
    }

    if (body.mode === "expand_character") {
      const { system, user } = assemble(
        "expand_character",
        writingBoard,
        asAssemblePayload(body)
      );
      const text = await chatComplete(system, user, {
        temperature: 0.85,
        maxTokens: 2048,
      });
      const fields = parseCharacterFields(text);
      assertCharactersRespectCanon([fields], body.canon);
      return NextResponse.json({ ok: true, character: fields, raw: text });
    }

    if (body.mode === "optimize_character") {
      const { system, user } = assemble(
        "optimize_character",
        writingBoard,
        asAssemblePayload(body)
      );
      const text = await chatComplete(system, user, {
        temperature: 0.75,
        maxTokens: 2048,
      });
      const fields = parseCharacterFields(text);
      assertCharactersRespectCanon([fields], body.canon);
      return NextResponse.json({ ok: true, character: fields, raw: text });
    }

    if (body.mode === "expand_background") {
      const { system, user } = assemble(
        "expand_background",
        writingBoard,
        asAssemblePayload(body)
      );
      const text = await chatComplete(system, user, {
        temperature: 0.85,
        maxTokens: 2048,
      });
      const fields = parseBackgroundFields(text);
      return NextResponse.json({ ok: true, background: fields, raw: text });
    }

    if (body.mode === "optimize_background") {
      const { system, user } = assemble(
        "optimize_background",
        writingBoard,
        asAssemblePayload(body)
      );
      const text = await chatComplete(system, user, {
        temperature: 0.75,
        maxTokens: 2048,
      });
      const fields = parseBackgroundFields(text);
      return NextResponse.json({ ok: true, background: fields, raw: text });
    }

    if (body.mode === "expand_cast") {
      const { system, user } = assemble(
        "expand_cast",
        writingBoard,
        asAssemblePayload(body)
      );
      const text = await chatComplete(system, user, {
        temperature: 0.85,
        maxTokens: 4096,
      });
      const bundle = parseCastBundle(text);
      assertCharactersRespectCanon(bundle.characters, body.canon);
      return NextResponse.json({ ok: true, ...bundle, raw: text });
    }

    if (body.mode === "optimize_settings") {
      const { system, user } = assemble(
        "optimize_settings",
        writingBoard,
        asAssemblePayload(body)
      );
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
        ...asAssemblePayload(body),
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
      const originalTitle =
        body.original &&
        typeof body.original === "object" &&
        "title" in body.original
          ? String(
              (body.original as { title?: string }).title || ""
            )
          : "";
      const { system, user } = assemble("extract_canon", writingBoard, {
        ...asAssemblePayload(body),
        sampleText: capped,
        titleHint: body.titleHint || originalTitle,
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

    if (body.mode === "extract_skeleton") {
      const sample = String(body.sampleText || body.originalText || "").trim();
      if (sample.length < 40) {
        return NextResponse.json(
          { error: "原文过短，请先粘贴或导入原作后再抽取骨架" },
          { status: 400 }
        );
      }
      const capped =
        sample.length > 16000 ? sampleTextForStyleLearning(sample, 14000) : sample;
      const originalTitle =
        body.original &&
        typeof body.original === "object" &&
        "title" in body.original
          ? String((body.original as { title?: string }).title || "")
          : "";
      const { system, user } = assemble("extract_skeleton", writingBoard, {
        ...asAssemblePayload(body),
        sampleText: capped,
        titleHint: body.titleHint || originalTitle,
      });
      const text = await chatComplete(system, user, {
        temperature: 0.3,
        maxTokens: 8192,
      });
      try {
        const skeleton = parseStorySkeleton(text);
        return NextResponse.json({ ok: true, skeleton, raw: text });
      } catch {
        return NextResponse.json(
          { error: "未能解析故事骨架，请重试或改为手工整理", raw: text },
          { status: 500 }
        );
      }
    }

    if (body.mode === "polish_chapter_outline") {
      const { system, user } = assemble(
        "polish_chapter_outline",
        writingBoard,
        asAssemblePayload(body)
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

    if (body.mode === "volume_summary") {
      const { system, user } = assemble(
        "volume_summary",
        writingBoard,
        asAssemblePayload(body)
      );
      const text = await chatComplete(system, user, {
        temperature: 0.3,
        maxTokens: 512,
      });
      return NextResponse.json({ ok: true, summary: text.trim(), raw: text });
    }

    return NextResponse.json(
      { error: "不支持的生成类型（前后端版本可能不一致）" },
      { status: 400 }
    );
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
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "已取消生成" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : String(e);
    const diagnostic =
      e instanceof UserFacingError ? e.diagnostic : undefined;
    const isAuth = /鉴权失败|密钥/.test(message);
    return NextResponse.json(
      {
        error: message,
        diagnostic,
      },
      { status: isAuth ? 401 : 500 }
    );
  }
}
