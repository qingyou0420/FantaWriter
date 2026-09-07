/**
 * Map story_frame.md headings onto 研墨 zones.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { splitMarkdownSections, stripYamlFrontmatter } from "./book-stage.js";

export type GroundFrameZone = "theme" | "world" | "conflict" | "ending";

const ZONE_PATTERNS: Record<GroundFrameZone, RegExp> = {
  theme: /主题|基调|theme|tonal|tone/i,
  world: /世界|铁律|底色|world|rule/i,
  conflict: /冲突|主线|因果|对手|conflict/i,
  ending: /终局|结局|伏笔|endgame|ending/i,
};

const ZONE_HEADINGS: Record<GroundFrameZone, { zh: string; en: string }> = {
  theme: { zh: "主题与基调", en: "Theme and tone" },
  world: { zh: "世界铁律", en: "World rules" },
  conflict: { zh: "核心冲突", en: "Core conflict" },
  ending: { zh: "终局", en: "Ending" },
};

export function extractStoryFrameZone(markdown: string, zone: GroundFrameZone): { heading: string; body: string } {
  const body = stripYamlFrontmatter(markdown);
  const sections = splitMarkdownSections(body);
  const match = sections.find((section) => ZONE_PATTERNS[zone].test(section.heading));
  if (match) return { heading: match.heading, body: match.body.trim() };
  return { heading: ZONE_HEADINGS[zone].zh, body: "" };
}

export function replaceStoryFrameZone(markdown: string, zone: GroundFrameZone, nextBody: string, isZh: boolean): string {
  const trimmed = markdown.replace(/^\uFEFF/, "");
  let prefix = "";
  let body = trimmed;
  if (trimmed.startsWith("---")) {
    const close = trimmed.indexOf("\n---", 3);
    if (close >= 0) {
      prefix = trimmed.slice(0, close + 4).replace(/\s*$/, "") + "\n\n";
      body = trimmed.slice(close + 4).replace(/^\s*\n/, "");
    }
  }
  const heading = isZh ? ZONE_HEADINGS[zone].zh : ZONE_HEADINGS[zone].en;
  const pattern = ZONE_PATTERNS[zone];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let replaced = false;
  while (i < lines.length) {
    const match = /^(#{1,3})\s+(.+)$/.exec(lines[i]!);
    if (match && pattern.test(match[2]!.trim())) {
      out.push(`${match[1]} ${match[2]!.trim()}`);
      i += 1;
      while (i < lines.length && !/^(#{1,3})\s+/.test(lines[i]!)) i += 1;
      out.push(nextBody.trimEnd());
      if (nextBody.trim()) out.push("");
      replaced = true;
      continue;
    }
    out.push(lines[i]!);
    i += 1;
  }
  if (!replaced) {
    if (out.length && out[out.length - 1] !== "") out.push("");
    out.push(`## ${heading}`, nextBody.trimEnd(), "");
  }
  return prefix + out.join("\n").replace(/\n{3,}/g, "\n\n");
}
