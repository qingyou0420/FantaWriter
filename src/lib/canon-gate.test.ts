import { describe, expect, it } from "vitest";
import {
  applyCanonProposal,
  createCanonConfirmation,
  enqueueCanonDraft,
  markAuthorCanonEdit,
  pendingCanonProposals,
  proposalFromCanonDraft,
  proposalFromOutline,
  proposalWithEditedAfters,
  rejectCanonProposal,
} from "./canon-gate";
import { createEmptyProject, type Outline } from "./types";

describe("canon write gate", () => {
  it("refuses AI canon writes without confirmation", () => {
    const project = createEmptyProject("闸");
    const outline: Outline = {
      premise: "新前提",
      endingNote: "",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "s",
          keyPoints: "",
          tags: [],
        },
      ],
    };
    const proposal = proposalFromOutline({
      kind: "outline",
      before: project.outline,
      after: outline,
    });
    expect(() =>
      applyCanonProposal(project, proposal, { token: "forged", acceptedAt: "" })
    ).toThrow(/CANON_WRITE_REQUIRES_CONFIRMATION/);
    expect(project.outline).toBeNull();
  });

  it("applies only after a live confirmation token", () => {
    const project = createEmptyProject("闸");
    const outline: Outline = {
      premise: "确认后的前提",
      endingNote: "尾",
      chapters: [
        {
          id: "c-ok",
          order: 1,
          title: "开篇",
          summary: "上路",
          keyPoints: "",
          tags: [],
        },
      ],
    };
    const proposal = proposalFromOutline({
      kind: "outline",
      before: project.outline,
      after: outline,
    });
    const confirm = createCanonConfirmation();
    const next = applyCanonProposal(project, proposal, confirm);
    expect(next.outline?.premise).toBe("确认后的前提");
    expect(next.outline?.chapters[0].id).toBe("c-ok");
    expect(next.outlineTree?.[0].acts[0].sections[0].chapters[0].chapterId).toBe(
      "c-ok"
    );
    expect(() => applyCanonProposal(project, proposal, confirm)).toThrow(
      /CANON_WRITE_REQUIRES_CONFIRMATION/
    );
  });

  it("persists the full proposal on the draft so refresh can reopen the gate", () => {
    const project = createEmptyProject("刷新");
    const outline: Outline = {
      premise: "花钱生成的大纲",
      endingNote: "",
      chapters: [
        {
          id: "c-keep",
          order: 1,
          title: "开篇",
          summary: "上路",
          keyPoints: "",
          tags: [],
        },
      ],
    };
    const proposal = proposalFromOutline({
      kind: "outline",
      before: project.outline,
      after: outline,
    });
    const stored = enqueueCanonDraft(project, proposal);
    expect(stored.canonDrafts?.[0].patch).toBeTruthy();
    const reopened = proposalFromCanonDraft(stored.canonDrafts![0]);
    expect(reopened?.patch.outline?.premise).toBe("花钱生成的大纲");
    expect(pendingCanonProposals(stored)).toHaveLength(1);
    const rejected = rejectCanonProposal(stored, reopened!);
    expect(pendingCanonProposals(rejected)).toHaveLength(0);
  });

  it("edit-then-write applies field-level after values", () => {
    const project = createEmptyProject("编辑");
    const proposal = proposalFromOutline({
      kind: "outline",
      before: project.outline,
      after: {
        premise: "原稿",
        endingNote: "",
        chapters: [],
      },
    });
    const edited = proposalWithEditedAfters(proposal, {
      "outline.premise": "作者改过的前提",
    });
    expect(edited.patch.outline?.premise).toBe("作者改过的前提");
    const next = applyCanonProposal(project, edited, createCanonConfirmation());
    expect(next.outline?.premise).toBe("作者改过的前提");
  });

  it("author edits do not need a token", () => {
    const project = createEmptyProject("手改");
    const marked = markAuthorCanonEdit({
      ...project,
      premiseCard: {
        premise: "手写前提",
        theme: "",
        endingDirection: "",
        forbidList: [],
      },
    });
    expect(marked.lastAuthorCanonEditAt).toBeTruthy();
    expect(marked.premiseCard?.premise).toBe("手写前提");
  });
});
