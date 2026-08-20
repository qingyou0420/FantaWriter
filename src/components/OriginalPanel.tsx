"use client";

import { useRef, useState } from "react";
import { Field } from "@/components/Field";
import { postGenerate } from "@/lib/api";
import { mergeCanonFacts } from "@/lib/original";
import {
  createEmptyCanonFact,
  createEmptyOriginalManuscript,
  type CanonKind,
  type LockedCanonFact,
  type OriginalManuscript,
  type WritingBoard,
} from "@/lib/types";

const KIND_LABEL: Record<CanonKind, string> = {
  character: "人物",
  identity: "身份",
  relationship: "关系",
  place: "地点",
  fact: "事实",
};

export function OriginalPanel({
  original,
  canon,
  writingBoard = "general",
  onOriginalChange,
  onCanonChange,
  onError,
}: {
  original: OriginalManuscript | null | undefined;
  canon: LockedCanonFact[];
  writingBoard?: WritingBoard;
  onOriginalChange: (next: OriginalManuscript | null) => void;
  onCanonChange: (next: LockedCanonFact[]) => void;
  onError: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const draft = original || createEmptyOriginalManuscript();
  const lockedCount = canon.filter((f) => f.locked !== false).length;

  function patchOriginal(partial: Partial<OriginalManuscript>) {
    onOriginalChange({
      ...draft,
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  }

  function patchFact(id: string, partial: Partial<LockedCanonFact>) {
    onCanonChange(canon.map((f) => (f.id === id ? { ...f, ...partial } : f)));
  }

  function addFact() {
    onCanonChange([createEmptyCanonFact("", "", "identity"), ...canon]);
  }

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const title =
        draft.title.trim() || file.name.replace(/\.[^.]+$/, "");
      onOriginalChange({
        title,
        sourceLabel: file.name,
        text,
        updatedAt: new Date().toISOString(),
      });
      setHint(`已导入「${file.name}」，共 ${text.length} 字。请锁定关键身份后再生成人设。`);
    };
    reader.onerror = () => onError("读取文件失败");
    reader.readAsText(file, "UTF-8");
  }

  async function extractFacts() {
    const text = draft.text.trim();
    if (text.length < 40) {
      onError("请先粘贴或导入原作正文，再抽取锁定设定");
      return;
    }
    setBusy(true);
    onError("");
    setHint("");
    try {
      const data = await postGenerate({
        mode: "extract_canon",
        writingBoard,
        sampleText: text,
        titleHint: draft.title.trim() || undefined,
        original: draft,
      });
      const incoming = (data.facts || []) as LockedCanonFact[];
      const merged = mergeCanonFacts(canon, incoming);
      onCanonChange(merged);
      setHint(
        `已抽出 ${incoming.length} 条设定（已锁定）。请核对：马、器物、地名不要被当成人物。`
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="card">
        <h2 className="card-title">原作焕新</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0 mb-3 leading-relaxed">
          这是<strong>焕新 / 扩写旧稿</strong>，不是从零遍构。贴入原作后锁定身份与事实，之后的人物扩写、大纲和正文都会读原文与锁定条目。
          例如：<code>清溪 = 流渊的白色战马，不是人，不是女性。</code>
        </p>
        {hint ? (
          <p className="text-xs text-[#a0d8b0] mt-0 mb-3">{hint}</p>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="原作标题">
            <input
              value={draft.title}
              onChange={(e) => patchOriginal({ title: e.target.value })}
              placeholder="如：醉词"
            />
          </Field>
          <Field label="来源说明">
            <input
              value={draft.sourceLabel}
              onChange={(e) => patchOriginal({ sourceLabel: e.target.value })}
              placeholder="粘贴导入 / 文件名"
            />
          </Field>
        </div>
        <Field
          label="原作全文"
          hint="粘贴即可；也可导入 txt / md。长文生成时会按锁定名称摘录相关段落。"
        >
          <textarea
            value={draft.text}
            onChange={(e) => {
              patchOriginal({
                text: e.target.value,
                sourceLabel:
                  draft.sourceLabel && draft.sourceLabel !== "粘贴导入"
                    ? draft.sourceLabel
                    : "粘贴导入",
              });
            }}
            rows={12}
            className="!font-mono !text-[0.85rem]"
            placeholder="把旧稿全文贴在这里…"
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
            导入文件
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || draft.text.trim().length < 40}
            onClick={() => void extractFacts()}
          >
            {busy ? (
              <>
                <span className="spinner" /> 抽取中…
              </>
            ) : (
              "从原文抽取设定"
            )}
          </button>
          {draft.text.trim() ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm !text-[#d45c6a]"
              disabled={busy}
              onClick={() => {
                if (!confirm("清空原作正文？锁定设定会保留。")) return;
                patchOriginal({ text: "" });
              }}
            >
              清空正文
            </button>
          ) : null}
          <span className="text-xs text-[var(--text-muted)]">
            {draft.text.length} 字
            {lockedCount ? ` · 已锁定 ${lockedCount} 条` : " · 尚未锁定"}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title m-0">锁定设定</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 mb-0">
              勾选锁定后，人物扩写若把「清溪」写成女人会被拦截；大纲与正文提示里也会写入这些硬事实。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={addFact}
          >
            添加锁定
          </button>
        </div>
      </div>

      {!canon.length ? (
        <div className="card empty">
          尚无锁定。可点「从原文抽取设定」，或手工加一条：清溪 = 流渊的白色战马，不是人，不是女性。
        </div>
      ) : (
        <ul className="list-none p-0 m-0 space-y-3">
          {canon.map((f) => (
            <li key={f.id} className="card !p-4 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <label className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mr-auto">
                  <input
                    type="checkbox"
                    checked={f.locked !== false}
                    onChange={(e) => patchFact(f.id, { locked: e.target.checked })}
                  />
                  锁定（生成必须遵守）
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm !text-[#d45c6a]"
                  onClick={() => {
                    if (!confirm("删除这条锁定？")) return;
                    onCanonChange(canon.filter((x) => x.id !== f.id));
                  }}
                >
                  删除
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="名称">
                  <input
                    value={f.name}
                    onChange={(e) => patchFact(f.id, { name: e.target.value })}
                    placeholder="清溪"
                  />
                </Field>
                <Field label="种类">
                  <select
                    value={f.kind}
                    onChange={(e) =>
                      patchFact(f.id, { kind: e.target.value as CanonKind })
                    }
                  >
                    {(Object.keys(KIND_LABEL) as CanonKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field
                label="锁定说明"
                hint="写清身份与禁区。例：流渊的白色战马，不是人，不是女性。"
              >
                <textarea
                  value={f.statement}
                  onChange={(e) => patchFact(f.id, { statement: e.target.value })}
                  rows={2}
                />
              </Field>
              <Field label="别名" hint="逗号分隔，摘录原文时一并检索。">
                <input
                  value={(f.aliases || []).join("，")}
                  onChange={(e) =>
                    patchFact(f.id, {
                      aliases: e.target.value
                        .split(/[,，、/|\n]+/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
