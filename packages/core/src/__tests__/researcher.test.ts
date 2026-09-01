import { describe, expect, it } from "vitest";
import { runResearchReport } from "../agents/researcher.js";

describe("ResearcherAgent", () => {
  it("builds a traceable research report without mutating story state", async () => {
    const report = await runResearchReport(
      {
        topic: "宋代县衙巡检职责",
        purpose: "worldbuilding",
        depth: "quick",
      },
      {
        search: async (query, maxResults) => {
          expect(query).toContain("宋代县衙巡检职责");
          expect(maxResults).toBeGreaterThan(0);
          return [
            {
              title: "宋代地方治安资料",
              url: "https://example.com/song-policing",
              snippet: "巡检负责地方治安、缉捕盗贼，并与县衙形成协作关系。",
            },
          ];
        },
        fetch: async (url) => {
          expect(url).toBe("https://example.com/song-policing");
          return "巡检司常设于要冲，职责包括巡逻、缉盗、盘查交通要道。";
        },
      },
    );

    expect(report.summary).toContain("宋代县衙巡检职责");
    expect(report.sources).toEqual([
      expect.objectContaining({ id: "S1", url: "https://example.com/song-policing" }),
    ]);
    expect(report.claims[0]).toMatchObject({
      sourceIds: ["S1"],
      confidence: "medium",
    });
    expect(report.queryLog[0]).toContain("宋代县衙巡检职责");
    expect(report.markdown).toContain("## Claims");
    expect(report.markdown).toContain("[S1]");
    expect(report.markdown).toContain("## Creative implications");
  });
});
