"use client";

import { useEffect, useState } from "react";
import { Field } from "@/components/Field";
import {
  createEmptyPremiseCard,
  formatLineList,
  parseLineList,
  type NovelProject,
  type PremiseCard,
} from "@/lib/types";

export function PremisePanel({
  project,
  onChange,
}: {
  project: NovelProject;
  onChange: (card: PremiseCard, extra?: { serialMode?: boolean }) => void;
}) {
  const card = project.premiseCard || createEmptyPremiseCard();
  const [narrating, setNarrating] = useState(false);
  const [left, setLeft] = useState(180);

  useEffect(() => {
    if (!narrating) return;
    const started = Date.now();
    const t = window.setInterval(() => {
      const remain = Math.max(0, 180 - Math.floor((Date.now() - started) / 1000));
      setLeft(remain);
      if (remain <= 0) {
        window.clearInterval(t);
        setNarrating(false);
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [narrating]);

  function patch(partial: Partial<PremiseCard>) {
    onChange({ ...card, ...partial });
  }

  const mm = String(Math.floor(left / 60)).padStart(1, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card">
        <h2 className="card-title m-0">前提卡</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1 mb-3">
          动笔之前先把灵魂定死。主题和结局只给你看，永远不进提示词。
        </p>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            className="!w-auto"
            checked={Boolean(project.settings.serialMode)}
            onChange={(e) =>
              onChange(card, { serialMode: e.target.checked })
            }
          />
          连载长篇（默认开：章末停在钩子上，顶栏主按钮是「写下一章」）
        </label>
        <Field
          label="一句话前提"
          hint="谁、要什么、拦着他的是什么。可注入，给 AI 当锚。"
        >
          <textarea
            rows={3}
            value={card.premise}
            onChange={(e) => patch({ premise: e.target.value })}
            placeholder="行人甲要在霜桥交还铜铃，拦着他的是还没揭开的旧账。"
          />
        </Field>
        <div className="author-only-box mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="badge badge-lock">仅作者 · 永不进提示词</span>
          </div>
          <Field
            label="主题一句"
            hint="这本书到底在说什么。只给自己看。"
          >
            <textarea
              rows={2}
              value={card.theme}
              onChange={(e) => patch({ theme: e.target.value })}
            />
          </Field>
          <Field
            label="结局方向"
            hint="赢还是输，付什么代价。不必精确到画面。"
          >
            <textarea
              rows={2}
              value={card.endingDirection}
              onChange={(e) => patch({ endingDirection: e.target.value })}
            />
          </Field>
          <Field
            label="核心对抗"
            hint="谁对谁、争什么、为什么不能和解。过卷开卷时回显，不注入。"
          >
            <textarea
              rows={2}
              value={card.coreConflict || ""}
              onChange={(e) => patch({ coreConflict: e.target.value })}
            />
          </Field>
        </div>
        <Field
          label="全书禁写清单"
          hint="一行一条。自动带入每章契约，以「禁止写：」注入。"
        >
          <textarea
            rows={4}
            value={formatLineList(card.forbidList)}
            onChange={(e) =>
              patch({ forbidList: parseLineList(e.target.value) })
            }
            placeholder={"主角不许黑化\n师徒线不许变爱情线"}
          />
        </Field>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (narrating) {
                setNarrating(false);
                return;
              }
              setLeft(180);
              setNarrating(true);
            }}
          >
            {narrating ? "结束自述" : "三分钟自述"}
          </button>
          {narrating ? (
            <span className="text-sm text-[var(--warning)] tabular-nums">
              {mm}:{ss} · 把这个故事讲给自己听，讲不顺就是没定死
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">
              纯本地倒计时，不调 AI。
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
