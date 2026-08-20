"use client";

import { useState } from "react";
import { AiBox } from "@/components/AiBox";
import { Field } from "@/components/Field";
import { postGenerate } from "@/lib/api";
import { previewBuiltInSystem } from "@/lib/prompts/registry";
import {
  EROTIC_LEVEL_LABELS,
  LENGTH_LABELS,
  PERSON_LABELS,
  STYLE_LABELS,
  type Character,
  type EroticLevel,
  type GenerationSettings,
  type LearnedStyle,
  type NarrativePerson,
  type StoryBackground,
  type WritingStyle,
  type WritingBoard,
  type OriginalManuscript,
  type LockedCanonFact,
} from "@/lib/types";

export function SettingsPanel({
  settings,
  styleLibrary,
  characters,
  background,
  writingBoard = "erotic",
  original,
  canon,
  onChange,
  onApplyStyle,
  onClearStyle,
  onError,
}: {
  settings: GenerationSettings;
  styleLibrary: LearnedStyle[];
  characters: Character[];
  background: StoryBackground;
  onChange: (s: GenerationSettings) => void;
  onApplyStyle: (s: LearnedStyle) => void;
  onClearStyle: () => void;
  onError: (msg: string) => void;
  writingBoard?: WritingBoard;
  original?: OriginalManuscript | null;
  canon?: LockedCanonFact[];
}) {
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState(false);

  function patch(partial: Partial<GenerationSettings>) {
    onChange({ ...settings, ...partial });
  }

  async function optimizeSettings() {
    setBusy(true);
    onError("");
    try {
      const data = await postGenerate({
        mode: "optimize_settings",
        writingBoard,
        settings,
        characters,
        background,
        instruction: seed.trim() || undefined,
        original,
        canon,
      });
      onChange(data.settings as GenerationSettings);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-4xl">
      <h2 className="card-title">生成参数</h2>

      <AiBox
        title="根据设定优化生成参数"
        hint={
          writingBoard === "general"
            ? "结合人物与背景，智能推荐文风、人称、章节数与额外写作指令。"
            : "结合人物与背景，智能推荐尺度、文风、人称、章节数与额外写作指令。可先填偏好再点优化。"
        }
        seed={seed}
        onSeedChange={setSeed}
        busy={busy}
        primaryLabel="AI 优化参数"
        onPrimary={optimizeSettings}
      />

      {writingBoard === "erotic" ? (
        <Field label="色情尺度" hint={EROTIC_LEVEL_LABELS[settings.eroticLevel]}>
          <div className="level-track">
            {([1, 2, 3, 4, 5] as EroticLevel[]).map((n) => (
              <button
                key={n}
                type="button"
                className={`level-btn ${settings.eroticLevel === n ? "active" : ""}`}
                onClick={() => patch({ eroticLevel: n })}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="文笔文风">
          <select
            value={settings.writingStyle}
            onChange={(e) => {
              const v = e.target.value as WritingStyle;
              if (v === "learned") {
                if (settings.learnedStyleGuide) {
                  patch({ writingStyle: "learned" });
                } else if (styleLibrary[0]) {
                  onApplyStyle(styleLibrary[0]);
                } else {
                  onError(
                    "文风库为空。请回主页打开「文风学习」导入范文后再选用"
                  );
                }
                return;
              }
              patch({
                writingStyle: v,
                learnedStyleId: "",
                learnedStyleGuide: "",
                learnedStyleName: "",
              });
            }}
          >
            {(Object.keys(STYLE_LABELS) as WritingStyle[])
              .filter((k) => {
                if (writingBoard !== "general") return true;
                if (k === settings.writingStyle) return true;
                return k !== "passionate" && k !== "restrained";
              })
              .map((k) => (
              <option key={k} value={k}>
                {STYLE_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="叙述人称">
          <select
            value={settings.person}
            onChange={(e) =>
              patch({ person: e.target.value as NarrativePerson })
            }
          >
            {(Object.keys(PERSON_LABELS) as NarrativePerson[]).map((k) => (
              <option key={k} value={k}>
                {PERSON_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="章节篇幅">
          <select
            value={settings.length}
            onChange={(e) =>
              patch({
                length: e.target.value as GenerationSettings["length"],
              })
            }
          >
            {(Object.keys(LENGTH_LABELS) as Array<keyof typeof LENGTH_LABELS>).map(
              (k) => (
                <option key={k} value={k}>
                  {LENGTH_LABELS[k]}
                </option>
              )
            )}
          </select>
        </Field>
        <Field label="语言">
          <select
            value={settings.language}
            onChange={(e) =>
              patch({ language: e.target.value as "zh" | "en" })
            }
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label="建议章节数">
          <input
            type="number"
            min={1}
            max={30}
            value={settings.chapterCount}
            onChange={(e) =>
              patch({
                chapterCount: Math.max(
                  1,
                  Math.min(30, Number(e.target.value) || 1)
                ),
              })
            }
          />
        </Field>
      </div>

      {settings.writingStyle === "custom" ? (
        <Field label="自定义文风描述">
          <textarea
            value={settings.customStyle}
            onChange={(e) => patch({ customStyle: e.target.value })}
            rows={2}
          />
        </Field>
      ) : null}

      {settings.writingStyle === "learned" || settings.learnedStyleGuide ? (
        <div className="field">
          <label className="field-label">学习文风（固定）</label>
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <span className="badge">
              {settings.learnedStyleName || "已绑定风格"}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClearStyle}
            >
              清除
            </button>
          </div>
          {styleLibrary.length > 0 ? (
            <select
              value={settings.learnedStyleId || ""}
              onChange={(e) => {
                const s = styleLibrary.find((x) => x.id === e.target.value);
                if (s) onApplyStyle(s);
              }}
            >
              <option value="" disabled>
                切换文风库中的风格…
              </option>
              {styleLibrary.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
          <textarea
            className="mt-2"
            value={settings.learnedStyleGuide}
            onChange={(e) =>
              patch({
                writingStyle: "learned",
                learnedStyleGuide: e.target.value,
              })
            }
            rows={5}
          />
        </div>
      ) : null}

      <Field label="额外写作指令">
        <textarea
          value={settings.extraInstructions}
          onChange={(e) => patch({ extraInstructions: e.target.value })}
          rows={3}
        />
      </Field>

      <Field
        label="附加系统规则"
        hint="每行一条，写入本章 system 末尾。清空则恢复内置 pack。"
      >
        <textarea
          value={settings.extraRules || ""}
          onChange={(e) => patch({ extraRules: e.target.value })}
          rows={4}
          placeholder="例如：保持冷色调，少用网络梗"
        />
      </Field>

      <details className="field">
        <summary className="field-label cursor-pointer">
          内置提示词预览（只读）
        </summary>
        <pre className="mt-2 text-xs whitespace-pre-wrap max-h-56 overflow-auto rounded-lg border border-[var(--border-soft)] p-3 bg-[var(--bg)]">
          {previewBuiltInSystem(writingBoard)}
        </pre>
      </details>
    </div>
  );
}
