import { describe, expect, it } from "vitest";
import {
  applySettleToProject,
  beginWriteRun,
  clearWriteLock,
  commitWriteRun,
  keepPartialDraft,
  markSettlePending,
  precheckWriteNext,
  recoverStaleWriteRuns,
  rollbackWriteRun,
} from "./write-pipeline";
import { createEmptyProject, type OutlineChapter } from "./types";

function seeded() {
  const p = createEmptyProject("管线");
  const ch: OutlineChapter = {
    id: "c1",
    order: 1,
    title: "一",
    summary: "上路",
    keyPoints: "",
    tags: [],
    hook: "谁在敲门",
    volumeId: p.volumes![0].id,
  };
  p.outline = { premise: "回家", endingNote: "", chapters: [ch] };
  p.premiseCard = {
    premise: "回家",
    theme: "",
    endingDirection: "",
    forbidList: [],
  };
  p.characters[0].name = "沈烬";
  p.chapters = [
    {
      chapterId: "c1",
      title: "一",
      content: "",
      status: "idle",
      updatedAt: "",
    },
  ];
  p.characterStates = { 沈烬: [{ chapterOrder: 0, note: "在城门" }] };
  p.plotThreads = [
    {
      id: "t1",
      title: "敲门",
      note: "",
      status: "planted",
      createdAt: "",
      updatedAt: "",
    },
  ];
  return p;
}

describe("write-next precheck", () => {
  it("blocks missing outline, api, lock, and running job", () => {
    const empty = createEmptyProject("空");
    expect(precheckWriteNext(empty, undefined).ok).toBe(false);
    const p = seeded();
    expect(precheckWriteNext(p, "c1", { hasApiKey: false }).ok).toBe(false);
    const locked = beginWriteRun(p, "c1");
    expect(precheckWriteNext(locked, "c1").ok).toBe(false);
    const withJob = {
      ...p,
      bookJob: {
        id: "j",
        status: "running" as const,
        items: [],
        currentChapterId: "c1",
        createdAt: "",
        updatedAt: "",
        mode: "missing" as const,
      },
    };
    expect(precheckWriteNext(withJob, "c1").ok).toBe(false);
  });

  it("warns but does not block a migrated book with empty intent", () => {
    const p = seeded();
    p.premiseCard = {
      premise: "",
      theme: "",
      endingDirection: "",
      forbidList: [],
    };
    p.outline = { ...p.outline!, premise: "" };
    const r = precheckWriteNext(p, "c1", { hasApiKey: true });
    expect(r.ok).toBe(true);
    expect(r.items.some((i) => i.id === "intent" && i.level === "warn")).toBe(
      true
    );
  });
});

describe("snapshot / rollback / settle", () => {
  it("rolls a failed draft back to the write-front snapshot", () => {
    let p = seeded();
    p.chapters[0].content = "旧正文";
    p = beginWriteRun(p, "c1");
    p = {
      ...p,
      chapters: p.chapters.map((c) =>
        c.chapterId === "c1" ? { ...c, content: "半章残稿" } : c
      ),
      characterStates: { 沈烬: [{ chapterOrder: 1, note: "不该留下" }] },
    };
    p = rollbackWriteRun(p, { error: "中止" });
    expect(p.chapters[0].content).toBe("旧正文");
    expect(p.characterStates?.["沈烬"]?.[0].note).toBe("在城门");
    expect(p.writeRuns?.[0].status).toBe("rolled_back");
  });

  it("keeps partial draft on model failure without restoring empty", () => {
    let p = seeded();
    p = beginWriteRun(p, "c1");
    p = keepPartialDraft(p, "c1", "流出的半章", "timeout");
    expect(p.chapters[0].content).toBe("流出的半章");
    expect(p.writeRuns?.[0].status).toBe("failed");
  });

  it("settle failure keeps body and marks settle_pending", () => {
    let p = seeded();
    p = beginWriteRun(p, "c1");
    p = {
      ...p,
      chapters: p.chapters.map((c) =>
        c.chapterId === "c1"
          ? { ...c, content: "完整正文", status: "done" }
          : c
      ),
    };
    p = markSettlePending(p, "摘要解析失败");
    expect(p.chapters[0].content).toBe("完整正文");
    expect(p.writeRuns?.[0].status).toBe("settle_pending");
  });

  it("settle writes summary, ledger, and touches threads", () => {
    let p = seeded();
    p = {
      ...p,
      chapters: p.chapters.map((c) =>
        c.chapterId === "c1" ? { ...c, content: "正文" } : c
      ),
    };
    p = applySettleToProject({
      project: p,
      chapterId: "c1",
      chapterOrder: 1,
      summary: "过了霜桥",
      deltas: [{ name: "沈烬", location: "南岸", injury: "左肩" }],
      touchedThreads: ["敲门"],
    });
    expect(p.chapters[0].summary).toBe("过了霜桥");
    expect(p.plotThreads?.[0].status).toBe("active");
    expect(JSON.stringify(p.characterStates)).toContain("南岸");
  });

  it("stale running lock is visible on reopen and can be cleared or rolled back", () => {
    let p = seeded();
    p = beginWriteRun(p, "c1");
    const { stale } = recoverStaleWriteRuns(p);
    expect(stale).toHaveLength(1);
    const cleared = clearWriteLock(p);
    expect(cleared.writeRuns?.[0].status).toBe("aborted");
    const rolled = rollbackWriteRun(p);
    expect(rolled.writeRuns?.[0].status).toBe("rolled_back");
  });

  it("commit closes the run", () => {
    let p = seeded();
    p = beginWriteRun(p, "c1");
    p = commitWriteRun(p);
    expect(p.writeRuns?.[0].status).toBe("committed");
    expect(precheckWriteNext(p, "c1", { hasApiKey: true }).ok).toBe(true);
  });
});
