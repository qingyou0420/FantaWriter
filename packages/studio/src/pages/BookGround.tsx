/**
 * 研墨: five-zone editor + 研墨定稿 + AI 铺细节 via TruthProposal gate.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useMemo, useState } from "react";
import type { BookWorkspaceNavTarget } from "../components/BookWorkspaceNav";
import { invalidateBookStage, useBookStage } from "../hooks/use-book-stage";
import { useChatStore } from "../store/chat";
import { StageDot } from "../components/StageDot";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LiteraryEmpty } from "../components/LiteraryEmpty";
import { TruthProposalCard, type PendingTruthProposal } from "../components/TruthProposalCard";
import { fetchJson, postApi, useApi } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";
import type { Theme } from "../hooks/use-theme";
import { GROUND_REEDIT_WARNING, validateGroundConfirm } from "../lib/ground-confirm";
import {
  addOpenQuestion,
  CONTINUE_WITH_OPEN_MARK,
  parseOpenQuestions,
  removeOpenQuestion,
  serializeOpenQuestions,
  type OpenQuestionsDoc,
} from "../lib/open-questions";
import { showToast } from "../lib/toast";
import { extractStoryFrameZone, replaceStoryFrameZone, type GroundFrameZone } from "../lib/story-frame-sections";
import { storyFrameHasFourSections } from "../lib/book-stage";

type GroundNavKey = "world" | "characters" | "conflict" | "ending" | "open";

interface Nav extends BookWorkspaceNavTarget {
  readonly toDashboard: () => void;
  readonly toTruth: (bookId: string) => void;
}

interface TruthFile {
  readonly name: string;
  readonly size: number;
}

const NAV: ReadonlyArray<{ id: GroundNavKey; zh: string; en: string }> = [
  { id: "world", zh: "世界规则", en: "World" },
  { id: "characters", zh: "人物", en: "People" },
  { id: "conflict", zh: "关系与主线", en: "Conflict" },
  { id: "ending", zh: "结局与伏笔", en: "Ending" },
  { id: "open", zh: "待定项", en: "Open" },
];

export function BookGround({
  bookId,
  nav,
  t,
  isZh,
}: {
  readonly bookId: string;
  readonly nav: Nav;
  readonly theme: Theme;
  readonly t: TFunction;
  readonly isZh: boolean;
}) {
  const { data: bookData } = useApi<{ book?: { title?: string } }>(`/books/${bookId}`);
  const { data: filesData, refetch: refetchFiles } = useApi<{ files?: ReadonlyArray<TruthFile> }>(`/books/${bookId}/truth`);
  const { data: frameData, refetch: refetchFrame } = useApi<{ content?: string | null }>(`/books/${bookId}/truth/outline/story_frame.md`);
  const { data: hooksData, refetch: refetchHooks } = useApi<{ content?: string | null }>(`/books/${bookId}/truth/pending_hooks.md`);
  const { data: openData, refetch: refetchOpen } = useApi<{ content?: string | null }>(`/books/${bookId}/truth/open_questions.md`);
  const stageData = useBookStage(bookId);
  const bumpBookDataVersion = useChatStore((state) => state.bumpBookDataVersion);
  const refreshStage = () => {
    invalidateBookStage(bookId);
    bumpBookDataVersion();
  };
  const { data: proposalsData, refetch: refetchProposals } = useApi<{ proposals?: ReadonlyArray<PendingTruthProposal> }>(
    `/books/${bookId}/truth-proposals?status=pending`,
  );
  const title = bookData?.book?.title ?? bookId;
  const files = filesData?.files ?? [];
  const roleFiles = files.filter((file) => /^roles\/(主要角色|major)\//.test(file.name));
  const allRoleFiles = files.filter((file) => file.name.startsWith("roles/"));
  const [section, setSection] = useState<GroundNavKey>("world");
  const [frameText, setFrameText] = useState("");
  const [hooksText, setHooksText] = useState("");
  const [openDoc, setOpenDoc] = useState<OpenQuestionsDoc>({ items: [], continueWithOpen: false });
  const [openDraft, setOpenDraft] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [roleText, setRoleText] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revising, setRevising] = useState(false);
  const confirmed = Boolean(stageData?.workflow?.groundConfirmedAt);

  useEffect(() => {
    setFrameText(frameData?.content ?? "");
  }, [frameData?.content]);
  useEffect(() => {
    setHooksText(hooksData?.content ?? "");
  }, [hooksData?.content]);
  useEffect(() => {
    setOpenDoc(parseOpenQuestions(openData?.content ?? ""));
  }, [openData?.content]);
  useEffect(() => {
    if (!selectedRole && allRoleFiles[0]) setSelectedRole(allRoleFiles[0].name);
  }, [allRoleFiles, selectedRole]);

  const { data: roleFile } = useApi<{ content?: string | null }>(
    selectedRole ? `/books/${bookId}/truth/${selectedRole}` : "",
  );
  useEffect(() => {
    setRoleText(roleFile?.content ?? "");
  }, [roleFile?.content, selectedRole]);

  const frameReady = storyFrameHasFourSections(frameText);
  const validation = validateGroundConfirm({
    storyFrameFourSections: frameReady,
    majorRoleCount: roleFiles.length,
    openQuestions: openDoc,
  }, isZh);
  const zoneReady = {
    world: extractStoryFrameZone(frameText, "world").body.trim().length > 0,
    characters: roleFiles.length > 0,
    conflict: extractStoryFrameZone(frameText, "conflict").body.trim().length > 0,
    ending: extractStoryFrameZone(frameText, "ending").body.trim().length > 0,
    open: openDoc.items.length === 0 || openDoc.continueWithOpen,
  };

  const warnIfConfirmed = () => {
    if (confirmed) showToast(isZh ? GROUND_REEDIT_WARNING.zh : GROUND_REEDIT_WARNING.en, "info");
  };

  const saveTruth = async (file: string, content: string) => {
    setSaving(true);
    try {
      await fetchJson(`/books/${bookId}/truth/${file}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      warnIfConfirmed();
      await Promise.all([refetchFrame(), refetchHooks(), refetchOpen(), refetchFiles()]);
      refreshStage();
      showToast(isZh ? "已保存" : "Saved", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const saveZone = async (zone: GroundFrameZone, body: string) => {
    const next = replaceStoryFrameZone(frameText, zone, body, isZh);
    setFrameText(next);
    await saveTruth("outline/story_frame.md", next);
  };

  const confirmGround = async () => {
    try {
      await postApi(`/books/${bookId}/ground/confirm`, { continueWithOpen: openDoc.continueWithOpen });
      setConfirmOpen(false);
      refreshStage();
      showToast(isZh ? "研墨已定稿" : "Ground confirmed", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("common.error"), "error");
    }
  };

  const reviseFoundation = async () => {
    setRevising(true);
    try {
      await postApi(`/books/${bookId}/foundation/revise`, {
        feedback: isZh
          ? "请根据现有故事卡与设定，把世界规则、人物、关系与主线、结局与伏笔铺开。不要直接改文件，产出待确认的正典变更。"
          : "Expand world, characters, conflict, and ending from the story card. Do not write files directly — emit canon proposals.",
      });
      await refetchProposals();
      showToast(isZh ? "正典变更待确认" : "Canon proposals ready", "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("common.error"), "error");
    } finally {
      setRevising(false);
    }
  };

  const proposals = proposalsData?.proposals ?? [];
  const zoneBody = useMemo(() => {
    if (section === "world") return extractStoryFrameZone(frameText, "world").body;
    if (section === "conflict") return extractStoryFrameZone(frameText, "conflict").body;
    if (section === "ending") return extractStoryFrameZone(frameText, "ending").body;
    return "";
  }, [frameText, section]);
  const [draft, setDraft] = useState(zoneBody);
  useEffect(() => {
    setDraft(zoneBody);
  }, [zoneBody, section]);

  return (
    <div className="space-y-6 fade-in" data-testid="book-ground-page">
      <header className="space-y-2">
        <p className="eyebrow text-[13px] font-medium text-muted-foreground">{isZh ? `《${title}》` : title}</p>
        <h1 className="font-serif text-[32px] font-medium leading-10">{isZh ? "研墨" : "Ground"}</h1>
        <p className="text-[15px] leading-7 text-muted-foreground">
          {isZh ? "把世界与人磨实，定稿后开始织卷。" : "Settle the world and people, then start weaving."}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-border/60 bg-card p-2" data-testid="ground-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`ground-nav-${item.id}`}
              onClick={() => setSection(item.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                section === item.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{isZh ? item.zh : item.en}</span>
              <StageDot state={zoneReady[item.id] ? "done" : "blocked"} />
            </button>
          ))}
        </aside>

        <section className="min-h-[28rem] rounded-xl border border-border/60 bg-card p-5 space-y-4">
          {section === "characters" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {allRoleFiles.length === 0 ? (
                  <LiteraryEmpty
                    title={isZh ? "还没有人物" : "No characters yet"}
                    subtitle={isZh ? "让 AI 铺细节，或先在原始文件里写下主角。" : "Ask AI to expand, or add a protagonist file."}
                    action={isZh ? "让 AI 铺细节" : "Ask AI to expand"}
                    onAction={() => void reviseFoundation()}
                    testId="ground-characters-empty"
                  />
                ) : allRoleFiles.map((file) => (
                  <button
                    key={file.name}
                    type="button"
                    onClick={() => setSelectedRole(file.name)}
                    className={`rounded-full px-3 py-1 text-[13px] ${selectedRole === file.name ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                  >
                    {file.name.replace(/^roles\/(主要角色|次要角色|major|minor)\//, "").replace(/\.md$/, "")}
                  </button>
                ))}
              </div>
              {selectedRole && (
                <>
                  <textarea
                    data-testid="ground-role-editor"
                    value={roleText}
                    onChange={(event) => setRoleText(event.target.value)}
                    rows={16}
                    className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-sm leading-6"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveTruth(selectedRole, roleText)}
                    className="rounded-xl bg-secondary px-4 py-2 text-sm"
                  >
                    {isZh ? "保存人物" : "Save character"}
                  </button>
                </>
              )}
            </div>
          ) : section === "open" ? (
            <div className="space-y-4" data-testid="ground-open-questions">
              <ul className="space-y-2">
                {openDoc.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-[15px]">
                    <input
                      type="checkbox"
                      onChange={() => {
                        const next = removeOpenQuestion(openDoc, item.id);
                        setOpenDoc(next);
                        void saveTruth("open_questions.md", serializeOpenQuestions(next));
                      }}
                    />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = addOpenQuestion(openDoc, openDraft);
                  setOpenDoc(next);
                  setOpenDraft("");
                  void saveTruth("open_questions.md", serializeOpenQuestions(next));
                }}
                className="flex gap-2"
              >
                <input
                  data-testid="open-question-input"
                  value={openDraft}
                  onChange={(event) => setOpenDraft(event.target.value)}
                  placeholder={isZh ? "回车添加待定项" : "Enter to add"}
                  className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-xl bg-secondary px-3 py-2 text-sm">{isZh ? "添加" : "Add"}</button>
              </form>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  data-testid="continue-with-open"
                  checked={openDoc.continueWithOpen}
                  onChange={(event) => {
                    const next = { ...openDoc, continueWithOpen: event.target.checked };
                    setOpenDoc(next);
                    void saveTruth("open_questions.md", serializeOpenQuestions(next));
                  }}
                />
                {isZh ? CONTINUE_WITH_OPEN_MARK : "Continue with open questions"}
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                data-testid={`ground-editor-${section}`}
                value={section === "ending" ? `${draft}${hooksText ? `\n\n---\n${hooksText}` : ""}` : draft}
                onChange={(event) => {
                  if (section === "ending") {
                    const [framePart, hooksPart] = event.target.value.split(/\n---\n/);
                    setDraft(framePart ?? "");
                    if (hooksPart !== undefined) setHooksText(hooksPart);
                  } else {
                    setDraft(event.target.value);
                  }
                }}
                rows={16}
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm leading-7"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (section === "ending") {
                      void saveZone("ending", draft.split(/\n---\n/)[0] ?? draft);
                      void saveTruth("pending_hooks.md", hooksText);
                    } else if (section === "world") {
                      void saveZone("world", draft);
                    } else {
                      void saveZone("conflict", draft);
                    }
                  }}
                  className="rounded-xl bg-secondary px-4 py-2 text-sm"
                >
                  {isZh ? "保存" : "Save"}
                </button>
                <button
                  type="button"
                  data-testid="ground-ai-expand"
                  disabled={revising}
                  onClick={() => void reviseFoundation()}
                  className="rounded-xl border border-border/60 px-4 py-2 text-sm"
                >
                  {revising ? (isZh ? "铺开中…" : "Expanding…") : (isZh ? "让 AI 铺细节" : "Ask AI to expand")}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {proposals.length > 0 && (
        <div className="space-y-3" data-testid="ground-proposals">
          <div className="literary-kicker">{isZh ? "正典变更待确认" : "Canon changes"}</div>
          {proposals.map((proposal) => (
            <TruthProposalCard
              key={proposal.id}
              bookId={bookId}
              proposal={proposal}
              isZh={isZh}
              onResolved={() => {
                void refetchProposals();
                void refetchFiles();
                void refetchFrame();
              }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        {!validation.ok && (
          <ul className="text-sm text-muted-foreground" data-testid="ground-missing">
            {validation.missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
        <button
          type="button"
          data-testid="ground-confirm"
          disabled={!validation.ok}
          onClick={() => setConfirmOpen(true)}
          className="btn-primary ml-auto"
        >
          {isZh ? "研墨定稿" : "Confirm ground"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={isZh ? "研墨定稿" : "Confirm ground"}
        message={isZh ? "定稿后织卷将以此为据。之后仍可修改，但会提示影响。" : "Weaving will use this ground. Later edits will warn about impact."}
        confirmLabel={isZh ? "确认定稿" : "Confirm"}
        cancelLabel={isZh ? "再改改" : "Keep editing"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void confirmGround()}
      />
    </div>
  );
}
