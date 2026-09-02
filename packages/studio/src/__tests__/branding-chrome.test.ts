import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel: string): string {
  return readFileSync(join(studioRoot, rel), "utf8");
}

describe("studio product chrome branding", () => {
  it("does not ship InkosLogo or InkOS Studio as product chrome", () => {
    expect(existsSync(join(studioRoot, "src/components/InkosLogo.tsx"))).toBe(false);
    expect(existsSync(join(studioRoot, "src/components/FantaWriterLogo.tsx"))).toBe(true);
    expect(existsSync(join(studioRoot, "public/fantawriter-mark.png"))).toBe(true);
    expect(existsSync(join(studioRoot, "public/favicon.ico"))).toBe(true);

    const sidebar = read("src/components/Sidebar.tsx");
    const language = read("src/pages/LanguageSelector.tsx");
    const indexHtml = read("index.html");
    const i18n = read("src/hooks/use-i18n.ts");
    const app = read("src/App.tsx");

    expect(sidebar).not.toMatch(/InkosLogo/);
    expect(sidebar).not.toMatch(/InkOS/);
    expect(sidebar).not.toMatch(/FantaWriterLogo/);
    expect(sidebar).not.toMatch(/幻想作家/);
    expect(sidebar).not.toMatch(/<img\b/);
    expect(sidebar).toMatch(/nav\.createSection/);

    expect(language).not.toMatch(/InkOS/);
    expect(language).toMatch(/FantaWriterLogo/);
    expect(language).toMatch(/幻想作家/);

    expect(app).not.toMatch(/InkOS/);
    expect(app).toMatch(/FantaWriterLogo/);
    expect(app).toMatch(/幻想作家/);

    expect(indexHtml).toMatch(/幻想作家 \/ FantaWriter/);
    expect(indexHtml).not.toMatch(/InkOS/);
    expect(indexHtml).toMatch(/fantawriter-mark\.png/);

    expect(i18n).not.toMatch(/InkOS Studio|InkOS 互动|InkOS Play/);
  });
});
