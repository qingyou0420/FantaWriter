import {
  CHARACTER_STATE_KEEP,
  type CharacterStateLedger,
  type CharacterStateNote,
} from "./types";

function extractJsonObject(text: string): string {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  return raw;
}

export type CharacterStateDelta = {
  name: string;
  location?: string;
  injury?: string;
  relationsDelta?: string;
  addressDelta?: string;
  goal?: string;
};

export function formatStateDeltaNote(delta: CharacterStateDelta): string {
  const parts = [
    delta.location && `位置：${delta.location}`,
    delta.injury && `伤势：${delta.injury}`,
    delta.relationsDelta && `关系：${delta.relationsDelta}`,
    delta.addressDelta && `称呼：${delta.addressDelta}`,
    delta.goal && `目标：${delta.goal}`,
  ].filter(Boolean) as string[];
  return parts.join("；");
}

export function parseCharacterStatesAppendix(text: string): CharacterStateDelta[] {
  const raw = String(text || "").trim();
  if (!raw) return [];
  try {
    const data = JSON.parse(extractJsonObject(raw)) as {
      states?: unknown;
    };
    if (!Array.isArray(data.states)) return [];
    return data.states
      .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === "object"))
      .map((s) => ({
        name: String(s.name || "").trim(),
        location: s.location ? String(s.location).trim() : undefined,
        injury: s.injury ? String(s.injury).trim() : undefined,
        relationsDelta: s.relationsDelta
          ? String(s.relationsDelta).trim()
          : undefined,
        addressDelta: s.addressDelta ? String(s.addressDelta).trim() : undefined,
        goal: s.goal ? String(s.goal).trim() : undefined,
      }))
      .filter((s) => s.name);
  } catch {
    return [];
  }
}

export function stripCharacterStatesAppendix(text: string): string {
  const raw = String(text || "");
  let start = raw.lastIndexOf("{");
  while (start >= 0) {
    const candidate = raw.slice(start);
    try {
      const data = JSON.parse(extractJsonObject(candidate)) as {
        states?: unknown;
      };
      if (Array.isArray(data.states)) {
        return raw.slice(0, start).replace(/```(?:json)?\s*$/i, "").trim();
      }
    } catch {
      /* 继续往前找带 states 的对象 */
    }
    start = raw.lastIndexOf("{", start - 1);
  }
  return raw.trim();
}

export function mergeCharacterStates(
  existing: CharacterStateLedger | undefined,
  chapterOrder: number,
  deltas: CharacterStateDelta[],
  keep = CHARACTER_STATE_KEEP
): CharacterStateLedger {
  const next: CharacterStateLedger = { ...(existing || {}) };
  for (const delta of deltas) {
    const name = delta.name.trim();
    if (!name) continue;
    const note = formatStateDeltaNote(delta) || Object.values(delta)
      .filter((v) => typeof v === "string" && v && v !== name)
      .join("；");
    if (!note) continue;
    const row: CharacterStateNote = { chapterOrder, note };
    const prev = next[name] || [];
    next[name] = [...prev, row].slice(-keep);
  }
  return next;
}

export function formatCharacterStateLedger(
  ledger: CharacterStateLedger | undefined,
  names: string[],
  latest = 3
): string {
  if (!ledger) return "";
  const lines: string[] = [];
  for (const name of names) {
    const rows = (ledger[name] || []).slice(-latest);
    for (const row of rows) {
      lines.push(`第${row.chapterOrder}章 ${name}：${row.note}`);
    }
  }
  return lines.join("\n");
}
