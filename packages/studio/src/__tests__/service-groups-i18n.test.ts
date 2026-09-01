import { describe, it, expect, afterEach } from "vitest";
import { setAppLanguage } from "../lib/app-language";
import { getGroupDescription, getGroupLabel, getGroupShortLabel } from "../constants/service-groups";
import { getServiceQuickLinks } from "../components/ServiceQuickLinks";

// 每条用例结束后恢复默认语言，避免污染其他测试。
afterEach(() => {
  setAppLanguage("zh");
});

describe("service-groups i18n", () => {
  it("默认（zh）返回中文标签", () => {
    expect(getGroupLabel("overseas")).toBe("海外原厂");
    expect(getGroupShortLabel("aggregator")).toBe("聚合");
    expect(getGroupDescription("aggregator")).toContain("聚合国内外主流模型");
    expect(getGroupDescription("overseas")).toBeNull();
  });

  it("切换到 en 后返回英文标签", () => {
    setAppLanguage("en");
    expect(getGroupLabel("overseas")).toBe("International providers");
    expect(getGroupShortLabel("aggregator")).toBe("Aggregator");
    expect(getGroupDescription("aggregator")).toContain("one API key");
  });
});

describe("service quick links i18n", () => {
  it("默认（zh）返回中文标签，en 分支返回英文标签，href 不变", () => {
    const zhLinks = getServiceQuickLinks("kkaiapi");
    expect(zhLinks.map((l) => l.label)).toEqual(["官网", "API 文档", "模型/价格"]);

    setAppLanguage("en");
    const enLinks = getServiceQuickLinks("kkaiapi");
    expect(enLinks.map((l) => l.label)).toEqual(["Website", "API docs", "Models & pricing"]);
    expect(enLinks.map((l) => l.href)).toEqual(zhLinks.map((l) => l.href));
  });
});
