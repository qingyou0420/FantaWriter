import type { WritingBoard } from "../types";
import { deniesMinorSexualContent } from "../policy/minors";
import {
  ADULT_SYSTEM,
  LEARN_STYLE_SYSTEM_EROTIC,
  SETTING_SYSTEM,
} from "./erotic-systems";
import { CRAFT_SYSTEM } from "./craft";
import {
  GENERAL_CHAPTER_SYSTEM,
  GENERAL_SETTING_SYSTEM,
  LEARN_STYLE_SYSTEM_GENERAL,
  generalChapterUser,
  generalExpandBackgroundUser,
  generalExpandCastUser,
  generalExpandCharacterUser,
  generalLearnStyleUser,
  generalOptimizeBackgroundUser,
  generalOptimizeCharacterUser,
  generalOptimizeSettingsUser,
  generalOutlineUser,
  generalPolishOutlineUser,
  generalRewriteUser,
} from "./general";
import {
  buildChapterSystemPrompt,
  buildChapterUserPrompt,
  buildContinueUserPrompt,
  buildExpandBackgroundUserPrompt,
  buildExpandCastUserPrompt,
  buildExpandCharacterUserPrompt,
  buildLearnStyleUserPrompt,
  buildOptimizeBackgroundUserPrompt,
  buildOptimizeCharacterUserPrompt,
  buildOptimizeSettingsUserPrompt,
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
  buildPolishChapterOutlineUserPrompt,
  buildRewriteUserPrompt,
  buildSceneChapterUserPrompt,
  buildScenePlanUserPrompt,
} from "../prompts";

export type GenerateTaskMode =
  | "outline"
  | "chapter"
  | "rewrite"
  | "continue"
  | "chapter_summary"
  | "consistency_check"
  | "outline_vs_content"
  | "scene_plan"
  | "scene_chapter"
  | "expand_character"
  | "optimize_character"
  | "expand_background"
  | "optimize_background"
  | "expand_cast"
  | "optimize_settings"
  | "learn_style"
  | "polish_chapter_outline";

export const GENERAL_BANNED_SUBSTRINGS = [
  "色情尺度",
  "强制行为标签",
  "口交",
  "肛交",
  "舔阴",
  "成人向虚构小说写作者",
  "情色小说",
  "more_erotic",
  "成年人同意",
  "适合成人情色",
  "成年年龄",
  "均为成年人",
  "成人向可写",
  "欲望走向",
  "暧昧、禁忌、甜虐",
  "所有角色为成年人",
  "成人虚构作品",
] as const;

export class AssembleError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function scanFreeText(board: WritingBoard, texts: (string | undefined)[]) {
  const blob = texts.filter(Boolean).join("\n");
  if (!blob) return;
  if (deniesMinorSexualContent(blob)) {
    throw new AssembleError(
      "POLICY_MINOR_SEX",
      "已拦截：禁止性内容与未成年描述同时出现",
      400
    );
  }
}

export function assemble(
  task: GenerateTaskMode,
  writingBoard: WritingBoard,
  payload: Record<string, unknown>
): { system: string; user: string } {
  if (writingBoard !== "general" && writingBoard !== "erotic") {
    throw new AssembleError("WRITING_BOARD_REQUIRED", "WRITING_BOARD_REQUIRED");
  }

  const extra = String(
    (payload.settings as { extraInstructions?: string } | undefined)
      ?.extraInstructions || payload.instruction || payload.seed || ""
  );
  const extraRulesRaw = String(
    (payload.settings as { extraRules?: string } | undefined)?.extraRules ||
      payload.extraRules ||
      ""
  );
  scanFreeText(writingBoard, [
    extra,
    extraRulesRaw,
    payload.instruction as string | undefined,
    payload.extraInstructions as string | undefined,
  ]);

  if (
    writingBoard === "general" &&
    task === "rewrite" &&
    (payload.rewriteMode === "more_erotic" ||
      payload.rewriteMode === "less_erotic")
  ) {
    throw new AssembleError(
      "REWRITE_MODE_NOT_ALLOWED",
      "REWRITE_MODE_NOT_ALLOWED"
    );
  }

  const assembled =
    writingBoard === "erotic"
      ? assembleErotic(task, payload)
      : assembleGeneral(task, payload);
  return {
    system: appendExtraRules(assembled.system, extraRulesRaw),
    user: assembled.user,
  };
}

export function parseExtraRules(raw: unknown): string[] {
  return String(raw || "")
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function appendExtraRules(system: string, raw: unknown): string {
  const rules = parseExtraRules(raw);
  if (!rules.length) return system;
  return `${system}\n\n## 用户附加规则\n${rules.map((r) => `- ${r}`).join("\n")}`;
}

export function previewBuiltInSystem(board: WritingBoard): string {
  if (board === "general") return `${CRAFT_SYSTEM}\n\n${GENERAL_CHAPTER_SYSTEM}`;
  return ADULT_SYSTEM;
}

function assembleErotic(
  task: GenerateTaskMode,
  payload: Record<string, unknown>
): { system: string; user: string } {
  switch (task) {
    case "outline":
      return {
        system: buildOutlineSystemPrompt(),
        user: buildOutlineUserPrompt(
          payload.characters as never,
          payload.background as never,
          payload.settings as never,
          payload.projectTags as string[] | undefined
        ),
      };
    case "chapter":
      return {
        system: buildChapterSystemPrompt(),
        user: buildChapterUserPrompt(
          payload.characters as never,
          payload.background as never,
          payload.settings as never,
          payload.outline as never,
          payload.chapter as never,
          payload.previousChapterSnippet as string | undefined,
          payload.projectTags as string[] | undefined
        ),
      };
    case "rewrite":
      return {
        system: buildChapterSystemPrompt(),
        user: buildRewriteUserPrompt({
          ...(payload as object as Record<string, unknown>),
          mode: (payload.rewriteMode || "polish") as never,
        } as never),
      };
    case "continue":
      return {
        system: buildChapterSystemPrompt(),
        user: buildContinueUserPrompt(payload as never),
      };
    case "scene_plan":
      return {
        system: buildOutlineSystemPrompt(),
        user: buildScenePlanUserPrompt(payload as never),
      };
    case "scene_chapter":
      return {
        system: buildChapterSystemPrompt(),
        user: buildSceneChapterUserPrompt(payload as never),
      };
    case "expand_character":
      return {
        system: SETTING_SYSTEM,
        user: buildExpandCharacterUserPrompt(payload as never),
      };
    case "optimize_character":
      return {
        system: SETTING_SYSTEM,
        user: buildOptimizeCharacterUserPrompt(payload as never),
      };
    case "expand_background":
      return {
        system: SETTING_SYSTEM,
        user: buildExpandBackgroundUserPrompt(payload as never),
      };
    case "optimize_background":
      return {
        system: SETTING_SYSTEM,
        user: buildOptimizeBackgroundUserPrompt(payload as never),
      };
    case "expand_cast":
      return {
        system: SETTING_SYSTEM,
        user: buildExpandCastUserPrompt(payload as never),
      };
    case "optimize_settings":
      return {
        system: SETTING_SYSTEM,
        user: buildOptimizeSettingsUserPrompt(payload as never),
      };
    case "learn_style":
      return {
        system: LEARN_STYLE_SYSTEM_EROTIC,
        user: buildLearnStyleUserPrompt(payload as never),
      };
    case "polish_chapter_outline":
      return {
        system: buildOutlineSystemPrompt(),
        user: buildPolishChapterOutlineUserPrompt(payload as never),
      };
    default:
      return { system: ADULT_SYSTEM, user: "" };
  }
}

function assembleGeneral(
  task: GenerateTaskMode,
  payload: Record<string, unknown>
): { system: string; user: string } {
  const chapterSys = `${CRAFT_SYSTEM}\n\n${GENERAL_CHAPTER_SYSTEM}`;
  switch (task) {
    case "outline":
      return {
        system: chapterSys,
        user: generalOutlineUser(
          payload.characters as never,
          payload.background as never,
          payload.settings as never,
          payload.projectTags as string[] | undefined
        ),
      };
    case "chapter":
    case "continue":
    case "scene_chapter":
      return {
        system: chapterSys,
        user:
          task === "chapter"
            ? generalChapterUser(
                payload.characters as never,
                payload.background as never,
                payload.settings as never,
                payload.outline as never,
                payload.chapter as never,
                payload.previousChapterSnippet as string | undefined,
                payload.projectTags as string[] | undefined
              )
            : task === "continue"
              ? buildContinueUserPrompt({
                  ...(payload as object as Record<string, unknown>),
                  writingBoard: "general",
                } as never)
              : buildSceneChapterUserPrompt({
                  ...(payload as object as Record<string, unknown>),
                  writingBoard: "general",
                } as never),
      };
    case "rewrite":
      return {
        system: chapterSys,
        user: generalRewriteUser(payload as never),
      };
    case "scene_plan":
      return {
        system: chapterSys,
        user: buildScenePlanUserPrompt({
          ...(payload as object as Record<string, unknown>),
          writingBoard: "general",
        } as never),
      };
    case "expand_character":
      return {
        system: GENERAL_SETTING_SYSTEM,
        user: generalExpandCharacterUser(payload as never),
      };
    case "optimize_character":
      return {
        system: GENERAL_SETTING_SYSTEM,
        user: generalOptimizeCharacterUser(payload as never),
      };
    case "expand_background":
      return {
        system: GENERAL_SETTING_SYSTEM,
        user: generalExpandBackgroundUser(payload as never),
      };
    case "optimize_background":
      return {
        system: GENERAL_SETTING_SYSTEM,
        user: generalOptimizeBackgroundUser(payload as never),
      };
    case "expand_cast":
      return {
        system: GENERAL_SETTING_SYSTEM,
        user: generalExpandCastUser(payload as never),
      };
    case "optimize_settings":
      return {
        system: GENERAL_SETTING_SYSTEM,
        user: generalOptimizeSettingsUser(payload as never),
      };
    case "learn_style":
      return {
        system: LEARN_STYLE_SYSTEM_GENERAL,
        user: generalLearnStyleUser(payload as never),
      };
    case "polish_chapter_outline":
      return {
        system: chapterSys,
        user: generalPolishOutlineUser(payload as never),
      };
    default:
      return { system: chapterSys, user: "" };
  }
}

export function bannedHits(text: string): string[] {
  return GENERAL_BANNED_SUBSTRINGS.filter((s) => text.includes(s));
}
