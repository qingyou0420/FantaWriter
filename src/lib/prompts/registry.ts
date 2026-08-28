import type { WritingBoard } from "../types";
import { deniesMinorSexualContent } from "../policy/minors";
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
  generalSceneChapterUser,
  generalScenePlanUser,
  generalContinueUser,
  generalVolumeOutlineUser,
  generalVolumeSummaryUser,
  generalNextChaptersUser,
} from "./general";
import {
  buildExtractCanonUserPrompt,
  injectOriginalGrounding,
} from "../original";
import { buildExtractSkeletonUserPrompt } from "../skeleton";
import {
  characterWithoutTruth,
  charactersWithoutTruth,
} from "../author-secrets";

export type GenerateTaskMode =
  | "outline"
  | "outline_volume"
  | "outline_next"
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
  | "polish_chapter_outline"
  | "extract_canon"
  | "extract_skeleton"
  | "volume_summary";

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

function scanFreeText(texts: (string | undefined)[]) {
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

function resolveBoard(_writingBoard?: WritingBoard | string): WritingBoard {
  return "general";
}

export function assemble(
  task: GenerateTaskMode,
  writingBoard: WritingBoard | string,
  payload: Record<string, unknown>
): { system: string; user: string } {
  resolveBoard(writingBoard);

  const extra = String(
    (payload.settings as { extraInstructions?: string } | undefined)
      ?.extraInstructions || payload.instruction || payload.seed || ""
  );
  const extraRulesRaw = String(
    (payload.settings as { extraRules?: string } | undefined)?.extraRules ||
      payload.extraRules ||
      ""
  );
  scanFreeText([
    extra,
    extraRulesRaw,
    payload.instruction as string | undefined,
    payload.extraInstructions as string | undefined,
  ]);

  if (
    task === "rewrite" &&
    (payload.rewriteMode === "more_erotic" ||
      payload.rewriteMode === "less_erotic")
  ) {
    throw new AssembleError(
      "REWRITE_MODE_NOT_ALLOWED",
      "当前版本不支持这种改写方式"
    );
  }

  const assembled = assembleGeneral(task, payload);
  const grounded = injectOriginalGrounding(assembled, task, payload);
  return {
    system: appendExtraRules(grounded.system, extraRulesRaw),
    user: grounded.user,
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

export function previewBuiltInSystem(_board?: WritingBoard): string {
  return `${CRAFT_SYSTEM}\n\n${GENERAL_CHAPTER_SYSTEM}`;
}

function learnedStyleSystemAppendix(
  settings: { writingStyle?: string; learnedStyleGuide?: string; learnedStyleFingerprints?: string[] } | undefined
): string {
  if (!settings || settings.writingStyle !== "learned") return "";
  const guide = (settings.learnedStyleGuide || "").trim();
  if (!guide) return "";
  const prints = (settings.learnedStyleFingerprints || [])
    .map((f) => String(f || "").trim())
    .filter(Boolean);
  const fp = prints.length
    ? `\n\n## 风格例句（模仿其气质，勿照抄）\n${prints.map((f, i) => `${i + 1}. ${f}`).join("\n")}`
    : "";
  return `\n\n## 固定学习文风指南（硬性，优先于默认文风习惯）\n${guide}${fp}`;
}

function assembleGeneral(
  task: GenerateTaskMode,
  payload: Record<string, unknown>
): { system: string; user: string } {
  payload = {
    ...payload,
    characters: payload.characters
      ? charactersWithoutTruth(payload.characters as never)
      : payload.characters,
    character: payload.character
      ? characterWithoutTruth(payload.character as never)
      : payload.character,
    otherCharacters: payload.otherCharacters
      ? charactersWithoutTruth(payload.otherCharacters as never)
      : payload.otherCharacters,
  };
  const settings = payload.settings as
    | { writingStyle?: string; learnedStyleGuide?: string; learnedStyleFingerprints?: string[] }
    | undefined;
  const chapterSys = `${CRAFT_SYSTEM}\n\n${GENERAL_CHAPTER_SYSTEM}${learnedStyleSystemAppendix(settings)}`;
  switch (task) {
    case "outline":
      return {
        system: chapterSys,
        user: generalOutlineUser(
          payload.characters as never,
          payload.background as never,
          payload.settings as never,
          payload.projectTags as string[] | undefined,
          {
            premise: payload.premise as string | undefined,
            includeEndingDirection: Boolean(payload.includeEndingDirection),
            endingDirection: payload.endingDirection as string | undefined,
          }
        ),
      };
    case "outline_volume":
      return {
        system: chapterSys,
        user: generalVolumeOutlineUser({
          characters: payload.characters as never,
          background: payload.background as never,
          settings: payload.settings as never,
          volume: payload.volume as never,
          previousEnding: payload.previousEnding as string | undefined,
          chapterCount: Number(payload.chapterCount || 10),
          projectTags: payload.projectTags as string[] | undefined,
        }),
      };
    case "outline_next":
      return {
        system: chapterSys,
        user: generalNextChaptersUser({
          characters: payload.characters as never,
          background: payload.background as never,
          settings: payload.settings as never,
          volume: payload.volume as never,
          chapterCount: Number(payload.chapterCount || 10),
          recentSummaries: (payload.recentSummaries || []) as never,
          openThreads: payload.openThreads as string[] | undefined,
          characterStates: payload.characterStates as string | undefined,
          projectTags: payload.projectTags as string[] | undefined,
          premise: payload.premise as string | undefined,
          includeEndingDirection: Boolean(payload.includeEndingDirection),
          endingDirection: payload.endingDirection as string | undefined,
        }),
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
                payload.projectTags as string[] | undefined,
                payload.priorBlock as string | undefined,
                payload.volumes as never,
                {
                  premise: payload.premise as string | undefined,
                  includeEndingDirection: Boolean(
                    payload.includeEndingDirection
                  ),
                  endingDirection: payload.endingDirection as
                    | string
                    | undefined,
                  chapterContractBlock: payload.chapterContractBlock as
                    | string
                    | undefined,
                  injectFullOutline: Boolean(
                    payload.injectFullOutline ||
                      (payload.settings as { injectFullOutline?: boolean } | undefined)
                        ?.injectFullOutline
                  ),
                }
              )
            : task === "continue"
              ? generalContinueUser(payload as never)
              : generalSceneChapterUser(payload as never),
      };
    case "rewrite":
      return {
        system: chapterSys,
        user: generalRewriteUser(payload as never),
      };
    case "scene_plan":
      return {
        system: chapterSys,
        user: generalScenePlanUser(payload as never),
      };
    case "volume_summary":
      return {
        system: GENERAL_SETTING_SYSTEM,
        user: generalVolumeSummaryUser({
          volume: payload.volume as never,
          chapterSummaries: (payload.chapterSummaries ||
            payload.summaries ||
            []) as never,
        }),
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
        user: generalPolishOutlineUser({
          characters: payload.characters as never,
          background: payload.background as never,
          settings: payload.settings as never,
          outline: payload.outline as never,
          chapter: payload.chapter as never,
          projectTags: payload.projectTags as string[] | undefined,
          includeEndingDirection: Boolean(payload.includeEndingDirection),
          endingDirection: payload.endingDirection as string | undefined,
          premise: payload.premise as string | undefined,
        }),
      };
    case "extract_canon":
      return {
        system: GENERAL_SETTING_SYSTEM,
        user: buildExtractCanonUserPrompt({
          sampleText: String(payload.sampleText || payload.originalText || ""),
          titleHint: String(payload.titleHint || payload.nameHint || ""),
        }),
      };
    case "extract_skeleton":
      return {
        system: GENERAL_SETTING_SYSTEM,
        user: buildExtractSkeletonUserPrompt({
          sampleText: String(payload.sampleText || payload.originalText || ""),
          titleHint: String(payload.titleHint || payload.nameHint || ""),
        }),
      };
    default:
      return { system: chapterSys, user: "" };
  }
}

export function bannedHits(text: string): string[] {
  return GENERAL_BANNED_SUBSTRINGS.filter((s) => text.includes(s));
}
