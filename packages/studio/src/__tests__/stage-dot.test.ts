/**
 * StageDot contract: currentColor-driven dots; page highlight vs stage progress.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel: string): string {
  return readFileSync(join(studioRoot, rel), "utf8");
}

describe("StageDot", () => {
  it("replaces stepDotClass in nav and uses currentColor CSS", () => {
    const nav = read("src/components/BookWorkspaceNav.tsx");
    const css = read("src/index.css");
    expect(nav).not.toMatch(/stepDotClass/);
    expect(nav).not.toMatch(/oklch\(/);
    expect(nav).toMatch(/StageDot/);
    expect(nav).toMatch(/is-current-page/);
    expect(css).toMatch(/\.stage-dot\[data-state="done"\]\s*\{\s*background:\s*currentColor/);
    expect(css).toMatch(/--dot-core, var\(--seal\)/);
  });

  it("reuses StageDot on study / ground / weave / short", () => {
    const study = read("src/pages/BookStudy.tsx");
    const ground = read("src/pages/BookGround.tsx");
    const weave = read("src/pages/OutlineWorkspace.tsx");
    const short = read("src/pages/ShortReader.tsx");
    for (const src of [study, ground, weave, short]) {
      expect(src).toMatch(/StageDot/);
    }
    expect(study).not.toMatch(/"✓"/);
    expect(study).not.toMatch(/"●"/);
    expect(study).not.toMatch(/"○"/);
    expect(ground).not.toMatch(/"✓"/);
    expect(weave).not.toMatch(/"●"/);
    expect(weave).not.toMatch(/"○"/);
  });
});
