import { describe, expect, it } from "vitest";
import { rotateBackupNames, desktopBackupFileName } from "./desktop-backup";

describe("desktop backup rotation", () => {
  it("keeps the newest 7 and removes older files", () => {
    const names = [
      "fw-auto-2026-08-01T00-00-00-000Z.json",
      "fw-auto-2026-08-02T00-00-00-000Z.json",
      "fw-auto-2026-08-03T00-00-00-000Z.json",
      "fw-auto-2026-08-04T00-00-00-000Z.json",
      "fw-auto-2026-08-05T00-00-00-000Z.json",
      "fw-auto-2026-08-06T00-00-00-000Z.json",
      "fw-auto-2026-08-07T00-00-00-000Z.json",
      "fw-auto-2026-08-08T00-00-00-000Z.json",
      "fw-auto-2026-08-09T00-00-00-000Z.json",
      "notes.txt",
    ];
    const { keep, remove } = rotateBackupNames(names, 7);
    expect(keep).toHaveLength(7);
    expect(remove).toEqual([
      "fw-auto-2026-08-01T00-00-00-000Z.json",
      "fw-auto-2026-08-02T00-00-00-000Z.json",
    ]);
    expect(keep).toContain("fw-auto-2026-08-09T00-00-00-000Z.json");
  });

  it("names files with fw-auto- prefix", () => {
    expect(desktopBackupFileName(new Date("2026-08-21T13:00:00.000Z"))).toMatch(
      /^fw-auto-2026-08-21T/
    );
  });
});
