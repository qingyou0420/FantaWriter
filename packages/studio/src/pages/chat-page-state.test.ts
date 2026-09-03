import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBookCreateSessionId,
  filterModelGroups,
  forgetBookCreateSessionIfMatches,
  getBookCreateSessionId,
  getChatScrollBehavior,
  getProjectChatSessionId,
  isReusableBookCreateSession,
  pickModelSelection,
  pickProjectChatSessionId,
  setBookCreateSessionId,
  setProjectChatSessionId,
  startFreshBookCreateSession,
  isChatScrollNearBottom,
  shouldShowPlayChoicePanel,
} from "./chat-page-state";

describe("book-create session localStorage helpers", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
  });

  afterEach(() => {
    storage.clear();
    vi.unstubAllGlobals();
  });

  it("getBookCreateSessionId returns null when empty", () => {
    expect(getBookCreateSessionId()).toBeNull();
  });

  it("setBookCreateSessionId + get round-trips", () => {
    setBookCreateSessionId("sess-123");
    expect(getBookCreateSessionId()).toBe("sess-123");
  });

  it("setBookCreateSessionId overwrites previous value", () => {
    setBookCreateSessionId("sess-old");
    setBookCreateSessionId("sess-new");
    expect(getBookCreateSessionId()).toBe("sess-new");
  });

  it("clearBookCreateSessionId removes the key", () => {
    setBookCreateSessionId("sess-123");
    clearBookCreateSessionId();
    expect(getBookCreateSessionId()).toBeNull();
  });

  it("clearBookCreateSessionId is safe when key doesn't exist", () => {
    clearBookCreateSessionId();
    expect(getBookCreateSessionId()).toBeNull();
  });

  it("keeps project chat session separate from book-create session", () => {
    setBookCreateSessionId("book-create-session");
    setProjectChatSessionId("project-chat-session");
    expect(getBookCreateSessionId()).toBe("book-create-session");
    expect(getProjectChatSessionId()).toBe("project-chat-session");
  });

  it("startFreshBookCreateSession always writes a new draft id", () => {
    setBookCreateSessionId("1788325716279-jn0y2m");
    const created: string[] = [];
    const first = startFreshBookCreateSession(() => {
      created.push("draft-1");
      return "draft-1";
    });
    const second = startFreshBookCreateSession(() => {
      created.push("draft-2");
      return "draft-2";
    });

    expect(first).toBe("draft-1");
    expect(second).toBe("draft-2");
    expect(created).toEqual(["draft-1", "draft-2"]);
    expect(getBookCreateSessionId()).toBe("draft-2");
  });

  it("创建 after delete opens a new session instead of resurrecting the old id", () => {
    setBookCreateSessionId("1788325716279-jn0y2m");
    forgetBookCreateSessionIfMatches("1788325716279-jn0y2m");
    expect(getBookCreateSessionId()).toBeNull();

    const nextId = startFreshBookCreateSession(() => "fresh-after-delete");
    expect(nextId).toBe("fresh-after-delete");
    expect(getBookCreateSessionId()).toBe("fresh-after-delete");
    expect(getBookCreateSessionId()).not.toBe("1788325716279-jn0y2m");
  });

  it("forgetBookCreateSessionIfMatches leaves a different stored session alone", () => {
    setBookCreateSessionId("keep-me");
    forgetBookCreateSessionIfMatches("other-session");
    expect(getBookCreateSessionId()).toBe("keep-me");
  });
});

describe("isReusableBookCreateSession", () => {
  it("allows an unused empty book-create draft", () => {
    expect(isReusableBookCreateSession({
      sessionId: "draft-empty",
      bookId: null,
      sessionKind: "book-create",
      isDraft: true,
      messageCount: 0,
    })).toBe(true);
  });

  it("does not auto-reopen a failed book-create session", () => {
    expect(isReusableBookCreateSession({
      sessionId: "1788325716279-jn0y2m",
      bookId: null,
      sessionKind: "book-create",
      messageCount: 4,
      lastError: "architect failed",
      taskStatus: "error",
    })).toBe(false);
    expect(isReusableBookCreateSession({
      sessionId: "1788325716279-jn0y2m",
      bookId: null,
      sessionKind: "book-create",
      messageCount: 2,
    })).toBe(false);
    expect(isReusableBookCreateSession({
      sessionId: "1788325716279-jn0y2m",
      bookId: null,
      sessionKind: "book-create",
      messageCount: 0,
      lastError: "kimi-k3 architect timed out",
    })).toBe(false);
    expect(isReusableBookCreateSession({
      sessionId: "1788325716279-jn0y2m",
      bookId: null,
      sessionKind: "book-create",
      messageCount: 0,
      taskStatus: "failed",
    })).toBe(false);
  });

  it("does not auto-reopen an in-progress or deleted book-create session", () => {
    expect(isReusableBookCreateSession({
      sessionId: "running-create",
      bookId: null,
      sessionKind: "book-create",
      messageCount: 1,
      taskStatus: "running",
    })).toBe(false);
    expect(isReusableBookCreateSession({
      sessionId: "deleted-create",
      bookId: null,
      sessionKind: "book-create",
      messageCount: 0,
      exists: false,
    })).toBe(false);
  });

  it("does not treat a missing or already-bound session as reusable", () => {
    expect(isReusableBookCreateSession(null)).toBe(false);
    expect(isReusableBookCreateSession({
      sessionId: "bound",
      bookId: "night-port",
      sessionKind: "book-create",
      messageCount: 0,
    })).toBe(false);
  });
});

describe("filterModelGroups", () => {
  const grouped = [
    {
      service: "openai",
      label: "OpenAI",
      models: [
        { id: "gpt-5.4", name: "gpt-5.4" },
        { id: "gpt-4o", name: "gpt-4o" },
      ],
    },
    {
      service: "custom:gemma",
      label: "LM Studio",
      models: [
        { id: "google/gemma-4-27b-it", name: "google/gemma-4-27b-it" },
      ],
    },
  ] as const;

  it("returns all groups when search is blank", () => {
    expect(filterModelGroups(grouped, "")).toEqual(grouped);
    expect(filterModelGroups(grouped, "   ")).toEqual(grouped);
  });

  it("filters by model name and preserves only matching groups", () => {
    expect(filterModelGroups(grouped, "gemma")).toEqual([
      {
        service: "custom:gemma",
        label: "LM Studio",
        models: [{ id: "google/gemma-4-27b-it", name: "google/gemma-4-27b-it" }],
      },
    ]);
  });

  it("filters by service label", () => {
    expect(filterModelGroups(grouped, "openai")).toEqual([
      {
        service: "openai",
        label: "OpenAI",
        models: [
          { id: "gpt-5.4", name: "gpt-5.4" },
          { id: "gpt-4o", name: "gpt-4o" },
        ],
      },
    ]);
  });
});

describe("pickModelSelection", () => {
  const grouped = [
    {
      service: "google",
      label: "Google Gemini",
      models: [
        { id: "gemini-2.5-flash", name: "gemini-2.5-flash" },
      ],
    },
    {
      service: "moonshot",
      label: "Moonshot",
      models: [
        { id: "kimi-k2.5", name: "kimi-k2.5" },
      ],
    },
  ] as const;

  it("keeps the current selection when it is still available", () => {
    expect(pickModelSelection(grouped, "kimi-k2.5", "moonshot")).toBeNull();
  });

  it("selects the first available model when current selection is missing", () => {
    expect(pickModelSelection(grouped, "gemini-3.1-flash-image-preview", "google")).toEqual({
      model: "gemini-2.5-flash",
      service: "google",
    });
  });

  it("selects the first available model when there is no current selection", () => {
    expect(pickModelSelection(grouped, null, null)).toEqual({
      model: "gemini-2.5-flash",
      service: "google",
    });
  });

  it("prefers the configured service and model when there is no current selection", () => {
    expect(pickModelSelection(grouped, null, null, {
      service: "moonshot",
      model: "kimi-k2.5",
    })).toEqual({
      model: "kimi-k2.5",
      service: "moonshot",
    });
  });

  it("prefers the configured service even when its configured model is stale", () => {
    expect(pickModelSelection(grouped, null, null, {
      service: "moonshot",
      model: "kimi-k3",
    })).toEqual({
      model: "kimi-k2.5",
      service: "moonshot",
    });
  });

  it("keeps a valid same-service selection when the configured model is not in the list yet", () => {
    const zenmux = [
      {
        service: "zenmux",
        label: "ZenMux",
        models: [
          { id: "anthropic/claude-opus-4.8", name: "Claude Opus 4.8" },
          { id: "meta/muse-spark-1.3", name: "Muse Spark 1.3" },
        ],
      },
    ] as const;
    expect(pickModelSelection(zenmux, "meta/muse-spark-1.3", "zenmux", {
      service: "zenmux",
      model: "kimi-k3",
    })).toBeNull();
  });

  it("follows the configured Studio default when it differs from the current selection", () => {
    expect(pickModelSelection(grouped, "gemini-2.5-flash", "google", {
      service: "moonshot",
      model: "kimi-k2.5",
    })).toEqual({
      model: "kimi-k2.5",
      service: "moonshot",
    });
  });

  it("rebinds an existing Opus picker to Muse Spark after the Studio default changes", () => {
    const zenmux = [
      {
        service: "zenmux",
        label: "ZenMux",
        models: [
          { id: "anthropic/claude-opus-4.8", name: "Claude Opus 4.8" },
          { id: "meta/muse-spark-1.3", name: "Muse Spark 1.3" },
        ],
      },
    ] as const;
    expect(pickModelSelection(zenmux, "anthropic/claude-opus-4.8", "zenmux", {
      service: "zenmux",
      model: "meta/muse-spark-1.3",
    })).toEqual({
      model: "meta/muse-spark-1.3",
      service: "zenmux",
    });
  });

  it("returns null when no models are available", () => {
    expect(pickModelSelection([], "gemini-3.1-flash-image-preview", "google")).toBeNull();
  });
});

describe("pickProjectChatSessionId", () => {
  it("prefers the newest project chat session that already has messages", () => {
    expect(pickProjectChatSessionId([
      { sessionId: "empty-latest", messageCount: 0 },
      { sessionId: "short-fiction-session", messageCount: 3 },
      { sessionId: "older-session", messageCount: 1 },
    ])).toBe("short-fiction-session");
  });

  it("can restore the latest non-chat project session after refresh", () => {
    expect(pickProjectChatSessionId([
      { sessionId: "play-session", sessionKind: "play", messageCount: 4 },
      { sessionId: "old-chat-session", sessionKind: "chat", messageCount: 9 },
    ])).toBe("play-session");
  });

  it("falls back to the newest empty session when all sessions are empty", () => {
    expect(pickProjectChatSessionId([
      { sessionId: "empty-latest", messageCount: 0 },
      { sessionId: "empty-older", messageCount: 0 },
    ])).toBe("empty-latest");
  });

  it("returns null when there is no project chat session", () => {
    expect(pickProjectChatSessionId([])).toBeNull();
  });
});

describe("shouldShowPlayChoicePanel", () => {
  it("does not show choices outside guided Play mode", () => {
    expect(shouldShowPlayChoicePanel({ playMode: "open", choiceSetKey: "a", consumedChoiceKey: null, choiceCount: 2 })).toBe(false);
    expect(shouldShowPlayChoicePanel({ playMode: undefined, choiceSetKey: "a", consumedChoiceKey: null, choiceCount: 2 })).toBe(false);
  });

  it("shows a fresh guided choice set", () => {
    expect(shouldShowPlayChoicePanel({ playMode: "guided", choiceSetKey: "turn-1", consumedChoiceKey: null, choiceCount: 2 })).toBe(true);
  });

  it("hides a guided choice set after it has been consumed", () => {
    expect(shouldShowPlayChoicePanel({ playMode: "guided", choiceSetKey: "turn-1", consumedChoiceKey: "turn-1", choiceCount: 2 })).toBe(false);
  });

  it("shows choices again when a new tool result creates a new source key", () => {
    expect(shouldShowPlayChoicePanel({ playMode: "guided", choiceSetKey: "turn-2", consumedChoiceKey: "turn-1", choiceCount: 2 })).toBe(true);
  });
});

describe("isChatScrollNearBottom", () => {
  it("treats the bottom and near-bottom positions as pinned", () => {
    expect(isChatScrollNearBottom({ scrollTop: 900, clientHeight: 300, scrollHeight: 1200 })).toBe(true);
    expect(isChatScrollNearBottom({ scrollTop: 830, clientHeight: 300, scrollHeight: 1200 })).toBe(true);
  });

  it("does not treat a user reading older messages as pinned to the bottom", () => {
    expect(isChatScrollNearBottom({ scrollTop: 500, clientHeight: 300, scrollHeight: 1200 })).toBe(false);
  });
});

describe("getChatScrollBehavior", () => {
  it("uses instant scroll while streaming to avoid stacked smooth-scroll animations", () => {
    expect(getChatScrollBehavior(true)).toBe("auto");
  });

  it("keeps smooth scroll for non-streaming message jumps", () => {
    expect(getChatScrollBehavior(false)).toBe("smooth");
  });
});
