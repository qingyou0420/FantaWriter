/**
 * Shared GET /books/:id/stage with a module-level cache so chrome and pages
 * share one request per book / data version.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useState } from "react";
import type { BookStageView } from "../lib/book-stage";
import { useChatStore } from "../store/chat";
import { fetchJson } from "./use-api";

const cache = new Map<string, { version: number; data: BookStageView }>();
const inflight = new Map<string, Promise<BookStageView | null>>();

function loadStage(bookId: string, version: number): Promise<BookStageView | null> {
  const key = `${bookId}@${version}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = fetchJson<BookStageView>(`/books/${encodeURIComponent(bookId)}/stage`)
    .then((data) => {
      cache.set(bookId, { version, data });
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

export function useBookStage(bookId: string | undefined): BookStageView | null {
  const version = useChatStore((state) => state.bookDataVersion);
  const cached = bookId ? cache.get(bookId) : undefined;
  const [data, setData] = useState<BookStageView | null>(
    cached && cached.version === version ? cached.data : null,
  );

  useEffect(() => {
    if (!bookId) {
      setData(null);
      return;
    }
    const hit = cache.get(bookId);
    if (hit && hit.version === version) {
      setData(hit.data);
      return;
    }
    let cancelled = false;
    void loadStage(bookId, version).then((next) => {
      if (!cancelled) setData(next);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, version]);

  return data;
}
