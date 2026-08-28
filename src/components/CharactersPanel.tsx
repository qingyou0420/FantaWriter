"use client";

import { useEffect, useState } from "react";
import { AiBox } from "@/components/AiBox";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { postGenerate } from "@/lib/api";
import {
  applyCharacterEditorSave,
  canManuallyEditCharacters,
  closeCharacterEditor,
  openCharacterEditor,
  type CharacterEditorState,
} from "@/lib/character-editor";
import { assertCharactersRespectCanon, hasOriginalGrounding } from "@/lib/original";
import { togglePinnedStateNote } from "@/lib/character-states";
import {
  createEmptyCharacter,
  type Character,
  type CharacterStateLedger,
  type LockedCanonFact,
  type OriginalManuscript,
  type StoryBackground,
  type WritingBoard,
} from "@/lib/types";

export function CharactersPanel({
  characters,
  background,
  writingBoard = "general",
  original,
  canon,
  openEditorRequest = 0,
  characterStates,
  onCharacterStatesChange,
  onChange,
  onCastGenerated,
  onProposeCast,
  onError,
}: {
  characters: Character[];
  background: StoryBackground;
  writingBoard?: WritingBoard;
  original?: OriginalManuscript | null;
  canon?: LockedCanonFact[];
  /** Increment to open the edit dialog (e.g. onboarding「写人物」). */
  openEditorRequest?: number;
  characterStates?: CharacterStateLedger;
  onCharacterStatesChange?: (states: CharacterStateLedger) => void;
  onChange: (c: Character[] | ((prev: Character[]) => Character[])) => void;
  onCastGenerated: (c: Character[], b: StoryBackground) => void;
  /** AI 群像写入走提案闸；提供后不再直接 onCastGenerated */
  onProposeCast?: (c: Character[], b: StoryBackground) => void;
  onError: (msg: string) => void;
}) {
  const list = Array.isArray(characters) ? characters : [];
  const [active, setActive] = useState(list[0]?.id || "");
  const [seed, setSeed] = useState("");
  const [castSeed, setCastSeed] = useState("");
  const [castCount, setCastCount] = useState(2);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<CharacterEditorState>({ open: false });
  const [seenEditorRequest, setSeenEditorRequest] = useState(0);

  const effectiveActive = list.some((c) => c.id === active)
    ? active
    : list[0]?.id || "";
  const current = list.find((c) => c.id === effectiveActive);
  const draft = editor.open ? editor.draft : null;
  const allowManualEdit = canManuallyEditCharacters({ original, canon });

  if (openEditorRequest > seenEditorRequest && allowManualEdit) {
    setSeenEditorRequest(openEditorRequest);
    setEditor(openCharacterEditor(list, effectiveActive || null));
  }

  useEffect(() => {
    if (!editor.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setEditor(closeCharacterEditor());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor.open, busy]);

  function persist(next: Character[] | ((prev: Character[]) => Character[])) {
    onChange((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return typeof next === "function" ? next(base) : next;
    });
  }

  function patchDraft(partial: Partial<Character>) {
    setEditor((prev) =>
      prev.open ? { ...prev, draft: { ...prev.draft, ...partial } } : prev
    );
  }

  function openEdit(id?: string | null, create = false) {
    if (!allowManualEdit) return;
    setEditor(openCharacterEditor(list, id, { create }));
  }

  function saveEditor() {
    if (!editor.open) return;
    const draftToSave = editor.draft;
    persist((prev) => applyCharacterEditorSave(prev, draftToSave));
    setActive(draftToSave.id);
    setEditor(closeCharacterEditor());
  }

  function cancelEditor() {
    setEditor(closeCharacterEditor());
  }

  function add() {
    openEdit(null, true);
  }

  function remove(id: string) {
    if (list.length <= 1) {
      alert("至少保留一个人物");
      return;
    }
    if (!confirm("删除此人物？")) return;
    persist((prev) => prev.filter((c) => c.id !== id));
    if (editor.open && editor.draft.id === id) setEditor(closeCharacterEditor());
  }

  async function expandDraft() {
    if (!editor.open) return;
    const person = editor.draft;
    const idea =
      seed.trim() ||
      [person.name, person.role, person.personality, person.background]
        .filter(Boolean)
        .join("，");
    if (!idea) {
      onError("请先写一句人物灵感，或填写姓名/定位等草稿后再让 AI 扩写");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const data = await postGenerate({
        mode: "expand_character",
        writingBoard,
        seed: idea,
        character: person,
        otherCharacters: list.filter((c) => c.id !== person.id),
        background,
        original,
        canon,
      });
      const fields = data.character as Omit<Character, "id">;
      assertCharactersRespectCanon([fields], canon);
      patchDraft(fields);
      setSeed("");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function optimizeDraft() {
    if (!editor.open) return;
    const person = editor.draft;
    const hasAny = Object.entries(person).some(
      ([k, v]) => k !== "id" && String(v || "").trim()
    );
    if (!hasAny && !seed.trim()) {
      onError("当前人物几乎为空，请先输入一句灵感再点「AI 扩写」");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const data = await postGenerate({
        mode: hasAny ? "optimize_character" : "expand_character",
        writingBoard,
        seed: seed.trim(),
        character: person,
        otherCharacters: list.filter((c) => c.id !== person.id),
        background,
        instruction: seed.trim() || undefined,
        original,
        canon,
      });
      const fields = data.character as Omit<Character, "id">;
      assertCharactersRespectCanon([fields], canon);
      patchDraft(fields);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function expandCast() {
    if (!castSeed.trim()) {
      onError("请先输入一句话故事灵感，再一键生成人物+背景");
      return;
    }
    if (
      list.some((c) => c.name || c.appearance || c.personality) ||
      background.synopsis ||
      background.title
    ) {
      if (
        !confirm(
          "将用 AI 结果覆盖当前人物列表与故事背景（可之后再改）。是否继续？"
        )
      ) {
        return;
      }
    }
    setBusy(true);
    onError("");
    try {
      const data = await postGenerate({
        mode: "expand_cast",
        writingBoard,
        seed: castSeed.trim(),
        characterCount: castCount,
        original,
        canon,
      });
      const next = (data.characters as Omit<Character, "id">[]).map((f) => ({
        ...createEmptyCharacter(),
        ...f,
        id: crypto.randomUUID(),
      }));
      assertCharactersRespectCanon(next, canon);
      const bg = data.background as StoryBackground;
      const cast = next.length ? next : [createEmptyCharacter()];
      if (onProposeCast) onProposeCast(cast, bg);
      else onCastGenerated(cast, bg);
      if (next[0]) setActive(next[0].id);
      setCastSeed("");
      setEditor(closeCharacterEditor());
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {hasOriginalGrounding({ original, canon }) ? (
        <div className="card !py-3 text-sm text-[var(--text-muted)]">
          本书挂了原作底稿。扩写人物会读原文与锁定设定；已锁定的事实在生成时必须遵守。
        </div>
      ) : null}
      <div className="card">
        <AiBox
          title="一句话生成全部设定"
          hint={
            hasOriginalGrounding({ original, canon })
              ? "有原作时请按旧稿扩写，不要从零编一批新角色。生成后仍可逐项修改。"
              : "输入一句灵感，AI 同时生成故事背景 + 多名人物。生成后仍可逐项修改。"
          }
          seed={castSeed}
          onSeedChange={setCastSeed}
          busy={busy}
          primaryLabel="AI 生成人物+背景"
          onPrimary={expandCast}
          extra={
            <label className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
              人数
              <select
                className="!w-auto !py-1 !px-2"
                value={castCount}
                disabled={busy}
                onChange={(e) => setCastCount(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          }
        />
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        <aside className="card !p-2 h-fit">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              人物列表
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={add}
              disabled={busy || !allowManualEdit}
            >
              + 添加
            </button>
          </div>
          <ul className="list-none p-0 m-0 space-y-0.5">
            {list.map((c) => {
              const fields = [
                c.name,
                c.role,
                c.gender,
                c.age,
                c.appearance,
                c.personality,
                c.background,
                c.relationships,
              ];
              const filled = fields.filter((x) => String(x || "").trim()).length;
              const pct = Math.round((filled / fields.length) * 100);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-2.5 py-2 rounded-lg border-0 cursor-pointer text-sm ${
                      c.id === effectiveActive
                        ? "bg-[var(--bg-hover)] text-[var(--text)]"
                        : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg)]"
                    }`}
                    onClick={() => {
                      setActive(c.id);
                      openEdit(c.id);
                    }}
                  >
                    <div className="font-medium truncate">
                      {c.name || "未命名人物"}
                    </div>
                    <div className="text-[0.7rem] opacity-70 truncate">
                      {c.role || "未设定位"}
                    </div>
                    <div className="char-progress mt-1">
                      完成度 {pct}%
                      <div className="char-progress-bar">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {current ? (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold m-0">
                {current.name || "未命名人物"}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => openEdit(current.id)}
                  disabled={busy || !allowManualEdit}
                >
                  编辑设定
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => remove(current.id)}
                  disabled={busy}
                >
                  删除人物
                </button>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-0 mb-0 leading-relaxed">
              {current.role || "未设定位"}
              {current.gender ? ` · ${current.gender}` : ""}
              {current.age ? ` · ${current.age}` : ""}
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-2 mb-0 leading-relaxed">
              {current.personality?.trim() ||
                current.appearance?.trim() ||
                "点「编辑设定」填写姓名、性格与经历。从零开写不必先抽原作骨架。"}
            </p>
          </div>
        ) : (
          <EmptyState
            title="还没有人物"
            description="至少写一个主角姓名，再去生成大纲。"
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={add}>
                添加人物
              </button>
            }
          />
        )}
      </div>

      {onCharacterStatesChange ? (
        <div className="card">
          <h2 className="card-title">当前人物状态</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0 mb-3">
            手改账本会进入下一章记忆包。未置顶每人保留最近 6 条；图钉写死的永远注入。
          </p>
          {(() => {
            const names = Array.from(
              new Set([
                ...list.map((c) => c.name.trim()).filter(Boolean),
                ...Object.keys(characterStates || {}),
              ])
            );
            if (!names.length) {
              return (
                <p className="text-sm text-[var(--text-muted)] m-0">
                  添加人物或生成章摘要后，可在这里改称呼 / 伤势 / 位置。
                </p>
              );
            }
            return (
              <ul className="list-none p-0 m-0 space-y-3">
                {names.map((name) => {
                  const rows = characterStates?.[name] || [];
                  const latest = rows[rows.length - 1];
                  return (
                    <li key={name}>
                      <Field label={name}>
                        {rows.length ? (
                          <ul className="list-none p-0 m-0 space-y-1 mb-2">
                            {rows.map((row) => (
                              <li
                                key={`${row.chapterOrder}-${row.note}`}
                                className="flex items-start gap-2 text-xs"
                              >
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm !px-1"
                                  title={row.pinned ? "取消置顶" : "置顶写死"}
                                  onClick={() =>
                                    onCharacterStatesChange(
                                      togglePinnedStateNote(
                                        characterStates,
                                        name,
                                        row.chapterOrder,
                                        row.note
                                      )
                                    )
                                  }
                                >
                                  {row.pinned ? "📌" : "📍"}
                                </button>
                                <span className="text-[var(--text-muted)] shrink-0">
                                  第{row.chapterOrder}章
                                </span>
                                <span className="flex-1">{row.note}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <textarea
                          rows={2}
                          value={latest?.note || ""}
                          placeholder="位置、伤势、称呼、关系…"
                          onChange={(e) => {
                            const note = e.target.value;
                            const next: CharacterStateLedger = {
                              ...(characterStates || {}),
                            };
                            const prev = [...(next[name] || [])];
                            if (prev.length) {
                              prev[prev.length - 1] = {
                                ...prev[prev.length - 1],
                                note,
                              };
                            } else {
                              prev.push({ chapterOrder: 0, note });
                            }
                            if (!note.trim()) {
                              if (prev.length <= 1) delete next[name];
                              else next[name] = prev.slice(0, -1);
                            } else {
                              next[name] = prev;
                            }
                            onCharacterStatesChange(next);
                          }}
                        />
                      </Field>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </div>
      ) : null}

      {editor.open && draft ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="character-editor-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) cancelEditor();
          }}
        >
          <div className="modal-card modal-card-wide">
            <div className="flex items-center justify-between mb-3">
              <h2
                id="character-editor-title"
                className="text-base font-semibold m-0"
              >
                {draft.name || (editor.isNew ? "添加人物" : "编辑人物")}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={cancelEditor}
                disabled={busy}
              >
                关闭
              </button>
            </div>

            <AiBox
              title="扩写 / 优化此人设"
              hint="写一句简单描述即可扩写；若已有草稿，可点「AI 优化」在现有基础上润色加深。结果填入下方表单，保存后才会写入项目。"
              seed={seed}
              onSeedChange={setSeed}
              busy={busy}
              primaryLabel="AI 扩写此人设"
              onPrimary={expandDraft}
              secondaryLabel="AI 优化当前草稿"
              onSecondary={optimizeDraft}
            />

            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="姓名">
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                />
              </Field>
              <Field label="定位">
                <input
                  value={draft.role}
                  onChange={(e) => patchDraft({ role: e.target.value })}
                />
              </Field>
              <Field label="性别">
                <input
                  value={draft.gender}
                  onChange={(e) => patchDraft({ gender: e.target.value })}
                />
              </Field>
              <Field label="年龄">
                <input
                  value={draft.age}
                  onChange={(e) => patchDraft({ age: e.target.value })}
                />
              </Field>
            </div>
            <Field label="外貌">
              <textarea
                value={draft.appearance}
                onChange={(e) => patchDraft({ appearance: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="性格">
              <textarea
                value={draft.personality}
                onChange={(e) => patchDraft({ personality: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="背景经历">
              <textarea
                value={draft.background}
                onChange={(e) => patchDraft({ background: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="人物关系">
              <textarea
                value={draft.relationships}
                onChange={(e) => patchDraft({ relationships: e.target.value })}
                rows={2}
              />
            </Field>
            <Field
              label="别名"
              hint="逗号分隔。生成时与姓名一并注入，避免称呼漂移。"
            >
              <input
                value={(draft.aliases || []).join("，")}
                onChange={(e) =>
                  patchDraft({
                    aliases: e.target.value
                      .split(/[,，、/|\n]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="例如：阿宁，宁宁"
              />
            </Field>
            <Field
              label="说话风格"
              hint="三句他会说的话，作为声音样本（会注入）。"
            >
              <textarea
                value={draft.speechStyle || ""}
                onChange={(e) => patchDraft({ speechStyle: e.target.value })}
                rows={3}
                placeholder="例如：短句、少修饰、爱用反问。写三句他会说的话。"
              />
            </Field>
            <Field label="备注（癖好 / 禁忌 / 口癖等）">
              <textarea
                value={draft.notes}
                onChange={(e) => patchDraft({ notes: e.target.value })}
                rows={2}
              />
            </Field>
            <details className="author-only-box mt-3">
              <summary className="cursor-pointer text-sm font-medium">
                真相层（仅作者 · 永不进提示词）
                <span className="badge badge-lock ml-2">锁</span>
              </summary>
              <p className="text-xs text-[var(--text-muted)] mt-2 mb-2">
                日常写作只注入当前状态。真相层留在你的档案里，不进任何生成路径。
              </p>
              <Field label="表面欲望">
                <textarea
                  rows={2}
                  value={draft.truth?.surfaceWant || ""}
                  onChange={(e) =>
                    patchDraft({
                      truth: {
                        surfaceWant: e.target.value,
                        realNeed: draft.truth?.realNeed || "",
                        fatalFlaw: draft.truth?.fatalFlaw || "",
                        bottomLine: draft.truth?.bottomLine || "",
                      },
                    })
                  }
                />
              </Field>
              <Field label="真实需要">
                <textarea
                  rows={2}
                  value={draft.truth?.realNeed || ""}
                  onChange={(e) =>
                    patchDraft({
                      truth: {
                        surfaceWant: draft.truth?.surfaceWant || "",
                        realNeed: e.target.value,
                        fatalFlaw: draft.truth?.fatalFlaw || "",
                        bottomLine: draft.truth?.bottomLine || "",
                      },
                    })
                  }
                />
              </Field>
              <Field label="致命缺陷">
                <textarea
                  rows={2}
                  value={draft.truth?.fatalFlaw || ""}
                  onChange={(e) =>
                    patchDraft({
                      truth: {
                        surfaceWant: draft.truth?.surfaceWant || "",
                        realNeed: draft.truth?.realNeed || "",
                        fatalFlaw: e.target.value,
                        bottomLine: draft.truth?.bottomLine || "",
                      },
                    })
                  }
                />
              </Field>
              <Field label="底线">
                <textarea
                  rows={2}
                  value={draft.truth?.bottomLine || ""}
                  onChange={(e) =>
                    patchDraft({
                      truth: {
                        surfaceWant: draft.truth?.surfaceWant || "",
                        realNeed: draft.truth?.realNeed || "",
                        fatalFlaw: draft.truth?.fatalFlaw || "",
                        bottomLine: e.target.value,
                      },
                    })
                  }
                />
              </Field>
            </details>

            <div className="flex flex-wrap justify-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelEditor}
                disabled={busy}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveEditor}
                disabled={busy}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
