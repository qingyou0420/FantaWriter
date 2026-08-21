"use client";

import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { createEmptyLoreEntry } from "@/lib/lore";
import { parseTagsFromText, type LoreEntry, type NovelProject } from "@/lib/types";

const CATEGORY_LABEL: Record<LoreEntry["category"], string> = {
  place: "地点",
  org: "组织",
  item: "物品",
  rule: "规则",
  other: "其他",
};

export function LorePanel({
  project,
  onChange,
}: {
  project: NovelProject;
  onChange: (lore: LoreEntry[]) => void;
}) {
  const lore = project.lore || [];

  function patch(id: string, partial: Partial<LoreEntry>) {
    onChange(lore.map((e) => (e.id === id ? { ...e, ...partial } : e)));
  }

  function remove(id: string) {
    if (!confirm("删除这条设定？")) return;
    onChange(lore.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title m-0">世界观设定</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 mb-0">
              为地点、组织、物品或世界规则写关键词。生成正文时，当前章标题/摘要/要点/正文命中的条目会注入提示（最多
              8 条 / 合计 2000 字）。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onChange([createEmptyLoreEntry(), ...lore])}
          >
            添加设定
          </button>
        </div>
      </div>

      {!lore.length ? (
        <EmptyState
          title="尚无世界观设定"
          description="长篇建议先记下关键地名与规则。生成正文时，命中的条目会注入提示。"
          action={
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onChange([createEmptyLoreEntry(), ...lore])}
            >
              添加设定
            </button>
          }
        />
      ) : (
        <ul className="list-none p-0 m-0 space-y-3">
          {lore.map((e) => (
            <li
              key={e.id}
              className="card !p-4 space-y-3"
            >
              <div className="flex flex-wrap gap-2 items-center">
                <label className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mr-auto">
                  <input
                    type="checkbox"
                    checked={e.enabled !== false}
                    onChange={(ev) => patch(e.id, { enabled: ev.target.checked })}
                  />
                  启用（参与关键词注入）
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm !text-[#d45c6a]"
                  onClick={() => remove(e.id)}
                >
                  删除
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="标题">
                  <input
                    value={e.title}
                    onChange={(ev) => patch(e.id, { title: ev.target.value })}
                  />
                </Field>
                <Field label="分类">
                  <select
                    value={e.category}
                    onChange={(ev) =>
                      patch(e.id, {
                        category: ev.target.value as LoreEntry["category"],
                      })
                    }
                  >
                    {(Object.keys(CATEGORY_LABEL) as LoreEntry["category"][]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {CATEGORY_LABEL[k]}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </div>
              <Field
                label="关键词"
                hint="逗号 / 斜线 / 换行分隔。出现在本章标题、摘要、要点或正文中才会注入。"
              >
                <input
                  value={(e.keys || []).join("，")}
                  onChange={(ev) =>
                    patch(e.id, { keys: parseTagsFromText(ev.target.value) })
                  }
                  placeholder="例如：北境，寒铁，守夜人"
                />
              </Field>
              <Field label="正文">
                <textarea
                  rows={4}
                  value={e.body}
                  onChange={(ev) => patch(e.id, { body: ev.target.value })}
                  placeholder="写入提示词的设定说明"
                />
              </Field>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
