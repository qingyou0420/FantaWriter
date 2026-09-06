/**
 * Book chrome: 书房 + 问心 · 研墨 · 织卷 · 落笔 + ⋯
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchJson } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";
import type { BookStageId, BookStageSnapshot, BookStepState } from "../lib/book-stage";
import { useChatStore } from "../store/chat";
import { BookSettingsDrawer } from "./BookSettingsDrawer";
import { BookToolsDrawer } from "./BookToolsDrawer";
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
  readonly toBookSettings: (bookId: string) => void;
  readonly toAsk: (bookId: string) => void;
  readonly toGround?: (bookId: string) => void;
  readonly toWeave?: (bookId: string) => void;
  readonly toWrite?: (bookId: string) => void;
  readonly toTruth?: (bookId: string) => void;
  readonly toAnalytics?: (bookId: string) => void;
  readonly toDashboard?: () => void;
}

const STEPS: ReadonlyArray<{ id: BookStageId; zh: string; en: string }> = [
  { id: "ask", zh: "问心", en: "Ask" },
  { id: "ground", zh: "研墨", en: "Ground" },
  { id: "weave", zh: "织卷", en: "Weave" },
  { id: "write", zh: "落笔", en: "Write" },
];

export function normalizeBookWorkspaceTab(active: BookWorkspaceTab): BookStageId | "study" {
  if (active === "cockpit" || active === "study") return "study";
  if (active === "chat") return "ask";
  if (active === "outline") return "weave";
  if (active === "manuscript") return "write";
  return active;
}

function stepDotClass(state: BookStepState): string {
  if (state === "current") {
    return "border-accent bg-background shadow-[0_0_0_2px_oklch(0.70_0.09_82)]";
  }
  if (state === "done") return "border-primary bg-primary";
  return "border-border bg-background";
}

function currentPageClass(active: boolean): string {
  return active
    ? "bg-primary text-primary-foreground"
    : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary";
}

export function BookWorkspaceNav({
  bookId,
  active,
  nav,
  isZh,
  stage,
  t,
}: {
  readonly bookId: string;
  readonly active: BookWorkspaceTab;
  readonly nav: BookWorkspaceNavTarget;
  readonly isZh: boolean;
  readonly stage?: BookStageSnapshot;
  readonly t?: TFunction;
}) {
  const current = normalizeBookWorkspaceTab(active);
  const [loaded, setLoaded] = useState<BookStageSnapshot | null>(stage ?? null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const bumpBookDataVersion = useChatStore((state) => state.bumpBookDataVersion);
  const copy = t ?? ((key: string) => key);

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

  const goAsk = () => nav.toAsk(bookId);
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
    <nav className="flex w-full items-center justify-between gap-3" data-testid="book-workspace-nav">
      <button
        type="button"
        data-testid="book-tab-study"
        onClick={() => nav.toBook(bookId)}
        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${currentPageClass(current === "study")}`}
      >
        {isZh ? "书房" : "Study"}
      </button>

      <div className="flex items-center gap-1">
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
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold transition-colors ${currentPageClass(highlighted)}`}
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full border ${stepDotClass(state)}`}
                    aria-hidden="true"
                  />
                  {isZh ? step.zh : step.en}
                </button>
              </li>
            );
          })}
        </ol>

        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="book-tab-more"
            className="inline-flex items-center rounded-lg bg-secondary/50 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <MoreHorizontal size={14} />
            <span className="sr-only">{isZh ? "更多" : "More"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              {isZh ? "书籍设置" : "Book settings"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setToolsOpen(true)}>
              {isZh ? "更多工具" : "More tools"}
            </DropdownMenuItem>
            {nav.toTruth && (
              <DropdownMenuItem onClick={() => nav.toTruth?.(bookId)}>
                {isZh ? "真相文件" : "Truth files"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <BookSettingsDrawer
        bookId={bookId}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        t={copy}
        isZh={isZh}
        onDeleted={() => {
          bumpBookDataVersion();
          setSettingsOpen(false);
          if (nav.toDashboard) nav.toDashboard();
          else nav.toBook(bookId);
        }}
      />
      <BookToolsDrawer
        bookId={bookId}
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        t={copy}
        isZh={isZh}
        onOpenAnalytics={() => nav.toAnalytics?.(bookId)}
      />
    </nav>
  );
}
