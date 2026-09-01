/**
 * High-frequency book chrome: 驾驶舱 / 大纲 / 织卷 / 书稿.
 * Volume close is not a tab.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Compass, ListTree, Feather, FileText } from "lucide-react";

export type BookWorkspaceTab = "cockpit" | "outline" | "chat" | "manuscript";

export interface BookWorkspaceNavTarget {
  readonly toBook: (bookId: string) => void;
  readonly toOutline: (bookId: string) => void;
  readonly toBookChat: (bookId: string) => void;
  readonly toBookSettings: (bookId: string) => void;
}

export function BookWorkspaceNav({
  bookId,
  active,
  nav,
  isZh,
}: {
  readonly bookId: string;
  readonly active: BookWorkspaceTab;
  readonly nav: BookWorkspaceNavTarget;
  readonly isZh: boolean;
}) {
  const items: ReadonlyArray<{
    readonly id: BookWorkspaceTab;
    readonly label: string;
    readonly icon: React.ReactNode;
    readonly onClick: () => void;
  }> = [
    {
      id: "cockpit",
      label: isZh ? "驾驶舱" : "Cockpit",
      icon: <Compass size={14} />,
      onClick: () => nav.toBook(bookId),
    },
    {
      id: "outline",
      label: isZh ? "大纲" : "Outline",
      icon: <ListTree size={14} />,
      onClick: () => nav.toOutline(bookId),
    },
    {
      id: "chat",
      label: isZh ? "织卷" : "织卷",
      icon: <Feather size={14} />,
      onClick: () => nav.toBookChat(bookId),
    },
    {
      id: "manuscript",
      label: isZh ? "书稿" : "Manuscript",
      icon: <FileText size={14} />,
      onClick: () => nav.toBookSettings(bookId),
    },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-1" data-testid="book-workspace-nav">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid={`book-tab-${item.id}`}
          onClick={item.onClick}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            active === item.id
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
