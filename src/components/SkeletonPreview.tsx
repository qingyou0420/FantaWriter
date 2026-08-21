"use client";

import { Field } from "@/components/Field";
import {
  SKELETON_UNKNOWN,
  type SkeletonCharacter,
  type SkeletonEntityKind,
  type StorySkeleton,
} from "@/lib/skeleton";

const ENTITY_LABEL: Record<SkeletonEntityKind, string> = {
  person: "人物",
  place: "地点",
  item: "物品",
  mount: "坐骑",
  other: "其他非人",
};

function linesOf(list: string[]): string {
  return list.join("\n");
}

function parseLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SkeletonPreview({
  skeleton,
  onChange,
}: {
  skeleton: StorySkeleton;
  onChange: (next: StorySkeleton) => void;
}) {
  function patch(partial: Partial<StorySkeleton>) {
    onChange({ ...skeleton, ...partial });
  }

  function patchCharacter(index: number, partial: Partial<SkeletonCharacter>) {
    const characters = skeleton.characters.map((c, i) =>
      i === index ? { ...c, ...partial } : c
    );
    patch({ characters });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)] mt-0 mb-0 leading-relaxed">
        以下是从原文抽出的故事骨架，请改完再写入项目。没写清的保持「{SKELETON_UNKNOWN}」，不要替原文编造。
      </p>
      <Field label="来龙去脉">
        <textarea
          value={skeleton.origin}
          onChange={(e) => patch({ origin: e.target.value })}
          rows={3}
        />
      </Field>
      <Field label="主线">
        <textarea
          value={skeleton.mainLine}
          onChange={(e) => patch({ mainLine: e.target.value })}
          rows={2}
        />
      </Field>
      <Field label="支线" hint="一行一条">
        <textarea
          value={linesOf(skeleton.subLines)}
          onChange={(e) => patch({ subLines: parseLines(e.target.value) })}
          rows={3}
        />
      </Field>
      <Field label="伏笔" hint="一行一条">
        <textarea
          value={linesOf(skeleton.foreshadows)}
          onChange={(e) => patch({ foreshadows: parseLines(e.target.value) })}
          rows={3}
        />
      </Field>
      <Field label="暗线" hint="仅作者可见，写入伏笔板后不会进记忆包">
        <textarea
          value={linesOf(skeleton.darkLines)}
          onChange={(e) => patch({ darkLines: parseLines(e.target.value) })}
          rows={3}
        />
      </Field>
      <Field label="关系网">
        <textarea
          value={skeleton.relationships}
          onChange={(e) => patch({ relationships: e.target.value })}
          rows={2}
        />
      </Field>
      <Field label="时间线">
        <textarea
          value={skeleton.timeline}
          onChange={(e) => patch({ timeline: e.target.value })}
          rows={2}
        />
      </Field>
      <Field label="世界观">
        <textarea
          value={skeleton.world}
          onChange={(e) => patch({ world: e.target.value })}
          rows={3}
        />
      </Field>
      <div>
        <h3 className="text-sm font-medium m-0 mb-2">角色定位</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0 mb-2">
          地点、坐骑、器物请标成非人，写入时不会变成人物卡。
        </p>
        <ul className="list-none p-0 m-0 space-y-3">
          {skeleton.characters.map((c, i) => (
            <li key={`${c.name}-${i}`} className="card !p-3 space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label="名称">
                  <input
                    value={c.name}
                    onChange={(e) => patchCharacter(i, { name: e.target.value })}
                  />
                </Field>
                <Field label="原文身份">
                  <select
                    value={c.entityKind}
                    onChange={(e) =>
                      patchCharacter(i, {
                        entityKind: e.target.value as SkeletonEntityKind,
                      })
                    }
                  >
                    {(Object.keys(ENTITY_LABEL) as SkeletonEntityKind[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {ENTITY_LABEL[k]}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </div>
              <Field label="定位 / 说明">
                <textarea
                  value={c.statement}
                  onChange={(e) =>
                    patchCharacter(i, { statement: e.target.value })
                  }
                  rows={2}
                />
              </Field>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-medium m-0 mb-2">关键物品</h3>
        <ul className="list-none p-0 m-0 space-y-3">
          {skeleton.items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="card !p-3 space-y-2">
              <Field label="名称">
                <input
                  value={it.name}
                  onChange={(e) => {
                    const items = skeleton.items.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    );
                    patch({ items });
                  }}
                />
              </Field>
              <Field label="说明（须写明是物品）">
                <textarea
                  value={it.statement}
                  onChange={(e) => {
                    const items = skeleton.items.map((x, j) =>
                      j === i ? { ...x, statement: e.target.value } : x
                    );
                    patch({ items });
                  }}
                  rows={2}
                />
              </Field>
            </li>
          ))}
        </ul>
      </div>
      <Field label="待补充" hint="原文没写清的缺口，一行一条">
        <textarea
          value={linesOf(skeleton.unknowns)}
          onChange={(e) => patch({ unknowns: parseLines(e.target.value) })}
          rows={3}
        />
      </Field>
      {skeleton.chapters.length ? (
        <div>
          <h3 className="text-sm font-medium m-0 mb-2">章拍预览</h3>
          <ol className="text-sm m-0 pl-4 space-y-2">
            {skeleton.chapters.map((ch) => (
              <li key={ch.order}>
                <strong>
                  第{ch.order}章《{ch.title}》
                </strong>
                ：{ch.summary}
                {ch.beats.length ? (
                  <ul className="mt-1 mb-0">
                    {ch.beats.map((b) => (
                      <li key={b.order}>
                        {b.title} — {b.summary}
                        {b.verbatimAnchors?.length
                          ? `（锚点：${b.verbatimAnchors.join(" / ")}）`
                          : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
