"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getProject,
  initStorage,
  loadStyleLibraryFor,
  loadTagLibraryFor,
  upsertProject,
} from "@/lib/storage";
import {
  assertWritingBoardImmutable,
  normalizeProject,
  type LearnedStyle,
  type NovelProject,
} from "@/lib/types";

/**
 * 项目页状态 + 防抖落盘。
 * 用函数式 update，避免输入时 stale closure；离开页面前 flush。
 */
export function useProjectStore(projectId: string) {
  const [project, setProject] = useState<NovelProject | null>(null);
  const [saveHint, setSaveHint] = useState("");
  const [tagLibrary, setTagLibrary] = useState<string[]>([]);
  const [styleLibrary, setStyleLibrary] = useState<LearnedStyle[]>([]);
  const [ready, setReady] = useState(false);

  const skipPersistRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectRef = useRef<NovelProject | null>(null);

  useEffect(() => {
    let cancelled = false;
    skipPersistRef.current = true;
    (async () => {
      await initStorage();
      if (cancelled) return;
      const p = getProject(projectId);
      const normalized = p ? normalizeProject(p) : null;
      projectRef.current = normalized;
      setProject(normalized);
      setTagLibrary(loadTagLibraryFor(normalized?.writingBoard || "erotic"));
      setStyleLibrary(loadStyleLibraryFor(normalized?.writingBoard || "erotic"));
      setReady(true);
      requestAnimationFrame(() => {
        if (!cancelled) skipPersistRef.current = false;
      });
    })();
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (saveHintTimerRef.current) clearTimeout(saveHintTimerRef.current);
    };
  }, [projectId]);

  useEffect(() => {
    const refreshLibs = () => {
      const board = projectRef.current?.writingBoard || "erotic";
      setTagLibrary(loadTagLibraryFor(board));
      setStyleLibrary(loadStyleLibraryFor(board));
    };
    window.addEventListener("focus", refreshLibs);
    return () => window.removeEventListener("focus", refreshLibs);
  }, []);

  useEffect(() => {
    if (!project) return;
    projectRef.current = project;
    if (skipPersistRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      upsertProject(project);
      setSaveHint("已自动保存");
      if (saveHintTimerRef.current) clearTimeout(saveHintTimerRef.current);
      saveHintTimerRef.current = setTimeout(() => setSaveHint(""), 1500);
    }, 280);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [project]);

  useEffect(() => {
    const flush = () => {
      const p = projectRef.current;
      if (!p || skipPersistRef.current) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      upsertProject(p);
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const update = useCallback(
    (patch: Partial<NovelProject> | ((p: NovelProject) => NovelProject)) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next =
          typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        const stamped = { ...next, updatedAt: new Date().toISOString() };
        try {
          assertWritingBoardImmutable(prev, stamped);
        } catch {
          return prev;
        }
        projectRef.current = stamped;
        return stamped;
      });
    },
    []
  );

  const flushNow = useCallback(() => {
    const p = projectRef.current;
    if (!p) return p;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    upsertProject(p);
    return p;
  }, []);

  const getLive = useCallback((): NovelProject | null => {
    return projectRef.current || getProject(projectId);
  }, [projectId]);

  return {
    project,
    setProject,
    update,
    saveHint,
    tagLibrary,
    styleLibrary,
    setStyleLibrary,
    ready,
    projectRef,
    flushNow,
    getLive,
  };
}
