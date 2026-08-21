import type { NovelProject, Outline } from "./types";

export type GlobalReplaceOptions = {
  replaceSummaries?: boolean;
  replaceOutline?: boolean;
};

export type GlobalReplaceReminder = {
  kind: "character" | "plot";
  label: string;
};

export function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = 0;
  while (true) {
    const j = hay.indexOf(needle, i);
    if (j < 0) break;
    n++;
    i = j + needle.length;
  }
  return n;
}

function replaceAll(text: string, find: string, replace: string): string {
  if (!find || !text.includes(find)) return text;
  return text.split(find).join(replace);
}

export function collectReplaceReminders(
  project: NovelProject,
  find: string
): GlobalReplaceReminder[] {
  if (!find) return [];
  const reminders: GlobalReplaceReminder[] = [];
  for (const c of project.characters || []) {
    const blob = [c.name, ...(c.aliases || []), c.notes, c.relationships].join(
      "\n"
    );
    if (blob.includes(find)) {
      reminders.push({
        kind: "character",
        label: c.name || "未命名人物",
      });
    }
  }
  for (const t of project.plotThreads || []) {
    if (`${t.title}\n${t.note}`.includes(find)) {
      reminders.push({ kind: "plot", label: t.title || "未命名伏笔" });
    }
  }
  return reminders;
}

export function applyGlobalReplace(
  project: NovelProject,
  find: string,
  replace: string,
  opts: GlobalReplaceOptions = {}
): {
  chapters: NovelProject["chapters"];
  outline: Outline | null;
  reminders: GlobalReplaceReminder[];
} {
  const chapters = (project.chapters || []).map((row) => {
    let next = row;
    if (row.content?.includes(find)) {
      next = { ...next, content: replaceAll(row.content, find, replace) };
    }
    if (opts.replaceSummaries && (row.summary || "").includes(find)) {
      next = { ...next, summary: replaceAll(row.summary || "", find, replace) };
    }
    return next;
  });

  let outline = project.outline;
  if (opts.replaceOutline && outline) {
    outline = {
      ...outline,
      premise: replaceAll(outline.premise || "", find, replace),
      endingNote: replaceAll(outline.endingNote || "", find, replace),
      chapters: outline.chapters.map((ch) => ({
        ...ch,
        title: replaceAll(ch.title || "", find, replace),
        summary: replaceAll(ch.summary || "", find, replace),
        keyPoints: replaceAll(ch.keyPoints || "", find, replace),
      })),
    };
  }

  return {
    chapters,
    outline: outline ?? null,
    reminders: collectReplaceReminders(project, find),
  };
}
