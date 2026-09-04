import { describe, expect, it } from "vitest";
import {
  formatAgentModelReboundNotice,
  resolveAgentModelBinding,
} from "./resolve-agent-model.js";

describe("resolveAgentModelBinding", () => {
  it("follows the current Studio default after a session was created on another model", () => {
    const first = resolveAgentModelBinding({
      requestModel: "anthropic/claude-opus-4.8",
      requestService: "zenmux",
      defaultModel: "anthropic/claude-opus-4.8",
      defaultService: "zenmux",
    });
    expect(first).toMatchObject({
      model: "anthropic/claude-opus-4.8",
      service: "zenmux",
      source: "studio-default",
      reboundFromRequest: false,
    });

    const next = resolveAgentModelBinding({
      requestModel: "anthropic/claude-opus-4.8",
      requestService: "zenmux",
      defaultModel: "meta/muse-spark-1.3",
      defaultService: "zenmux",
    });
    expect(next).toMatchObject({
      model: "meta/muse-spark-1.3",
      service: "zenmux",
      source: "studio-default",
      reboundFromRequest: true,
    });
    expect(formatAgentModelReboundNotice(next, "zh")).toContain("meta/muse-spark-1.3");
  });

  it("keeps an explicit per-session override when the global default changes", () => {
    const binding = resolveAgentModelBinding({
      sessionModelOverride: "anthropic/claude-opus-4.8",
      sessionServiceOverride: "zenmux",
      requestModel: "meta/muse-spark-1.3",
      requestService: "zenmux",
      defaultModel: "meta/muse-spark-1.3",
      defaultService: "zenmux",
    });
    expect(binding).toMatchObject({
      model: "anthropic/claude-opus-4.8",
      service: "zenmux",
      source: "session-override",
    });
  });

  it("keeps a named custom:zenmux Studio default instead of collapsing to custom", () => {
    const binding = resolveAgentModelBinding({
      requestModel: "anthropic/claude-opus-4.8",
      requestService: "custom",
      defaultModel: "anthropic/claude-opus-4.8",
      defaultService: "custom:zenmux",
    });
    expect(binding).toMatchObject({
      model: "anthropic/claude-opus-4.8",
      service: "custom:zenmux",
      source: "studio-default",
      reboundFromRequest: true,
    });
  });

  it("uses the request model only when Studio has no default", () => {
    const binding = resolveAgentModelBinding({
      requestModel: "kimi-k3",
      requestService: "moonshot",
    });
    expect(binding).toMatchObject({
      model: "kimi-k3",
      service: "moonshot",
      source: "request",
      reboundFromRequest: false,
    });
  });
});
