/**
 * Kimi-class models sometimes print a prose marker such as
 * `（tool_write_truth_file: outline/story_frame.md）` and stop, instead of
 * emitting a native toolCall. That text looks like a tool chip but never
 * executes — no proposal, no disk write.
 */

const KNOWN_TOOL_NAMES = [
  "write_truth_file",
  "read",
  "grep",
  "ls",
  "sub_agent",
  "rename_entity",
  "patch_chapter_text",
  "replace_chapter_text",
  "resync_chapter_state",
  "delete_latest_chapter",
  "propose_action",
  "generate_cover",
  "short_fiction_run",
  "play_start",
  "play_edit",
  "play_revise",
  "play_step",
  "import_chapters",
  "research_web",
  "ingest_material",
  "retrieve_material",
] as const;

const PSEUDO_TOOL_RE = /[（(\[]\s*tool[_ ]([a-z][a-z0-9_]*)\b[^）)\]]*[）)\]]/gi;

export interface PseudoToolMarker {
  readonly toolName: string;
  readonly raw: string;
}

export function detectPseudoToolText(text: string | undefined): PseudoToolMarker | undefined {
  const source = text?.trim() ?? "";
  if (!source) return undefined;
  for (const match of source.matchAll(PSEUDO_TOOL_RE)) {
    const toolName = resolveKnownToolName(match[1] ?? "");
    if (!toolName) continue;
    return { toolName, raw: match[0]!.trim() };
  }
  return undefined;
}

function resolveKnownToolName(raw: string): string | undefined {
  const lower = raw.trim().toLowerCase();
  return KNOWN_TOOL_NAMES.find((name) => name === lower);
}

export function formatPseudoToolRepairPrompt(
  marker: PseudoToolMarker,
  language: string,
): string {
  if (language === "en") {
    return [
      `You printed a prose marker ${marker.raw}. That is not a tool call; no file was written.`,
      `Call the native ${marker.toolName} tool now with complete arguments.`,
      "Do not print a prose marker such as （tool_…） or (tool_…).",
    ].join(" ");
  }
  return [
    `你刚才在正文里写了「${marker.raw}」，这不是工具调用，设定文件没有改写。`,
    `请立刻用系统提供的原生工具调用 ${marker.toolName}，带上完整参数。`,
    "不要再在正文里书写（tool_…）这类标记。",
  ].join("");
}

export function formatPseudoToolFailureMessage(
  marker: PseudoToolMarker,
  language: string,
): string {
  if (language === "en") {
    return `The model printed ${marker.raw} as plain text and never called ${marker.toolName}, so no canon/truth file was written. Retry; if it happens again, switch to a model that supports native tool calls.`;
  }
  return `模型在正文里写了「${marker.raw}」，没有发起真正的 ${marker.toolName} 工具调用，设定文件尚未写入。请重试；如果仍失败，请换一个支持原生工具调用的模型。`;
}
