/**
 * Book chrome: 书房 + 问心 · 研墨 · 织卷 · 落笔 + 对谈 + ⋯
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchJson } from "../hooks/use-api";
import type { BookStageId, BookStageSnapshot, BookStepState } from "../lib/book-stage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export type BookWorkspaceTab =
  | "study"
  | "ask"
  | "ground"
  | "weave"
  | "write"
  | "cockpit"
  | "outline"
  | "chat"
  | "manuscript";

export interface BookWorkspaceNavTarget {
  readonly toBook: (bookId: string) => void;
  readonly toOutline: (bookId: string) => void;
  readonly toBookChat: (bookId: string) => void;
  readonly toBookSettings: (bookId: string) => void;
  readonly toAsk?: (bookId: string) => void;
  readonly toGround?: (bookId: string) => void;
  readonly toWeave?: (bookId: string) => void;
  readonly toWrite?: (bookId: string) => void;
  readonly toTruth?: (bookId: string) => void;
  readonly toAnalytics?: (bookId: string) => void;
  readonly onToggleChat?: (bookId: string) => void;
  readonly chatOpen?: boolean;
}

const STEPS: ReadonlyArray<{ id: BookStageId; zh: string; en: string }> = [
  { id: "ask", zh: "问心", en: "Ask" },
  { id: "ground", zh: "研墨", en: "Ground" },
  { id: "weave", zh: "织卷", en: "Weave" },
  { id: "write", zh: "落笔", en: "Write" },
];

export function normalizeBookWorkspaceTab(active: BookWorkspaceTab): BookStageId | "study" {
  if (active === "cockpit" || active === "chat" || active === "study") return "study";
  if (active === "outline") return "weave";
  if (active === "manuscript") return "write";
  return active;
}

function stepDotClass(state: BookStepState, highlighted: boolean): string {
  if (highlighted || state === "current") {
    return "border-accent bg-background shadow-[0_0_0_2px_oklch(0.70_0.09_82)]";
  }
  if (state === "done") return "border-primary bg-primary";
  return "border-border bg-background";
}

export function BookWorkspaceNav({
  bookId,
  active,
  nav,
  isZh,
  chatOpen,
  stage,
}: {
  readonly bookId: string;
  readonly active: BookWorkspaceTab;
  readonly nav: BookWorkspaceNavTarget;
  readonly isZh: boolean;
  readonly chatOpen?: boolean;
  readonly stage?: BookStageSnapshot;
}) {
  const current = normalizeBookWorkspaceTab(active);
  const talkOpen = chatOpen ?? Boolean(nav.chatOpen);
  const [loaded, setLoaded] = useState<BookStageSnapshot | null>(stage ?? null);

  useEffect(() => {
    if (stage) {
      setLoaded(stage);
      return;
    }
    let cancelled = false;
    void fetchJson<BookStageSnapshot>(`/books/${encodeURIComponent(bookId)}/stage`)
      .then((body) => {
        if (!cancelled) setLoaded(body);
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, stage]);

  const goAsk = () => (nav.toAsk ?? nav.toBook)(bookId);
  const goGround = () => (nav.toGround ?? nav.toTruth ?? nav.toBook)(bookId);
  const goWeave = () => (nav.toWeave ?? nav.toOutline)(bookId);
  const goWrite = () => (nav.toWrite ?? nav.toBookSettings)(bookId);
  const goStep = (id: BookStageId) => {
    if (id === "ask") goAsk();
    else if (id === "ground") goGround();
    else if (id === "weave") goWeave();
    else goWrite();
  };

  return (
    <nav className="flex flex-wrap items-center gap-2" data-testid="book-workspace-nav">
      <button
        type="button"
        data-testid="book-tab-study"
        onClick={() => nav.toBook(bookId)}
        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
          current === "study"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        {isZh ? "书房" : "Study"}
      </button>

      <ol className="flex items-center gap-1" data-testid="book-stage-strip">
        {STEPS.map((step, index) => {
          const state = loaded?.steps[step.id] ?? (current === step.id ? "current" : "todo");
          const highlighted = current === step.id;
          return (
            <li key={step.id} className="flex items-center gap-1">
              {index > 0 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
              <button
                type="button"
                data-testid={`book-step-${step.id}`}
                data-state={state}
                onClick={() => goStep(step.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors ${
                  highlighted ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full border ${stepDotClass(state, highlighted)}`}
                  aria-hidden="true"
                />
                {isZh ? step.zh : step.en}
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        data-testid="book-tab-talk"
        onClick={() => (nav.onToggleChat ?? nav.toBookChat)(bookId)}
        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
          talkOpen
            ? "bg-primary text-primary-foreground"
            : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        {isZh ? "对谈" : "Talk"}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="book-tab-more"
          className="inline-flex items-center rounded-lg bg-secondary/50 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <MoreHorizontal size={14} />
          <span className="sr-only">{isZh ? "更多" : "More"}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => goWrite()}>
            {isZh ? "书籍设置" : "Book settings"}
          </DropdownMenuItem>
          {nav.toTruth && (
            <DropdownMenuItem onClick={() => nav.toTruth?.(bookId)}>
              {isZh ? "真相文件" : "Truth files"}
            </DropdownMenuItem>
          )}
          {nav.toAnalytics && (
            <DropdownMenuItem onClick={() => nav.toAnalytics?.(bookId)}>
              {isZh ? "数据分析" : "Analytics"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
