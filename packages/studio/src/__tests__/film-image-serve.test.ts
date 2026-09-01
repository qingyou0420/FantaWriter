import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStudioServer } from "../api/server.js";

const PNG = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

describe("serve interactive-films images", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "if-serve-"));
    const dir = join(root, "interactive-films", "p", "assets", "nodes");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "s.png"), PNG);
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("serves a node image under interactive-films/", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/project/files/interactive-films/p/assets/nodes/s.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("still rejects path traversal", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/project/files/interactive-films/..%2F..%2Fsecret.png");
    expect(res.status).toBe(400);
  });
});
