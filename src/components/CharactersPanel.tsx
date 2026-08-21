"use client";

import { useState } from "react";
import { AiBox } from "@/components/AiBox";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { postGenerate } from "@/lib/api";
import { assertCharactersRespectCanon, hasOriginalGrounding } from "@/lib/original";
import {
  createEmptyCharacter,
  type Character,
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
  onChange,
  onCastGenerated,
  onError,
}: {
  characters: Character[];
  background: StoryBackground;
  writingBoard?: WritingBoard;
  original?: OriginalManuscript | null;
  canon?: LockedCanonFact[];
  onChange: (c: Character[] | ((prev: Character[]) => Character[])) => void;
  onCastGenerated: (c: Character[], b: StoryBackground) => void;
  onError: (msg: string) => void;
}) {
  const [active, setActive] = useState(characters[0]?.id || "");
  const [seed, setSeed] = useState("");
  const [castSeed, setCastSeed] = useState("");
  const [castCount, setCastCount] = useState(2);
  const [busy, setBusy] = useState(false);

  const effectiveActive = characters.some((c) => c.id === active)
    ? active
    : characters[0]?.id || "";
  const current = characters.find((c) => c.id === effectiveActive);

  function patch(partial: Partial<Character>) {
    const id = effectiveActive;
    onChange((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...partial } : c))
    );
  }

  function add() {
    const c = createEmptyCharacter();
    c.role = characters.length ? "配角" : "主角";
    onChange((prev) => [...prev, c]);
    setActive(c.id);
  }

  function remove(id: string) {
    if (characters.length <= 1) {
      alert("至少保留一个人物");
      return;
    }
    if (!confirm("删除此人物？")) return;
    onChange((prev) => prev.filter((c) => c.id !== id));
  }

  async function expandCurrent() {
    if (!current) return;
    const idea =
      seed.trim() ||
      [current.name, current.role, current.personality, current.background]
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
        character: current,
        otherCharacters: characters.filter((c) => c.id !== current.id),
        background,
        original,
        canon,
      });
      const fields = data.character as Omit<Character, "id">;
      assertCharactersRespectCanon([fields], canon);
      const targetId = current.id;
      onChange((prev) =>
        prev.map((c) => (c.id === targetId ? { ...c, ...fields } : c))
      );
      setSeed("");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function optimizeCurrent() {
    if (!current) return;
    const hasAny = Object.entries(current).some(
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
        character: current,
        otherCharacters: characters.filter((c) => c.id !== current.id),
        background,
        instruction: seed.trim() || undefined,
        original,
        canon,
      });
      const fields = data.character as Omit<Character, "id">;
      assertCharactersRespectCanon([fields], canon);
      const targetId = current.id;
      onChange((prev) =>
        prev.map((c) => (c.id === targetId ? { ...c, ...fields } : c))
      );
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
      characters.some((c) => c.name || c.appearance || c.personality) ||
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
      const list = (data.characters as Omit<Character, "id">[]).map((f) => ({
        ...createEmptyCharacter(),
        ...f,
        id: crypto.randomUUID(),
      }));
      assertCharactersRespectCanon(list, canon);
      const bg = data.background as StoryBackground;
      onCastGenerated(list.length ? list : [createEmptyCharacter()], bg);
      if (list[0]) setActive(list[0].id);
      setCastSeed("");
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
              disabled={busy}
            >
              + 添加
            </button>
          </div>
          <ul className="list-none p-0 m-0 space-y-0.5">
            {characters.map((c) => {
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
                    onClick={() => setActive(c.id)}
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
                {current.name || "编辑人物"}
              </h2>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => remove(current.id)}
                disabled={busy}
              >
                删除人物
              </button>
            </div>

            <AiBox
              title="扩写 / 优化此人设"
              hint="写一句简单描述即可扩写；若已有草稿，可点「AI 优化」在现有基础上润色加深。结果填入下方表单，你仍可继续改。"
              seed={seed}
              onSeedChange={setSeed}
              busy={busy}
              primaryLabel="AI 扩写此人设"
              onPrimary={expandCurrent}
              secondaryLabel="AI 优化当前草稿"
              onSecondary={optimizeCurrent}
            />

            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="姓名">
                <input
                  value={current.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
              <Field label="定位">
                <input
                  value={current.role}
                  onChange={(e) => patch({ role: e.target.value })}
                />
              </Field>
              <Field label="性别">
                <input
                  value={current.gender}
                  onChange={(e) => patch({ gender: e.target.value })}
                />
              </Field>
              <Field label="年龄">
                <input
                  value={current.age}
                  onChange={(e) => patch({ age: e.target.value })}
                />
              </Field>
            </div>
            <Field label="外貌">
              <textarea
                value={current.appearance}
                onChange={(e) => patch({ appearance: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="性格">
              <textarea
                value={current.personality}
                onChange={(e) => patch({ personality: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="背景经历">
              <textarea
                value={current.background}
                onChange={(e) => patch({ background: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="人物关系">
              <textarea
                value={current.relationships}
                onChange={(e) => patch({ relationships: e.target.value })}
                rows={2}
              />
            </Field>
            <Field
              label="别名"
              hint="逗号分隔。生成时与姓名一并注入，避免称呼漂移。"
            >
              <input
                value={(current.aliases || []).join("，")}
                onChange={(e) =>
                  patch({
                    aliases: e.target.value
                      .split(/[,，、/|\n]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="例如：阿宁，宁宁"
              />
            </Field>
            <Field label="说话风格">
              <textarea
                value={current.speechStyle || ""}
                onChange={(e) => patch({ speechStyle: e.target.value })}
                rows={2}
                placeholder="例如：短句、少修饰、爱用反问"
              />
            </Field>
            <Field label="备注（癖好 / 禁忌 / 口癖等）">
              <textarea
                value={current.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={2}
              />
            </Field>
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
    </div>
  );
}
