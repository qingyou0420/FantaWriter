"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/Field";
import { postGenerate } from "@/lib/api";
import {
  deleteLearnedStyle,
  upsertLearnedStyle,
} from "@/lib/storage";
import {
  sampleTextForStyleLearning,
  type LearnedStyle,
  type WritingBoard,
} from "@/lib/types";

/**
 * 文风学习与文风库管理。
 * homeMode：主页维护，不提供「应用到本书」
 * 项目内：可 apply / clear 当前小说绑定风格
 */
export function StyleLearnPanel({
  styles,
  onStylesChange,
  onError,
  writingBoard = "erotic",
  homeMode = false,
  activeId = "",
  activeName = "",
  onApply,
  onClear,
}: {
  styles: LearnedStyle[];
  onStylesChange: (s: LearnedStyle[]) => void;
  onError: (msg: string) => void;
  writingBoard?: WritingBoard;
  homeMode?: boolean;
  activeId?: string;
  activeName?: string;
  onApply?: (s: LearnedStyle) => void;
  onClear?: () => void;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("粘贴导入");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(styles[0]?.id || "");
  const [hint, setHint] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (styles.length && !styles.find((s) => s.id === selectedId)) {
      setSelectedId(styles[0].id);
    }
  }, [styles, selectedId]);

  const selected =
    styles.find((s) => s.id === selectedId) || styles[0] || null;

  async function learn() {
    const raw = text.trim();
    if (raw.length < 80) {
      onError("请先粘贴或导入小说文本（建议 500 字以上，至少 80 字）");
      return;
    }
    setBusy(true);
    onError("");
    setHint("");
    try {
      const sample = sampleTextForStyleLearning(raw);
      const data = await postGenerate({
        mode: "learn_style",
        writingBoard,
        sampleText: sample,
        nameHint: name.trim() || undefined,
      });
      const fields = data.style as Omit<
        LearnedStyle,
        "id" | "createdAt" | "updatedAt" | "sourceLabel" | "sourceChars"
      >;
      const now = new Date().toISOString();
      const style: LearnedStyle = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        sourceLabel: sourceLabel || "导入",
        sourceChars: raw.length,
        writingBoard,
        name: name.trim() || fields.name || "未命名文风",
        overall: fields.overall || "",
        vocabulary: fields.vocabulary || "",
        rhythm: fields.rhythm || "",
        narrative: fields.narrative || "",
        dialogue: fields.dialogue || "",
        erotic: fields.erotic || "",
        sensory: fields.sensory || "",
        structure: fields.structure || "",
        avoid: fields.avoid || "",
        styleGuide: fields.styleGuide || "",
        fingerprints: fields.fingerprints || [],
      };
      const list = upsertLearnedStyle(style);
      onStylesChange(list);
      setSelectedId(style.id);
      setName("");
      if (homeMode) {
        setHint(
          `已保存文风「${style.name}」。打开任意小说 → 生成参数 → 选择「学习文风」即可应用。`
        );
      } else if (onApply) {
        if (
          confirm(
            `已学习文风「${style.name}」。是否立即应用到本书？`
          )
        ) {
          onApply(style);
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      setText(content);
      setSourceLabel(file.name);
      if (!name.trim()) {
        setName(file.name.replace(/\.[^.]+$/, ""));
      }
    };
    reader.onerror = () => onError("读取文件失败");
    reader.readAsText(file, "UTF-8");
  }

  function removeStyle(id: string) {
    if (!confirm("从文风库删除此风格？")) return;
    const list = deleteLearnedStyle(id);
    onStylesChange(list);
    if (activeId === id) onClear?.();
    if (selectedId === id) setSelectedId(list[0]?.id || "");
  }

  function saveGuideEdit(style: LearnedStyle, guide: string) {
    const next: LearnedStyle = {
      ...style,
      styleGuide: guide,
      updatedAt: new Date().toISOString(),
    };
    onStylesChange(upsertLearnedStyle(next));
    if (activeId === style.id) onApply?.(next);
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="card">
        <h2 className="card-title">一键导入小说 · 学习文风</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0 mb-3 leading-relaxed">
          导入或粘贴范文，AI 分析文笔、句式、对话与写法，生成
          <strong>固定风格档案</strong>
          （全局文风库，所有项目可选用）。长文自动取头/中/尾采样。
        </p>
        {!homeMode && activeId ? (
          <div className="mb-3 text-sm flex flex-wrap items-center gap-2">
            <span className="badge">本书当前风格</span>
            <span>{activeName || "已应用"}</span>
            {onClear ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClear}
              >
                取消应用
              </button>
            ) : null}
          </div>
        ) : null}
        {hint ? (
          <p className="text-xs text-[#a0d8b0] mb-3 mt-0">{hint}</p>
        ) : null}

        <Field label="风格名称（可选）">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="范文正文">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (sourceLabel === "粘贴导入" || !sourceLabel) {
                setSourceLabel("粘贴导入");
              }
            }}
            rows={10}
            className="!font-mono !text-[0.85rem]"
          />
        </Field>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.text,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            选择文件导入
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || text.trim().length < 80}
            onClick={learn}
          >
            {busy ? (
              <>
                <span className="spinner" /> 学习中…
              </>
            ) : (
              "AI 学习并保存文风"
            )}
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            当前 {text.length} 字
            {sourceLabel ? ` · 来源 ${sourceLabel}` : ""}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        <aside className="card !p-2 h-fit">
          <div className="px-2 py-1.5 text-xs text-[var(--text-muted)]">
            文风库（{styles.length}）
          </div>
          <ul className="list-none p-0 m-0 space-y-0.5 max-h-[50vh] overflow-y-auto">
            {styles.length === 0 ? (
              <li className="empty !py-6 text-xs">暂无，先导入范文学习</li>
            ) : (
              styles.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-2.5 py-2 rounded-lg border-0 cursor-pointer text-sm ${
                      s.id === (selected?.id || selectedId)
                        ? "bg-[var(--bg-hover)]"
                        : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg)]"
                    }`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <div className="font-medium truncate flex items-center gap-1">
                      {s.name}
                      {!homeMode && s.id === activeId ? (
                        <span className="badge !text-[0.65rem]">使用中</span>
                      ) : null}
                    </div>
                    <div className="text-[0.7rem] opacity-70 truncate">
                      {s.sourceLabel} · {s.sourceChars} 字
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        {selected ? (
          <div className="card">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h2 className="text-base font-semibold m-0 flex-1">
                {selected.name}
              </h2>
              {!homeMode && onApply ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onApply(selected)}
                >
                  应用到本书
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => removeStyle(selected.id)}
              >
                删除
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0 mb-3">
              {selected.overall}
            </p>
            <div className="grid sm:grid-cols-2 gap-2 text-xs mb-3">
              {(
                [
                  ["用词", selected.vocabulary],
                  ["节奏", selected.rhythm],
                  ["叙事", selected.narrative],
                  ["对话", selected.dialogue],
                  ...(writingBoard === "erotic"
                    ? [["情色写法", selected.erotic || ""]]
                    : []),
                  ["感官", selected.sensory],
                  ["结构", selected.structure],
                  ["避免", selected.avoid],
                ] as [string, string][]
              ).map(([k, v]) =>
                v ? (
                  <div
                    key={k}
                    className="rounded-lg border border-[var(--border-soft)] p-2"
                  >
                    <div className="text-[var(--text-muted)] mb-1">{k}</div>
                    <div className="leading-relaxed">{v}</div>
                  </div>
                ) : null
              )}
            </div>
            {selected.fingerprints?.length ? (
              <Field label="风格指纹">
                <ul className="text-sm m-0 pl-4 leading-relaxed">
                  {selected.fingerprints.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </Field>
            ) : null}
            <Field label="固定风格指南（可编辑）">
              <textarea
                defaultValue={selected.styleGuide}
                key={selected.id + selected.updatedAt}
                rows={8}
                onBlur={(e) => {
                  if (e.target.value !== selected.styleGuide) {
                    saveGuideEdit(selected, e.target.value);
                  }
                }}
              />
            </Field>
            <p className="text-[0.7rem] text-[var(--text-muted)] m-0">
              修改指南后失焦自动保存
              {!homeMode
                ? "；若本书正在使用此风格会同步更新。"
                : "。在小说「生成参数」中选用即可。"}
            </p>
          </div>
        ) : (
          <div className="card empty">选择左侧文风查看详情</div>
        )}
      </div>
    </div>
  );
}
