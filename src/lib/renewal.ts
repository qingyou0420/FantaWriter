import { detectCanonViolations, hasOriginalText } from "./original";
import type { LockedCanonFact, NovelProject, OriginalManuscript } from "./types";

/** 已挂原作正文的项目：按拍扩写，禁止一键全书/整卷 */
export function allowsWholeBookGenerate(
  project: Pick<NovelProject, "original"> | { original?: OriginalManuscript | null }
): boolean {
  return !hasOriginalText(project.original);
}

export function wholeBookGenerateBlockedReason(): string {
  return "已挂原作的项目请按拍扩写，不能一键生成全书或整卷";
}

export function evaluateRenewalSave(
  text: string,
  opts: {
    original?: OriginalManuscript | null;
    canon?: LockedCanonFact[] | null;
    force?: boolean;
  }
): { allowed: true; violations: string[] } | { allowed: false; violations: string[] } {
  const violations = detectCanonViolations(text, opts.canon);
  if (!hasOriginalText(opts.original)) {
    return { allowed: true, violations };
  }
  if (!violations.length || opts.force) {
    return { allowed: true, violations };
  }
  return { allowed: false, violations };
}

export type ChapterPersistResult =
  | { ok: true; violations: string[] }
  | { ok: false; violations: string[] };

export function persistResultFromVerdict(
  verdict: ReturnType<typeof evaluateRenewalSave>
): ChapterPersistResult {
  return verdict.allowed
    ? { ok: true, violations: verdict.violations }
    : { ok: false, violations: verdict.violations };
}
