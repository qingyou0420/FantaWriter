import { describe, expect, it } from "vitest";
import {
  UserFacingError,
  isTransientAiError,
  splitErrorForDisplay,
} from "./user-error";

describe("isTransientAiError", () => {
  it("treats 5xx / timeout / network as retryable", () => {
    expect(isTransientAiError("HTTP 502 Bad Gateway")).toBe(true);
    expect(isTransientAiError(new Error("service unavailable"))).toBe(true);
    expect(isTransientAiError("request timeout")).toBe(true);
    expect(isTransientAiError("fetch failed")).toBe(true);
    expect(isTransientAiError("中转长时间无响应（timeout）")).toBe(true);
  });

  it("does not retry auth or validation errors", () => {
    expect(isTransientAiError("鉴权失败。请在设置 → API 设置里核对密钥。")).toBe(
      false
    );
    expect(isTransientAiError("未配置密钥")).toBe(false);
  });
});

describe("splitErrorForDisplay", () => {
  it("keeps the human line and the diagnostic apart", () => {
    const err = new UserFacingError("网络中断，请检查连接后重试。", "HTTP 0 · fetch failed");
    const split = splitErrorForDisplay(err);
    expect(split.message).toBe("网络中断，请检查连接后重试。");
    expect(split.diagnostic).toBe("HTTP 0 · fetch failed");
    expect(split.message).not.toMatch(/provider=|\.env\.local|key=/);
  });
});
