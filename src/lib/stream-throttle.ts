/** 流式预览合帧：约 100ms 或一帧一次，避免每个 delta 重渲染整棵树 */

export type ThrottledTextSink = {
  push: (full: string) => void;
  flush: () => void;
  cancel: () => void;
};

export function createThrottledTextSink(
  apply: (full: string) => void,
  intervalMs = 100
): ThrottledTextSink {
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let raf = 0;
  let lastApply = 0;

  const emit = (value: string) => {
    lastApply = Date.now();
    apply(value);
  };

  const flushPending = () => {
    timer = null;
    raf = 0;
    if (pending == null) return;
    const value = pending;
    pending = null;
    emit(value);
  };

  return {
    push(full: string) {
      const now = Date.now();
      if (now - lastApply >= intervalMs) {
        pending = null;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (raf && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        emit(full);
        return;
      }
      pending = full;
      if (timer || raf) return;
      if (typeof requestAnimationFrame === "function") {
        raf = requestAnimationFrame(flushPending);
      } else {
        timer = setTimeout(flushPending, intervalMs);
      }
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (raf && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (pending != null) {
        const value = pending;
        pending = null;
        emit(value);
      }
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (raf && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      pending = null;
    },
  };
}
