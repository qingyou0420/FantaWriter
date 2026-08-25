import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleIdleWork } from "./schedule-idle";

describe("scheduleIdleWork", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses requestIdleCallback when available so startup work yields", () => {
    const fn = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal(
      "requestIdleCallback",
      (cb: IdleRequestCallback, opts?: IdleRequestOptions) => {
        expect(opts?.timeout).toBe(2000);
        cb({
          didTimeout: false,
          timeRemaining: () => 10,
        } as IdleDeadline);
        return 7;
      }
    );
    vi.stubGlobal("cancelIdleCallback", cancel);
    const stop = scheduleIdleWork(fn, 2000);
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it("returns a cancel function", () => {
    const fn = vi.fn();
    const stop = scheduleIdleWork(fn, 2000);
    expect(typeof stop).toBe("function");
    stop();
  });
});
