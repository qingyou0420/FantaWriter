import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("browser-safe core imports", () => {
  it("loads the narrative forecast schema without the Node-heavy core root", async () => {
    const forecastSchema = await import("@actalk/inkos-core/forecast/schema");

    expect(forecastSchema.NarrativeForecastSchema).toBeDefined();
  });

  it("loads volume_map tree helpers without Node fs or outline-paths", async () => {
    const tree = await import("@actalk/inkos-core/volume-map-tree");
    expect(tree.parseVolumeMapTree).toBeTypeOf("function");
    expect(tree.formatVolumeLabel).toBeTypeOf("function");
    expect("isNewLayoutBook" in tree).toBe(false);

    const studioReexport = readFileSync(join(here, "../lib/volume-map-tree.ts"), "utf8");
    expect(studioReexport).toContain("@actalk/inkos-core/volume-map-tree");
    expect(studioReexport).not.toMatch(/from ["']@actalk\/inkos-core["']/);
    expect(studioReexport).not.toContain("outline-paths");
    expect(studioReexport).not.toContain("node:fs");

    const parserSource = readFileSync(join(here, "../../../core/src/utils/volume-map-tree.ts"), "utf8");
    const entrySource = readFileSync(join(here, "../../../core/src/volume-map-tree.ts"), "utf8");
    expect(parserSource).not.toMatch(/from ["'].*outline-paths/);
    expect(parserSource).not.toContain("node:fs");
    expect(entrySource).not.toMatch(/from ["'].*outline-paths/);
    expect(entrySource).not.toContain("node:fs");
  });
});
