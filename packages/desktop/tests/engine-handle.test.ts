import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  emptyEngineHandle,
  hasLiveEngine,
  engineKillPid,
  adoptEngine,
  attachSpawnedEngine,
  clearEngineHandle,
  shouldStopEngine,
} = require("../lib/engine-handle.cjs") as {
  emptyEngineHandle: () => {
    child: { pid?: number } | null;
    pid: number;
    port: number;
    token: string;
  };
  hasLiveEngine: (handle: unknown) => boolean;
  engineKillPid: (handle: unknown) => number;
  adoptEngine: (
    handle: ReturnType<typeof emptyEngineHandle>,
    health: { ok?: boolean; pid?: number; instanceToken?: string },
    port: number,
  ) => ReturnType<typeof emptyEngineHandle>;
  attachSpawnedEngine: (
    handle: ReturnType<typeof emptyEngineHandle>,
    child: { pid?: number },
    port: number,
    token: string,
  ) => ReturnType<typeof emptyEngineHandle>;
  clearEngineHandle: (handle: ReturnType<typeof emptyEngineHandle>) => ReturnType<typeof emptyEngineHandle>;
  shouldStopEngine: (handle: unknown) => boolean;
};

describe("engine handle adopt vs spawn", () => {
  it("does not treat an empty handle as stoppable (the pre-fix adopt bug)", () => {
    const handle = emptyEngineHandle();
    expect(hasLiveEngine(handle)).toBe(false);
    expect(shouldStopEngine(handle)).toBe(false);
    expect(engineKillPid(handle)).toBe(0);
  });

  it("tracks an adopted engine by pid/port/token without a ChildProcess", () => {
    const handle = emptyEngineHandle();
    adoptEngine(
      handle,
      { ok: true, pid: 4242, instanceToken: "tok-adopt" },
      17831,
    );
    expect(handle.child).toBeNull();
    expect(handle.pid).toBe(4242);
    expect(handle.port).toBe(17831);
    expect(handle.token).toBe("tok-adopt");
    expect(hasLiveEngine(handle)).toBe(true);
    expect(shouldStopEngine(handle)).toBe(true);
    expect(engineKillPid(handle)).toBe(4242);
  });

  it("refuses to adopt a health payload without a live pid", () => {
    const handle = emptyEngineHandle();
    expect(() => adoptEngine(handle, { ok: true }, 17831)).toThrow(/pid/);
    expect(shouldStopEngine(handle)).toBe(false);
  });

  it("tracks a spawned child the same way so quit and restart share one path", () => {
    const handle = emptyEngineHandle();
    attachSpawnedEngine(handle, { pid: 99 }, 17840, "tok-spawn");
    expect(engineKillPid(handle)).toBe(99);
    expect(shouldStopEngine(handle)).toBe(true);
    clearEngineHandle(handle);
    expect(shouldStopEngine(handle)).toBe(false);
    expect(engineKillPid(handle)).toBe(0);
  });
});
