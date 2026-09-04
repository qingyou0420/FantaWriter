import { describe, expect, it, vi } from "vitest";
import { StudioApiError } from "../hooks/use-api";
import { selectWorksListShorts } from "../shared/short-works";
import {
  deleteStudioShortWork,
  encodeShortApiPath,
  isShortAlreadyGoneError,
  shortCollectionInvalidationPaths,
} from "./short-api";

describe("works list short source", () => {
  it("reads only GET /shorts and ignores session/task short_fiction_created leftovers", () => {
    expect(selectWorksListShorts({ shorts: [] })).toEqual([]);
    expect(selectWorksListShorts(null)).toEqual([]);
    expect(selectWorksListShorts({
      shorts: [{
        id: "elevator",
        title: "电梯多一层",
        status: "outlining",
        manuscriptPath: "shorts/elevator",
        kind: "short",
      }],
    }).map((item) => item.id)).toEqual(["elevator"]);
    expect(selectWorksListShorts({
      sessions: [{ details: { kind: "short_fiction_created", storyId: "明日来信" } }],
      tasks: [{ kind: "short_fiction_created", storyId: "明日来信" }],
    } as { shorts?: never; sessions: unknown; tasks: unknown })).toEqual([]);
  });
});

describe("short API paths", () => {
  it("encodes Chinese short ids the same way as the reader", () => {
    expect(encodeShortApiPath("明日来信")).toBe(`/shorts/${encodeURIComponent("明日来信")}`);
    expect(encodeShortApiPath("明日来信", "/export?format=txt")).toBe(
      `/shorts/${encodeURIComponent("明日来信")}/export?format=txt`,
    );
    expect(shortCollectionInvalidationPaths("明日来信")).toEqual([
      "/api/v1/shorts",
      `/api/v1/shorts/${encodeURIComponent("明日来信")}`,
    ]);
  });
});

describe("deleteStudioShortWork", () => {
  it("deletes via /shorts/:id and always invalidates the works list", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const invalidate = vi.fn();

    await expect(deleteStudioShortWork("明日来信", {
      fetchJson: fetchImpl as never,
      invalidate,
    })).resolves.toEqual({ ok: true, alreadyGone: false });

    expect(fetchImpl).toHaveBeenCalledWith(`/shorts/${encodeURIComponent("明日来信")}`, { method: "DELETE" });
    expect(invalidate).toHaveBeenCalledWith([
      "/api/v1/shorts",
      `/api/v1/shorts/${encodeURIComponent("明日来信")}`,
    ]);
  });

  it("treats an already-missing short as success so ghosts can be cleared", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new StudioApiError("Short not found", "NOT_FOUND", 404);
    });
    const invalidate = vi.fn();

    await expect(deleteStudioShortWork("明日来信", {
      fetchJson: fetchImpl as never,
      invalidate,
    })).resolves.toEqual({ ok: true, alreadyGone: true });
    expect(isShortAlreadyGoneError(new StudioApiError("missing", "NOT_FOUND", 404))).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
