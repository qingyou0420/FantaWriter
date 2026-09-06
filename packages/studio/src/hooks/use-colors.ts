import type { Theme } from "./use-theme";

export function useColors(_theme: Theme) {
  return {
    card: "border-border hover:border-primary/40 transition-all duration-200",
    cardStatic: "border-border",
    surface: "bg-card",
    muted: "text-muted-foreground",
    subtle: "text-muted-foreground",
    link: "hover:text-primary transition-colors cursor-pointer",
    input: "bg-input/40 border border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200",
    btnPrimary: "bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 transition-opacity",
    btnSecondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors",
    btnSuccess: "bg-primary text-primary-foreground hover:bg-primary-hover transition-colors",
    btnDanger: "bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity",
    tableHeader: "bg-muted/60 text-muted-foreground text-xs font-medium",
    tableDivide: "divide-border",
    tableHover: "hover:bg-muted/40 transition-colors",
    error: "border-destructive/50 bg-destructive/10 text-destructive",
    info: "border-primary/30 bg-primary/8 text-primary",
    code: "bg-muted text-foreground/80 font-mono",
    active: "text-foreground",
    paused: "text-mark-text",
    mono: "font-mono text-sm",
    accent: "text-primary",
  };
}
