import { describe, expect, it } from "vitest";

describe("browser-safe core imports", () => {
  it("loads the narrative forecast schema without the Node-heavy core root", async () => {
    const forecastSchema = await import("@actalk/inkos-core/forecast/schema");

    expect(forecastSchema.NarrativeForecastSchema).toBeDefined();
  });
});
