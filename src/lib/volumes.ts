import {
  defaultVolumeId,
  type NovelProject,
  type OutlineChapter,
  type Volume,
} from "./types";

export function sortedVolumes(project: NovelProject): Volume[] {
  const vols = [...(project.volumes || [])].sort((a, b) => a.order - b.order);
  if (vols.length) return vols;
  return [
    {
      id: defaultVolumeId(project.id),
      order: 1,
      title: "第一卷",
      summary: "",
    },
  ];
}

export function chapterVolumeId(
  chapter: OutlineChapter,
  project: NovelProject
): string {
  return chapter.volumeId || sortedVolumes(project)[0].id;
}

export function chaptersInVolume(
  project: NovelProject,
  volumeId: string
): OutlineChapter[] {
  const chapters = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];
  return chapters.filter((c) => chapterVolumeId(c, project) === volumeId);
}

export function addVolume(project: NovelProject): Volume[] {
  const vols = sortedVolumes(project);
  const order = vols.reduce((m, v) => Math.max(m, v.order), 0) + 1;
  return [
    ...vols,
    {
      id: crypto.randomUUID(),
      order,
      title: `第 ${order} 卷`,
      summary: "",
    },
  ];
}

export function moveVolume(
  volumes: Volume[],
  id: string,
  dir: -1 | 1
): Volume[] {
  const sorted = [...volumes].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((v) => v.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return sorted;
  const next = [...sorted];
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  return next.map((v, idx) => ({ ...v, order: idx + 1 }));
}

export function removeVolume(
  project: NovelProject,
  volumeId: string
): { volumes: Volume[]; chapters: OutlineChapter[] } {
  const vols = sortedVolumes(project);
  if (vols.length <= 1) {
    return {
      volumes: vols,
      chapters: project.outline?.chapters || [],
    };
  }
  const nextVols = vols
    .filter((v) => v.id !== volumeId)
    .map((v, i) => ({ ...v, order: i + 1 }));
  const fallback = nextVols[0].id;
  const chapters = (project.outline?.chapters || []).map((c) =>
    chapterVolumeId(c, project) === volumeId
      ? { ...c, volumeId: fallback }
      : c
  );
  return { volumes: nextVols, chapters };
}

export function chaptersGroupedByVolume(project: NovelProject): {
  volume: Volume;
  chapters: OutlineChapter[];
}[] {
  return sortedVolumes(project).map((volume) => ({
    volume,
    chapters: chaptersInVolume(project, volume.id),
  }));
}
