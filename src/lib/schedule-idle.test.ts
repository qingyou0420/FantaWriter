import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleDeferredWork, scheduleIdleWork } from "./schedule-idle";

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

describe("scheduleDeferredWork", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses setTimeout, not requestIdleCallback", () => {
    const ric = vi.fn();
    vi.stubGlobal("requestIdleCallback", ric);
    vi.useFakeTimers();
    const fn = vi.fn();
    scheduleDeferredWork(fn, 20_000);
    expect(ric).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(19_999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("can yield one macrotask with delay 0", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const stop = scheduleDeferredWork(fn, 0);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
  });
});
