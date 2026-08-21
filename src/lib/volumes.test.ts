import { describe, expect, it } from "vitest";
import { createBookJob } from "./book-job";
import { buildMarkdownBook, buildTocPreview } from "./export-book";
import { createEmptyProject } from "./types";
import {
  addVolume,
  chaptersInVolume,
  chaptersGroupedByVolume,
  mergeVolumeChapters,
  removeVolume,
  volumeHasWrittenChapters,
} from "./volumes";

describe("volumes + per-volume job + export", () => {
  it("addVolume then chaptersInVolume and createBookJob respect volumeId", () => {
    const p = createEmptyProject("卷测", "general");
    p.outline = {
      premise: "p",
      endingNote: "e",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "s",
          keyPoints: "",
          eroticNote: "",
          tags: [],
          volumeId: p.volumes![0].id,
        },
        {
          id: "c2",
          order: 2,
          title: "二",
          summary: "s",
          keyPoints: "",
          eroticNote: "",
          tags: [],
        },
      ],
    };
    const vols = addVolume(p);
    expect(vols).toHaveLength(2);
    const v2 = vols[1];
    p.volumes = vols;
    p.outline.chapters[1].volumeId = v2.id;

    expect(chaptersInVolume(p, p.volumes![0].id).map((c) => c.id)).toEqual([
      "c1",
    ]);
    expect(chaptersInVolume(p, v2.id).map((c) => c.id)).toEqual(["c2"]);

    const job = createBookJob(p.outline.chapters, [], "missing", v2.id);
    expect(job.volumeId).toBe(v2.id);
    expect(job.items.map((i) => i.chapterId)).toEqual(["c2"]);
  });

  it("markdown export inserts volume headings", () => {
    const p = createEmptyProject("导出", "general");
    p.background.title = "测试书";
    p.volumes = [
      { id: "v1", order: 1, title: "上卷", summary: "" },
      { id: "v2", order: 2, title: "下卷", summary: "" },
    ];
    p.outline = {
      premise: "",
      endingNote: "",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "开端",
          summary: "",
          keyPoints: "",
          eroticNote: "",
          tags: [],
          volumeId: "v1",
        },
        {
          id: "c2",
          order: 2,
          title: "收束",
          summary: "",
          keyPoints: "",
          eroticNote: "",
          tags: [],
          volumeId: "v2",
        },
      ],
    };
    const md = buildMarkdownBook(p);
    expect(md).toContain("## 上卷");
    expect(md).toContain("## 下卷");
    expect(md.indexOf("## 上卷")).toBeLessThan(md.indexOf("开端"));
    expect(chaptersGroupedByVolume(p)).toHaveLength(2);
    expect(buildTocPreview(p).map((t) => t.volumeTitle)).toEqual([
      "上卷",
      "下卷",
    ]);
  });

  it("cannot remove the last volume", () => {
    const p = createEmptyProject("一卷", "general");
    const next = removeVolume(p, p.volumes![0].id);
    expect(next.volumes).toHaveLength(1);
  });

  it("mergeVolumeChapters stamps volumeId and inserts before later volumes", () => {
    const p = createEmptyProject("合并", "general");
    p.volumes = [
      { id: "v1", order: 1, title: "上", summary: "" },
      { id: "v2", order: 2, title: "中", summary: "" },
      { id: "v3", order: 3, title: "下", summary: "" },
    ];
    const existing = [
      {
        id: "c1",
        order: 1,
        title: "一",
        summary: "",
        keyPoints: "",
        tags: [],
        volumeId: "v1",
      },
      {
        id: "c9",
        order: 2,
        title: "末",
        summary: "",
        keyPoints: "",
        tags: [],
        volumeId: "v3",
      },
    ];
    const incoming = Array.from({ length: 3 }, (_, i) => ({
      id: `n${i}`,
      order: i + 1,
      title: `中${i + 1}`,
      summary: "s",
      keyPoints: "",
      tags: [],
    }));
    const merged = mergeVolumeChapters(existing, incoming, "v2", p.volumes);
    expect(merged.map((c) => c.volumeId)).toEqual([
      "v1",
      "v2",
      "v2",
      "v2",
      "v3",
    ]);
    expect(merged.every((c) => c.volumeId !== "v2" || c.title.startsWith("中"))).toBe(
      true
    );
    expect(merged[merged.length - 1].id).toBe("c9");
    expect(merged.map((c) => c.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("volumeHasWrittenChapters is true only when that volume has body text", () => {
    const p = createEmptyProject("有正文", "general");
    const volId = p.volumes![0].id;
    p.outline = {
      premise: "",
      endingNote: "",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "",
          keyPoints: "",
          tags: [],
          volumeId: volId,
        },
      ],
    };
    p.chapters = [
      {
        chapterId: "c1",
        title: "一",
        content: "",
        status: "idle",
        updatedAt: "",
      },
    ];
    expect(volumeHasWrittenChapters(p, volId)).toBe(false);
    p.chapters[0].content = "已写的一章正文";
    expect(volumeHasWrittenChapters(p, volId)).toBe(true);
  });
});
