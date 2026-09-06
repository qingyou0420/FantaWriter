import { cn } from "../../lib/utils";
import { tr } from "../../lib/app-language";
import { parsePendingHooks } from "../../lib/truth-display";

interface PendingHooksViewProps {
  readonly content: string;
}

const HOOK_TYPE_COLOR: Record<string, string> = {
  "主线伏笔": "bg-mark-soft text-mark-text dark:text-mark-text",
  "角色前置": "bg-ok/15 text-foreground dark:text-foreground",
  "情感线伏笔": "bg-muted text-muted-foreground dark:text-muted-foreground",
  "次要伏笔": "bg-muted text-muted-foreground",
};

function hookTypeColor(type: string): string {
  return HOOK_TYPE_COLOR[type] ?? "bg-muted text-muted-foreground dark:text-muted-foreground";
}

// Renders pending_hooks.md (a 13-column tracking table) as browsable cards: the
// actual foreshadow text up front, with type / core / payoff as small tags.
// Bookkeeping columns (half-life, dependencies, …) are intentionally dropped.
export function PendingHooksView({ content }: PendingHooksViewProps) {
  const hooks = parsePendingHooks(content);
  if (hooks.length === 0) {
    return (
      <p className="text-[14px] leading-6 text-muted-foreground/60 italic">
        {tr("还没有埋下伏笔。", "No foreshadowing planted yet.")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {hooks.map((hook) => (
        <div key={hook.id} className="rounded-lg bg-secondary/30 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {hook.promoted === false && (
              <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {tr("种子", "Seed")}
              </span>
            )}
            {hook.promoted === true && (
              <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-ok/15 text-foreground dark:text-foreground">
                {tr("活跃", "Active")}
              </span>
            )}
            {hook.type && (
              <span className={cn("text-[12px] px-1.5 py-0.5 rounded-full", hookTypeColor(hook.type))}>
                {hook.type}
              </span>
            )}
            {hook.core && (
              <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-mark-soft text-mark-text dark:text-mark-text">
                {tr("核心", "Core")}
              </span>
            )}
            {hook.payoff && (
              <span className="text-[12px] text-muted-foreground/50 ml-auto">{tr("回收", "Payoff")} · {hook.payoff}</span>
            )}
          </div>
          <p className="text-[15px] text-foreground leading-7 font-['SimSun','Songti_SC','STSong',serif]">
            {hook.content}
          </p>
        </div>
      ))}
    </div>
  );
}
