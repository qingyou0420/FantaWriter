"use client";

import { useState } from "react";
import { AiBox } from "@/components/AiBox";
import { Field } from "@/components/Field";
import { postGenerate } from "@/lib/api";
import type {
  Character,
  LockedCanonFact,
  OriginalManuscript,
  StoryBackground,
  WritingBoard,
} from "@/lib/types";

export function BackgroundPanel({
  background,
  characters,
  writingBoard = "general",
  original,
  canon,
  onChange,
  onError,
}: {
  background: StoryBackground;
  characters: Character[];
  writingBoard?: WritingBoard;
  original?: OriginalManuscript | null;
  canon?: LockedCanonFact[];
  onChange: (
    b: StoryBackground | ((prev: StoryBackground) => StoryBackground)
  ) => void;
  onError: (msg: string) => void;
}) {
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState(false);

  function patch(partial: Partial<StoryBackground>) {
    onChange((prev) => ({ ...prev, ...partial }));
  }

  async function expand() {
    const idea =
      seed.trim() ||
      [background.title, background.synopsis, background.setting]
        .filter(Boolean)
        .join("\n");
    if (!idea) {
      onError("请先写一句故事灵感，或填写标题/梗概草稿后再让 AI 扩写");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const data = await postGenerate({
        mode: "expand_background",
        writingBoard,
        seed: idea,
        background,
        characters,
        original,
        canon,
      });
      onChange(data.background as StoryBackground);
      setSeed("");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function optimize() {
    const hasAny = Object.values(background).some((v) => String(v || "").trim());
    if (!hasAny && !seed.trim()) {
      onError("背景几乎为空，请先输入一句灵感再点「AI 扩写」");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const data = await postGenerate({
        mode: hasAny ? "optimize_background" : "expand_background",
        writingBoard,
        seed: seed.trim(),
        background,
        characters,
        instruction: seed.trim() || undefined,
        original,
        canon,
      });
      onChange(data.background as StoryBackground);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-4xl">
      <h2 className="card-title">故事背景</h2>

      <AiBox
        title="扩写 / 优化故事背景"
        hint="一句话梗概即可；生成后写入下方各栏，可继续手工修改，也可再次优化。"
        seed={seed}
        onSeedChange={setSeed}
        busy={busy}
        primaryLabel="AI 扩写背景"
        onPrimary={expand}
        secondaryLabel="AI 优化当前草稿"
        onSecondary={optimize}
      />

      <Field label="故事标题">
        <input
          value={background.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </Field>
      <Field label="故事梗概">
        <textarea
          value={background.synopsis}
          onChange={(e) => patch({ synopsis: e.target.value })}
          rows={5}
        />
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="时代">
          <input
            value={background.era}
            onChange={(e) => patch({ era: e.target.value })}
          />
        </Field>
        <Field label="基调">
          <input
            value={background.tone}
            onChange={(e) => patch({ tone: e.target.value })}
          />
        </Field>
      </div>
      <Field label="世界 / 场景设定">
        <textarea
          value={background.setting}
          onChange={(e) => patch({ setting: e.target.value })}
          rows={3}
        />
      </Field>
      <Field
        label="主题"
        hint="此栏会注入。你只给自己看的主题一句，请写在前提卡。"
      >
        <input
          value={background.themes}
          onChange={(e) => patch({ themes: e.target.value })}
        />
      </Field>
      <Field label="补充说明">
        <textarea
          value={background.extra}
          onChange={(e) => patch({ extra: e.target.value })}
          rows={3}
        />
      </Field>
    </div>
  );
}
