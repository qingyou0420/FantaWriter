"use client";

import { useEffect, useState } from "react";
import { AiBox } from "@/components/AiBox";
import { Field } from "@/components/Field";
import { postGenerate } from "@/lib/api";
import { previewBuiltInSystem } from "@/lib/prompts/registry";
import { lengthRangeFor } from "@/lib/length";
import {
  LENGTH_LABELS,
  PERSON_LABELS,
  STYLE_LABELS,
  type Character,
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
  writingBoard = "general",
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
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setThinkingEnabled(Boolean(data.env?.thinkingEnabled));
        }
      })
      .catch(() => {
        if (!cancelled) setThinkingEnabled(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        hint="结合人物与背景，智能推荐文风、人称、章节数与额外写作指令。"
        seed={seed}
        onSeedChange={setSeed}
        busy={busy}
        primaryLabel="AI 优化参数"
        onPrimary={optimizeSettings}
      />

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
            value={settings.customLength ? "custom" : settings.length}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "custom") {
                const cur = lengthRangeFor(
                  settings.length,
                  settings.customLength
                );
                patch({ customLength: { min: cur.min, max: cur.max } });
                return;
              }
              patch({
                length: v as GenerationSettings["length"],
                customLength: undefined,
              });
            }}
          >
            {(Object.keys(LENGTH_LABELS) as Array<keyof typeof LENGTH_LABELS>).map(
              (k) => (
                <option key={k} value={k}>
                  {LENGTH_LABELS[k]}
                </option>
              )
            )}
            <option value="custom">自定义</option>
          </select>
        </Field>
        {settings.customLength ? (
          <Field
            label="自定义字数"
            hint="夹值 500–20000，且下限须小于上限"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={500}
                max={20000}
                className="!w-24"
                value={settings.customLength.min}
                onChange={(e) => {
                  const min = Math.max(
                    500,
                    Math.min(20000, Number(e.target.value) || 500)
                  );
                  const max = Math.max(min + 1, settings.customLength!.max);
                  patch({ customLength: { min, max } });
                }}
              />
              <span className="text-sm text-[var(--text-muted)]">–</span>
              <input
                type="number"
                min={500}
                max={20000}
                className="!w-24"
                value={settings.customLength.max}
                onChange={(e) => {
                  const max = Math.max(
                    500,
                    Math.min(20000, Number(e.target.value) || 500)
                  );
                  const min = Math.min(max - 1, settings.customLength!.min);
                  if (min < max) patch({ customLength: { min, max } });
                }}
              />
              <span className="text-xs text-[var(--text-muted)]">字/章</span>
            </div>
          </Field>
        ) : null}
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
        <Field
          label="正文温度"
          hint={
            thinkingEnabled
              ? "推理模式下模型忽略温度（ai.ts 不传 temperature）"
              : "中转模型高温易水词。默认 0.9，不动则与现在一致。"
          }
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.6}
              max={1}
              step={0.05}
              value={settings.temperature ?? 0.9}
              disabled={thinkingEnabled === true}
              onChange={(e) =>
                patch({ temperature: Number(e.target.value) })
              }
            />
            <span className="text-sm tabular-nums w-10">
              {(settings.temperature ?? 0.9).toFixed(2)}
            </span>
          </div>
        </Field>
        <Field
          label="每次规划章数"
          hint="单次排章 / 续排的批量上限（1–30）"
        >
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
        <Field
          label="连载模式"
          hint="开启后正文开头承接上章钩子，结尾停在本章钩子上。关闭时与现在完全一致。"
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="!w-auto"
              checked={Boolean(settings.serialMode)}
              onChange={(e) => patch({ serialMode: e.target.checked })}
            />
            按连载章来写（钩子 / 断章）
          </label>
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
