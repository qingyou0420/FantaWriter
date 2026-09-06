import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTHOR_BIO_MAX,
  AUTHOR_NAME_MAX,
  clearAuthorAvatar,
  loadAuthorProfile,
  normalizeAuthorPatch,
  parseAuthorProfile,
  saveAuthorAvatar,
  saveAuthorProfile,
  toAuthorPublic,
} from "./author-io";

describe("author-io", () => {
  it("parses and normalizes author fields", () => {
    expect(parseAuthorProfile({ name: "苏绻", bio: "写古风", avatarPath: ".inkos/author/avatar.png", updatedAt: "t" })).toEqual({
      name: "苏绻",
      bio: "写古风",
      avatarPath: ".inkos/author/avatar.png",
      updatedAt: "t",
    });
    expect(normalizeAuthorPatch({ name: "  墨生  " })).toEqual({ name: "墨生" });
    expect(normalizeAuthorPatch({ name: "x".repeat(AUTHOR_NAME_MAX + 1) })).toMatchObject({ error: expect.stringContaining("24") });
    expect(normalizeAuthorPatch({ bio: "y".repeat(AUTHOR_BIO_MAX + 1) })).toMatchObject({ error: expect.stringContaining("300") });
  });

  it("writes author.json under the explicit project root", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkborne-author-"));
    const saved = await saveAuthorProfile(root, {
      name: "苏绻",
      bio: "书院春日",
      updatedAt: "2026-09-06T00:00:00.000Z",
    });
    const disk = JSON.parse(await readFile(join(root, ".inkos", "author.json"), "utf-8")) as { name: string };
    expect(disk.name).toBe("苏绻");
    expect(toAuthorPublic(saved).hasAvatar).toBe(false);
    const loaded = await loadAuthorProfile(root);
    expect(loaded.name).toBe("苏绻");
  });

  it("stores an avatar ≤2MB and can remove it", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkborne-avatar-"));
    await mkdir(join(root, ".inkos"), { recursive: true });
    await writeFile(join(root, ".inkos", "author.json"), "{}\n", "utf-8");
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const withAvatar = await saveAuthorAvatar(root, bytes, "image/png", "mark.png");
    expect(withAvatar.avatarPath).toBe(".inkos/author/avatar.png");
    await expect(readFile(join(root, ".inkos", "author", "avatar.png"))).resolves.toHaveLength(8);
    const cleared = await clearAuthorAvatar(root);
    expect(cleared.avatarPath).toBeUndefined();
  });
});
