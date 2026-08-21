import { extractJsonObject } from "./prompts";
import { createEmptyLoreEntry } from "./lore";
import { mergeCanonFacts } from "./original";
import {
  createEmptyCanonFact,
  createEmptyCharacter,
  createEmptyPlotThread,
  defaultVolumeId,
  type CanonKind,
  type ChapterContent,
  type ChapterScene,
  type Character,
  type LockedCanonFact,
  type LoreEntry,
  type NovelProject,
  type OutlineChapter,
  type PlotThread,
  type PlotThreadKind,
  type Volume,
} from "./types";

export const SKELETON_UNKNOWN = "待补充";

export type SkeletonEntityKind =
  | "person"
  | "place"
  | "item"
  | "mount"
  | "other";

export interface SkeletonCharacter {
  name: string;
  role: string;
  relationships: string;
  notes: string;
  aliases?: string[];
  entityKind: SkeletonEntityKind;
  /** 原文身份说明；地点/器物/坐骑必须写明 */
  statement: string;
}

export interface SkeletonItem {
  name: string;
  statement: string;
  aliases?: string[];
}

export interface SkeletonBeat {
  order: number;
  title: string;
  summary: string;
  verbatimAnchors?: string[];
}

export interface SkeletonChapter {
  order: number;
  title: string;
  summary: string;
  keyPoints: string;
  volumeTitle?: string;
  castNames?: string[];
  beats: SkeletonBeat[];
}

export interface StorySkeleton {
  origin: string;
  mainLine: string;
  subLines: string[];
  foreshadows: string[];
  darkLines: string[];
  characters: SkeletonCharacter[];
  relationships: string;
  timeline: string;
  world: string;
  items: SkeletonItem[];
  volumes: { title: string; summary: string }[];
  chapters: SkeletonChapter[];
  unknowns: string[];
}

const ENTITY_KINDS: SkeletonEntityKind[] = [
  "person",
  "place",
  "item",
  "mount",
  "other",
];

const NON_PERSON_HINT =
  /地点|地名|城门|渡口|器物|物品|坐骑|战马|马匹|非人|不是人|不是角色|山川|庙宇|兵器|信物|不是人物/;

function textOrUnknown(value: unknown): string {
  const s = String(value || "").trim();
  return s || SKELETON_UNKNOWN;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v || "").trim()).filter(Boolean);
}

function resolveEntityKind(
  raw: unknown,
  statement: string
): SkeletonEntityKind {
  if (ENTITY_KINDS.includes(raw as SkeletonEntityKind)) {
    return raw as SkeletonEntityKind;
  }
  if (NON_PERSON_HINT.test(statement)) {
    if (/地点|地名|城门|渡口|山川|庙宇/.test(statement)) return "place";
    if (/坐骑|战马|马匹/.test(statement)) return "mount";
    if (/器物|物品|兵器|信物/.test(statement)) return "item";
    return "other";
  }
  return "person";
}

export function isNonPersonEntity(entry: {
  entityKind?: string;
  statement?: string;
  name?: string;
}): boolean {
  const kind = entry.entityKind;
  if (kind && kind !== "person") return true;
  return NON_PERSON_HINT.test(
    `${entry.name || ""} ${entry.statement || ""}`
  );
}

export function createEmptySkeleton(): StorySkeleton {
  return {
    origin: SKELETON_UNKNOWN,
    mainLine: SKELETON_UNKNOWN,
    subLines: [],
    foreshadows: [],
    darkLines: [],
    characters: [],
    relationships: SKELETON_UNKNOWN,
    timeline: SKELETON_UNKNOWN,
    world: SKELETON_UNKNOWN,
    items: [],
    volumes: [],
    chapters: [],
    unknowns: [],
  };
}

export function parseStorySkeleton(text: string): StorySkeleton {
  const data = JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
  const characters = Array.isArray(data.characters)
    ? data.characters
        .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === "object"))
        .map((c) => {
          const statement = textOrUnknown(c.statement || c.notes);
          return {
            name: String(c.name || "").trim(),
            role: textOrUnknown(c.role),
            relationships: textOrUnknown(c.relationships),
            notes: textOrUnknown(c.notes),
            aliases: stringList(c.aliases),
            entityKind: resolveEntityKind(c.entityKind || c.kind, statement),
            statement,
          } satisfies SkeletonCharacter;
        })
        .filter((c) => c.name)
    : [];
  const items = Array.isArray(data.items)
    ? data.items
        .filter((it): it is Record<string, unknown> => Boolean(it && typeof it === "object"))
        .map((it) => ({
          name: String(it.name || "").trim(),
          statement: textOrUnknown(it.statement),
          aliases: stringList(it.aliases),
        }))
        .filter((it) => it.name)
    : [];
  const chapters = Array.isArray(data.chapters)
    ? data.chapters
        .filter((ch): ch is Record<string, unknown> => Boolean(ch && typeof ch === "object"))
        .map((ch, i) => {
          const beats = Array.isArray(ch.beats)
            ? ch.beats
                .filter((b): b is Record<string, unknown> => Boolean(b && typeof b === "object"))
                .map((b, j) => ({
                  order: Number(b.order) || j + 1,
                  title: textOrUnknown(b.title),
                  summary: textOrUnknown(b.summary),
                  verbatimAnchors: stringList(b.verbatimAnchors),
                }))
            : [];
          return {
            order: Number(ch.order) || i + 1,
            title: textOrUnknown(ch.title),
            summary: textOrUnknown(ch.summary),
            keyPoints: textOrUnknown(ch.keyPoints),
            volumeTitle: String(ch.volumeTitle || "").trim() || undefined,
            castNames: stringList(ch.castNames),
            beats,
          } satisfies SkeletonChapter;
        })
    : [];
  const volumes = Array.isArray(data.volumes)
    ? data.volumes
        .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === "object"))
        .map((v) => ({
          title: textOrUnknown(v.title),
          summary: textOrUnknown(v.summary),
        }))
        .filter((v) => v.title && v.title !== SKELETON_UNKNOWN)
    : [];
  const unknowns = stringList(data.unknowns);
  if (!unknowns.length) {
    const gaps = [
      data.origin,
      data.mainLine,
      data.relationships,
      data.timeline,
      data.world,
    ].filter((v) => !String(v || "").trim());
    if (gaps.length) unknowns.push(SKELETON_UNKNOWN);
  }
  return {
    origin: textOrUnknown(data.origin),
    mainLine: textOrUnknown(data.mainLine),
    subLines: stringList(data.subLines),
    foreshadows: stringList(data.foreshadows),
    darkLines: stringList(data.darkLines),
    characters,
    relationships: textOrUnknown(data.relationships),
    timeline: textOrUnknown(data.timeline),
    world: textOrUnknown(data.world),
    items,
    volumes,
    chapters,
    unknowns,
  };
}

export function buildExtractSkeletonUserPrompt(opts: {
  sampleText: string;
  titleHint?: string;
}): string {
  return `请从下列原作正文中抽取「故事骨架」，供后续按拍扩写。这不是从零编大纲。
硬性：
1. 只写原文已经写明的情节、关系、事实；原文没写的一律填「${SKELETON_UNKNOWN}」，禁止脑补、禁止圆谎。
2. 名称若是地点、器物、坐骑或其他非人存在，statement 必须写明原文身份（例如「北城城门，地点而非角色」），不得当成人物。
3. 关键物品单独列入 items，并在 statement 写明它是物品/器物。
4. 暗线是读者尚不应知道的线索；没有就空数组。
5. 原句锚点 verbatimAnchors 只摘必须原样保留的短句，没有就空数组。
6. 不要发明人名、地名、卷名、章拍。

## 原作标题提示
${opts.titleHint || "（未命名）"}

## 原作采样
${opts.sampleText}

## 输出 JSON（不要 markdown）
{
  "origin": "来龙去脉，原文没写明则写${SKELETON_UNKNOWN}",
  "mainLine": "主线",
  "subLines": ["支线"],
  "foreshadows": ["伏笔"],
  "darkLines": ["暗线"],
  "characters": [
    {
      "name": "名称",
      "role": "定位",
      "relationships": "与他人关系",
      "notes": "原文依据",
      "entityKind": "person|place|item|mount|other",
      "statement": "原文身份；地点/器物/坐骑必须写明",
      "aliases": []
    }
  ],
  "relationships": "关系网",
  "timeline": "时间线",
  "world": "世界观",
  "items": [{ "name": "物品名", "statement": "须写明是物品/器物", "aliases": [] }],
  "volumes": [{ "title": "卷名", "summary": "该卷原文弧线" }],
  "chapters": [
    {
      "order": 1,
      "title": "章题",
      "summary": "本章原文事件",
      "keyPoints": "分号分隔的情节点",
      "volumeTitle": "",
      "castNames": [],
      "beats": [
        { "order": 1, "title": "节拍", "summary": "本拍事件", "verbatimAnchors": [] }
      ]
    }
  ],
  "unknowns": ["原文没写清、需要作者补的缺口"]
}`;
}

function upsertLore(
  lore: LoreEntry[],
  title: string,
  body: string,
  category: LoreEntry["category"],
  keys: string[]
): LoreEntry[] {
  const name = title.trim();
  if (!name || body === SKELETON_UNKNOWN) return lore;
  const idx = lore.findIndex((e) => e.title.trim() === name);
  if (idx >= 0) {
    const next = [...lore];
    next[idx] = {
      ...next[idx],
      body: next[idx].body?.trim() ? next[idx].body : body,
      keys: Array.from(new Set([...(next[idx].keys || []), ...keys, name])),
      category: next[idx].category || category,
      enabled: true,
    };
    return next;
  }
  return [
    ...lore,
    {
      ...createEmptyLoreEntry(name),
      body,
      keys: Array.from(new Set([...keys, name])),
      category,
      enabled: true,
    },
  ];
}

function threadFromLine(
  title: string,
  kind: PlotThreadKind,
  existing: PlotThread[]
): PlotThread | null {
  const name = title.trim();
  if (!name || name === SKELETON_UNKNOWN) return null;
  if (existing.some((t) => t.title.trim() === name)) return null;
  return {
    ...createEmptyPlotThread(name),
    note: kind === "dark" ? "暗线（仅作者可见，正文不得提前泄漏）" : "",
    kind,
    visibility: kind === "dark" ? "author_only" : "reader_known",
    status: kind === "foreshadow" || kind === "dark" ? "planted" : "active",
  };
}

function canonForNamedFact(
  name: string,
  statement: string,
  kind: CanonKind,
  aliases?: string[]
): LockedCanonFact | null {
  if (!name.trim() || !statement.trim() || statement === SKELETON_UNKNOWN) {
    return null;
  }
  return {
    ...createEmptyCanonFact(name.trim(), statement.trim(), kind),
    aliases: aliases || [],
  };
}

function mergeCharacter(
  existing: Character[],
  incoming: SkeletonCharacter
): Character[] {
  const name = incoming.name.trim();
  const idx = existing.findIndex((c) => c.name.trim() === name);
  const patch: Partial<Character> = {
    name,
    role: incoming.role === SKELETON_UNKNOWN ? "" : incoming.role,
    relationships:
      incoming.relationships === SKELETON_UNKNOWN ? "" : incoming.relationships,
    notes: incoming.notes === SKELETON_UNKNOWN ? "" : incoming.notes,
    aliases: incoming.aliases || [],
  };
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = {
      ...next[idx],
      role: next[idx].role || patch.role || "",
      relationships: next[idx].relationships || patch.relationships || "",
      notes: next[idx].notes || patch.notes || "",
      aliases: Array.from(
        new Set([...(next[idx].aliases || []), ...(patch.aliases || [])])
      ),
    };
    return next;
  }
  return [
    ...existing,
    {
      ...createEmptyCharacter(),
      ...patch,
      role: patch.role || "",
    },
  ];
}

function volumeIdForTitle(
  volumes: Volume[],
  title: string | undefined,
  projectId: string
): string {
  if (title) {
    const hit = volumes.find((v) => v.title.trim() === title.trim());
    if (hit) return hit.id;
  }
  return volumes[0]?.id || defaultVolumeId(projectId);
}

/**
 * 把人审过的骨架写入既有项目字段。不另存一份平行真相。
 * 不覆盖已有正文；同名条目合并；模型不得整表替换 canon。
 */
export function mapSkeletonToProject(
  project: NovelProject,
  skeleton: StorySkeleton
): NovelProject {
  let characters = [...(project.characters || [])];
  let lore = [...(project.lore || [])];
  const proposedCanon: LockedCanonFact[] = [];

  for (const entry of skeleton.characters) {
    if (isNonPersonEntity(entry)) {
      const category: LoreEntry["category"] =
        entry.entityKind === "place"
          ? "place"
          : entry.entityKind === "item" || entry.entityKind === "mount"
            ? "item"
            : "other";
      lore = upsertLore(
        lore,
        entry.name,
        entry.statement,
        category,
        entry.aliases || []
      );
      const fact = canonForNamedFact(
        entry.name,
        entry.statement,
        category === "place" ? "place" : "item",
        entry.aliases
      );
      if (fact) proposedCanon.push(fact);
      continue;
    }
    characters = mergeCharacter(characters, entry);
  }

  for (const item of skeleton.items) {
    lore = upsertLore(
      lore,
      item.name,
      item.statement,
      "item",
      item.aliases || []
    );
    const fact = canonForNamedFact(
      item.name,
      item.statement,
      "item",
      item.aliases
    );
    if (fact) proposedCanon.push(fact);
  }

  if (skeleton.world && skeleton.world !== SKELETON_UNKNOWN) {
    lore = upsertLore(lore, "世界观", skeleton.world, "rule", ["世界观"]);
  }
  if (skeleton.timeline && skeleton.timeline !== SKELETON_UNKNOWN) {
    lore = upsertLore(lore, "时间线", skeleton.timeline, "other", ["时间线"]);
  }

  const threads = [...(project.plotThreads || [])];
  const addThread = (line: string, kind: PlotThreadKind) => {
    const t = threadFromLine(line, kind, threads);
    if (t) threads.push(t);
  };
  if (skeleton.mainLine && skeleton.mainLine !== SKELETON_UNKNOWN) {
    addThread(skeleton.mainLine, "main");
  }
  for (const line of skeleton.subLines) addThread(line, "sub");
  for (const line of skeleton.foreshadows) addThread(line, "foreshadow");
  for (const line of skeleton.darkLines) addThread(line, "dark");

  const volumes = [...(project.volumes || [])];
  if (skeleton.volumes.length) {
    for (const vol of skeleton.volumes) {
      const idx = volumes.findIndex((v) => v.title.trim() === vol.title.trim());
      if (idx >= 0) {
        volumes[idx] = {
          ...volumes[idx],
          summary: volumes[idx].summary?.trim()
            ? volumes[idx].summary
            : vol.summary === SKELETON_UNKNOWN
              ? volumes[idx].summary
              : vol.summary,
        };
      } else {
        volumes.push({
          id: `${project.id}:vol:${volumes.length + 1}`,
          order: volumes.length + 1,
          title: vol.title,
          summary: vol.summary === SKELETON_UNKNOWN ? "" : vol.summary,
        });
      }
    }
  }

  const premise =
    skeleton.origin !== SKELETON_UNKNOWN
      ? skeleton.origin
      : skeleton.mainLine !== SKELETON_UNKNOWN
        ? skeleton.mainLine
        : project.outline?.premise || "";

  const outlineChapters: OutlineChapter[] = skeleton.chapters.length
    ? skeleton.chapters.map((ch, i) => {
        const old = (project.outline?.chapters || []).find(
          (c) => c.order === ch.order
        );
        const castIds = (ch.castNames || [])
          .map((name) => characters.find((c) => c.name.trim() === name.trim())?.id)
          .filter((id): id is string => Boolean(id));
        return {
          id: old?.id || crypto.randomUUID(),
          volumeId: volumeIdForTitle(volumes, ch.volumeTitle, project.id),
          order: ch.order || i + 1,
          title: ch.title === SKELETON_UNKNOWN ? old?.title || `第${i + 1}章` : ch.title,
          summary: ch.summary === SKELETON_UNKNOWN ? old?.summary || "" : ch.summary,
          keyPoints:
            ch.keyPoints === SKELETON_UNKNOWN ? old?.keyPoints || "" : ch.keyPoints,
          intensityNote: old?.intensityNote || "",
          tags: old?.tags || [],
          castIds: castIds.length ? castIds : old?.castIds || [],
        };
      })
    : project.outline?.chapters || [];

  const chapters: ChapterContent[] = [...(project.chapters || [])];
  for (const ch of outlineChapters) {
    const sk = skeleton.chapters.find((s) => s.order === ch.order);
    const beats = sk?.beats || [];
    const idx = chapters.findIndex((c) => c.chapterId === ch.id);
    const scenes: ChapterScene[] | undefined = beats.length
      ? beats.map((b, i) => ({
          id: crypto.randomUUID(),
          order: b.order || i + 1,
          title: b.title === SKELETON_UNKNOWN ? `节拍${i + 1}` : b.title,
          summary: b.summary === SKELETON_UNKNOWN ? "" : b.summary,
          verbatimAnchors: b.verbatimAnchors?.length
            ? b.verbatimAnchors
            : undefined,
          status: "pending" as const,
        }))
      : undefined;
    const base: ChapterContent =
      idx >= 0
        ? chapters[idx]
        : {
            chapterId: ch.id,
            title: ch.title,
            content: "",
            status: "idle",
            updatedAt: new Date().toISOString(),
          };
    const next: ChapterContent = {
      ...base,
      title: ch.title,
      scenes: base.content?.trim()
        ? base.scenes?.length
          ? base.scenes
          : scenes
        : scenes || base.scenes,
    };
    if (idx >= 0) chapters[idx] = next;
    else chapters.push(next);
  }

  const extraBits = [
    project.background.extra,
    skeleton.relationships !== SKELETON_UNKNOWN
      ? `关系网：${skeleton.relationships}`
      : "",
    skeleton.timeline !== SKELETON_UNKNOWN ? `时间线：${skeleton.timeline}` : "",
  ]
    .filter(Boolean)
    .filter((line, i, arr) => arr.indexOf(line) === i);

  return {
    ...project,
    characters,
    lore,
    canon: mergeCanonFacts(project.canon || [], proposedCanon),
    plotThreads: threads,
    volumes,
    background: {
      ...project.background,
      synopsis:
        project.background.synopsis.trim() ||
        (skeleton.origin !== SKELETON_UNKNOWN ? skeleton.origin : ""),
      setting:
        project.background.setting.trim() ||
        (skeleton.world !== SKELETON_UNKNOWN ? skeleton.world : ""),
      extra: extraBits.join("\n"),
    },
    outline: {
      premise: premise || project.outline?.premise || "",
      endingNote: project.outline?.endingNote || "",
      chapters: outlineChapters,
      raw: project.outline?.raw,
    },
    chapters,
  };
}
