import { describe, expect, it } from "vitest";
import {
  allowsWholeBookGenerate,
  evaluateRenewalSave,
  persistResultFromVerdict,
} from "./renewal";
import { createEmptyProject, type LockedCanonFact } from "./types";

const LOCK: LockedCanonFact = {
  id: "lock-1",
  name: "霜桥",
  kind: "place",
  statement: "北城外石桥，不是人，不是角色",
  locked: true,
};

describe("allowsWholeBookGenerate", () => {
  it("keeps from-scratch books eligible for BookGenerationJob", () => {
    expect(allowsWholeBookGenerate(createEmptyProject("从零"))).toBe(true);
  });

  it("disables one-click whole book/volume when original text is mounted", () => {
    const p = createEmptyProject("焕新");
    p.original = {
      title: "旧稿",
      sourceLabel: "粘贴导入",
      text: "北城门破。行人甲走上霜桥。",
      updatedAt: "",
    };
    expect(allowsWholeBookGenerate(p)).toBe(false);
  });
});

describe("焕新-mode blocked save", () => {
  it("blocks persist when generated text contradicts locked canon", () => {
    const p = createEmptyProject("焕新");
    p.original = {
      title: "旧稿",
      sourceLabel: "粘贴导入",
      text: "霜桥横在北城外。",
      updatedAt: "",
    };
    const text = "霜桥不是桥，霜桥是人，她站在城门口。";
    const verdict = evaluateRenewalSave(text, {
      original: p.original,
      canon: [LOCK],
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.violations.some((v) => v.includes("霜桥"))).toBe(true);
    expect(persistResultFromVerdict(verdict).ok).toBe(false);
  });

  it("allows force-save-and-warn", () => {
    const p = createEmptyProject("焕新");
    p.original = {
      title: "旧稿",
      sourceLabel: "粘贴导入",
      text: "霜桥横在北城外。",
      updatedAt: "",
    };
    const text = "霜桥不是桥，霜桥是人。";
    const verdict = evaluateRenewalSave(text, {
      original: p.original,
      canon: [LOCK],
      force: true,
    });
    expect(verdict.allowed).toBe(true);
    expect(verdict.violations.length).toBeGreaterThan(0);
  });

  it("does not block from-scratch projects", () => {
    const verdict = evaluateRenewalSave("霜桥是人。", {
      original: null,
      canon: [LOCK],
    });
    expect(verdict.allowed).toBe(true);
  });
});
