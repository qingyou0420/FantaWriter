import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { StudioShortContentKind, StudioShortDetail, StudioShortStatus, StudioShortSummary } from "../shared/short-works.js";
import { isSafeBookId } from "./safety.js";

export type { StudioShortContentKind, StudioShortDetail, StudioShortStatus, StudioShortSummary };

const MANUSCRIPT_CANDIDATES = [
  { relative: "final/full.md", kind: "manuscript" as const },
  { relative: "drafts/v002/full.md", kind: "draft" as const },
  { relative: "drafts/v001/full.md", kind: "draft" as const },
  { relative: "drafts/v001-partial/full.md", kind: "draft" as const },
  { relative: "outline/v002.md", kind: "outline" as const },
  { relative: "outline/v001.md", kind: "outline" as const },
] as const;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function resolveManuscript(
  root: string,
  storyId: string,
): Promise<{ readonly path: string; readonly kind: StudioShortContentKind } | undefined> {
  for (const candidate of MANUSCRIPT_CANDIDATES) {
    if (await fileExists(join(root, "shorts", storyId, candidate.relative))) {
      return { path: `shorts/${storyId}/${candidate.relative}`, kind: candidate.kind };
    }
  }
  return undefined;
}

function deriveStatus(
  snapshot: Record<string, unknown> | undefined,
  manuscriptKind: StudioShortContentKind | undefined,
): StudioShortStatus {
  if (stringField(snapshot, "status") === "failed") return "failed";
  if (manuscriptKind === "manuscript") return "completed";
  if (manuscriptKind === "draft") return "drafting";
  return "outlining";
}

async function loadShortSummary(root: string, storyId: string): Promise<StudioShortSummary | undefined> {
  if (!isSafeBookId(storyId)) return undefined;
  const baseDir = join(root, "shorts", storyId);
  const brief = await readJson(join(baseDir, "brief.json"));
  const snapshot = await readJson(join(baseDir, "status.json"));
  const manuscript = await resolveManuscript(root, storyId);
  if (!brief && !snapshot && !manuscript) return undefined;

  const coverRelative = "final/cover.png";
  const coverImagePath = await fileExists(join(baseDir, coverRelative))
    ? `shorts/${storyId}/${coverRelative}`
    : undefined;

  return {
    id: storyId,
    title: stringField(brief, "title") ?? stringField(snapshot, "id") ?? storyId,
    status: deriveStatus(snapshot, manuscript?.kind),
    stage: stringField(snapshot, "stage"),
    chapterCount: numberField(brief, "chapterCount"),
    manuscriptPath: manuscript?.path ?? `shorts/${storyId}`,
    ...(coverImagePath ? { coverImagePath } : {}),
    kind: "short",
  };
}

export async function listStudioShorts(root: string): Promise<StudioShortSummary[]> {
  let entries: string[] = [];
  try {
    const dirents = await readdir(join(root, "shorts"), { withFileTypes: true });
    entries = dirents.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return [];
  }

  const shorts: StudioShortSummary[] = [];
  for (const storyId of entries) {
    const summary = await loadShortSummary(root, storyId);
    if (summary) shorts.push(summary);
  }
  shorts.sort((left, right) => left.title.localeCompare(right.title, "zh"));
  return shorts;
}

export async function loadStudioShort(root: string, storyId: string): Promise<StudioShortDetail | undefined> {
  const summary = await loadShortSummary(root, storyId);
  if (!summary) return undefined;
  const manuscript = await resolveManuscript(root, storyId);
  const content = manuscript
    ? await readFile(join(root, manuscript.path), "utf-8")
    : "";
  return {
    ...summary,
    content,
    contentKind: manuscript?.kind ?? "outline",
  };
}
