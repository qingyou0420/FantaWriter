import { describe, expect, it } from "vitest";
import { DEFAULT_PIPELINE_STREAM_IDLE_TIMEOUT_MS } from "../llm/provider.js";
import { resolveGuardedPiStreamDeadline } from "../agent/pi-stream.js";

describe("resolveGuardedPiStreamDeadline", () => {
  it("keeps the 60s default when the stream has no tools", () => {
    expect(resolveGuardedPiStreamDeadline({})).toBeUndefined();
    expect(resolveGuardedPiStreamDeadline({ tools: [] })).toBeUndefined();
  });

  it("uses the pipeline 180s idle when book-chat tools such as write_truth_file are present", () => {
    expect(resolveGuardedPiStreamDeadline({
      tools: [{ name: "write_truth_file" }, { name: "read" }],
    })).toEqual({
      idleTimeoutMs: DEFAULT_PIPELINE_STREAM_IDLE_TIMEOUT_MS,
    });
    expect(DEFAULT_PIPELINE_STREAM_IDLE_TIMEOUT_MS).toBe(180_000);
  });

  it("lets an explicit worker override win over the tool-capable default", () => {
    expect(resolveGuardedPiStreamDeadline(
      { tools: [{ name: "submit_state" }] },
      { idleTimeoutMs: 240_000, firstEventTimeoutMs: 90_000 },
    )).toEqual({
      idleTimeoutMs: 240_000,
      firstEventTimeoutMs: 90_000,
    });
  });
});
