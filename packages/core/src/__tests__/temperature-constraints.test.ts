import { describe, it, expect } from "vitest";
import { resolveServicePreset, clampTemperature, getWritingTemperature } from "../llm/service-presets.js";
import { getEndpoint } from "../llm/providers/index.js";
import { lookupModel } from "../llm/providers/lookup.js";
import {
  applyKimiK3RequestConstraints,
  isKimiK3Model,
  isMoonshotApiHost,
  isMoonshotFixedTemperatureModel,
  resolveMoonshotLockedTemperature,
} from "../llm/moonshot-sampling.js";

describe("temperature constraints per service", () => {
  it("moonshot has range [0, 1] and writingTemperature 1.0", () => {
    const preset = resolveServicePreset("moonshot");
    expect(preset?.temperatureRange).toEqual([0, 1]);
    expect(preset?.writingTemperature).toBe(1.0);
  });

  it("deepseek has range [0, 2] and writingTemperature 1.5", () => {
    const preset = resolveServicePreset("deepseek");
    expect(preset?.temperatureRange).toEqual([0, 2]);
    expect(preset?.writingTemperature).toBe(1.5);
  });

  it("anthropic has range [0, 1] and writingTemperature 1.0", () => {
    const preset = resolveServicePreset("anthropic");
    expect(preset?.temperatureRange).toEqual([0, 1]);
    expect(preset?.writingTemperature).toBe(1.0);
  });

  it("openai has range [0, 2] and writingTemperature 1.0", () => {
    const preset = resolveServicePreset("openai");
    expect(preset?.temperatureRange).toEqual([0, 2]);
    expect(preset?.writingTemperature).toBe(1.0);
  });

  it("zhipu has range [0, 1]", () => {
    const preset = resolveServicePreset("zhipu");
    expect(preset?.temperatureRange).toEqual([0, 1]);
  });

  it("bailian has range [0, 2]", () => {
    const preset = resolveServicePreset("bailian");
    expect(preset?.temperatureRange).toEqual([0, 2]);
  });

  it("minimax has range [0, 1]", () => {
    const preset = resolveServicePreset("minimax");
    expect(preset?.temperatureRange).toEqual([0, 1]);
  });

  it("clampTemperature respects service range", () => {
    expect(clampTemperature("moonshot", 1.5)).toBe(1.0);
    expect(clampTemperature("moonshot", 0.7)).toBe(0.7);
    expect(clampTemperature("deepseek", 1.5)).toBe(1.5);
    expect(clampTemperature("deepseek", 2.5)).toBe(2.0);
    expect(clampTemperature("unknown-service", 1.5)).toBe(1.5);
  });

  it("getWritingTemperature returns service-specific value", () => {
    expect(getWritingTemperature("moonshot")).toBe(1.0);
    expect(getWritingTemperature("deepseek")).toBe(1.5);
    expect(getWritingTemperature("anthropic")).toBe(1.0);
  });
});

describe("moonshot catalog + K3/K2.7 sampling lock", () => {
  it("lists kimi-k3 / k2.7-code and uses kimi-k3 as checkModel", () => {
    const moonshot = getEndpoint("moonshot");
    expect(moonshot?.checkModel).toBe("kimi-k3");
    expect(moonshot?.models.some((model) => model.id === "kimi-k3" && model.temperature === 1)).toBe(true);
    expect(moonshot?.models.some((model) => model.id === "kimi-k2.7-code" && model.temperature === 1)).toBe(true);
    expect(moonshot?.models.some((model) => model.id === "kimi-k2.7-code-highspeed" && model.temperature === 1)).toBe(true);
  });

  it("lookup finds kimi-k3 from the moonshot preset and via Layer 2 for custom", () => {
    expect(lookupModel("moonshot", "kimi-k3")?.temperature).toBe(1);
    expect(lookupModel("custom", "kimi-k3")?.temperature).toBe(1);
  });

  it("locks temperature by model id even without a service card", () => {
    expect(isMoonshotFixedTemperatureModel("kimi-k3")).toBe(true);
    expect(isMoonshotFixedTemperatureModel("kimi-k2.5")).toBe(true);
    expect(isMoonshotFixedTemperatureModel("kimi-k2.6")).toBe(true);
    expect(isMoonshotFixedTemperatureModel("kimi-k2.7-code")).toBe(true);
    expect(isMoonshotFixedTemperatureModel("kimi-k2.7-code-highspeed")).toBe(true);
    expect(isMoonshotFixedTemperatureModel("moonshotai/kimi-k3")).toBe(true);
    expect(isMoonshotFixedTemperatureModel("moonshot-v1-32k")).toBe(false);
    expect(isKimiK3Model("kimi-k3")).toBe(true);
    expect(isKimiK3Model("kimi-k2.5")).toBe(false);
    expect(resolveMoonshotLockedTemperature("kimi-k3")).toBe(1);
    expect(resolveMoonshotLockedTemperature("gpt-4o")).toBeUndefined();
  });

  it("recognizes official Moonshot hosts used by custom services", () => {
    expect(isMoonshotApiHost("https://api.moonshot.cn/v1")).toBe(true);
    expect(isMoonshotApiHost("https://api.moonshot.ai/v1")).toBe(true);
    expect(isMoonshotApiHost("https://api.openai.com/v1")).toBe(false);
    expect(resolveMoonshotLockedTemperature("kimi-k3", "https://api.moonshot.cn/v1")).toBe(1);
  });

  it("omits K3 fixed sampling fields and K2.x thinking from the JSON body", () => {
    const body = applyKimiK3RequestConstraints({
      model: "kimi-k3",
      temperature: 0.7,
      top_p: 0.5,
      n: 2,
      presence_penalty: 0.2,
      frequency_penalty: 0.1,
      thinking: { type: "enabled" },
      max_tokens: 4096,
    }, "kimi-k3");
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("n");
    expect(body).not.toHaveProperty("presence_penalty");
    expect(body).not.toHaveProperty("frequency_penalty");
    expect(body).not.toHaveProperty("thinking");
    expect(body.max_tokens).toBe(4096);

    const k25 = applyKimiK3RequestConstraints({
      model: "kimi-k2.5",
      temperature: 1,
      thinking: { type: "enabled" },
    }, "kimi-k2.5");
    expect(k25.temperature).toBe(1);
    expect(k25.thinking).toEqual({ type: "enabled" });
  });
});
