import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  DEFAULT_GITHUB_REPO,
  githubLatestApiUrl,
  githubApiHeaders,
  githubAssetHeaders,
  isAllowedDownloadUrl,
  pickSetupAsset,
  parseGithubLatestRelease,
  setupFileNameFromUrl,
  githubCheckErrorMessage,
} = require("../../electron/github-release.cjs") as {
  DEFAULT_GITHUB_REPO: string;
  githubLatestApiUrl: (repo?: string) => string;
  githubApiHeaders: (token?: string) => Record<string, string>;
  githubAssetHeaders: (token?: string) => Record<string, string>;
  isAllowedDownloadUrl: (url: string) => boolean;
  pickSetupAsset: (assets: unknown) => {
    name: string;
    version: string;
    downloadUrl: string;
    assetApiUrl: string;
  } | null;
  parseGithubLatestRelease: (json: unknown) => {
    version: string;
    downloadUrl: string;
    assetApiUrl: string;
    assetName: string;
    tagName: string;
  } | null;
  setupFileNameFromUrl: (url: string) => string | null;
  githubCheckErrorMessage: (err: unknown) => string;
};

describe("github latest release parsing", () => {
  it("defaults to the private fantasy-writer repo", () => {
    expect(DEFAULT_GITHUB_REPO).toBe("qingyou0420/fantasy-writer");
    expect(githubLatestApiUrl()).toBe(
      "https://api.github.com/repos/qingyou0420/fantasy-writer/releases/latest"
    );
  });

  it("prefers Fantasy-Writer-Setup over the dual-publish sibling", () => {
    const picked = pickSetupAsset([
      {
        name: "H-NoveList-Setup-2.1.0.exe",
        browser_download_url:
          "https://github.com/qingyou0420/fantasy-writer/releases/download/v2.1.0/H-NoveList-Setup-2.1.0.exe",
        url: "https://api.github.com/repos/qingyou0420/fantasy-writer/releases/assets/1",
      },
      {
        name: "Fantasy-Writer-Setup-2.1.0.exe",
        browser_download_url:
          "https://github.com/qingyou0420/fantasy-writer/releases/download/v2.1.0/Fantasy-Writer-Setup-2.1.0.exe",
        url: "https://api.github.com/repos/qingyou0420/fantasy-writer/releases/assets/2",
      },
      {
        name: "latest.yml",
        browser_download_url:
          "https://github.com/qingyou0420/fantasy-writer/releases/download/v2.1.0/latest.yml",
      },
    ]);
    expect(picked?.name).toBe("Fantasy-Writer-Setup-2.1.0.exe");
    expect(picked?.version).toBe("2.1.0");
  });

  it("accepts only the old sibling when that is the only Setup.exe", () => {
    const parsed = parseGithubLatestRelease({
      tag_name: "v2.0.2",
      assets: [
        {
          name: "H-NoveList-Setup-2.0.2.exe",
          browser_download_url:
            "https://github.com/qingyou0420/fantasy-writer/releases/download/v2.0.2/H-NoveList-Setup-2.0.2.exe",
          url: "https://api.github.com/repos/qingyou0420/fantasy-writer/releases/assets/9",
        },
      ],
    });
    expect(parsed).toEqual({
      version: "2.0.2",
      downloadUrl:
        "https://github.com/qingyou0420/fantasy-writer/releases/download/v2.0.2/H-NoveList-Setup-2.0.2.exe",
      assetApiUrl:
        "https://api.github.com/repos/qingyou0420/fantasy-writer/releases/assets/9",
      assetName: "H-NoveList-Setup-2.0.2.exe",
      tagName: "v2.0.2",
    });
  });

  it("returns null when latest has no recognized Setup.exe", () => {
    expect(
      parseGithubLatestRelease({
        tag_name: "v9.9.9",
        assets: [{ name: "notes.md", browser_download_url: "https://example.com/notes.md" }],
      })
    ).toBeNull();
    expect(parseGithubLatestRelease(null)).toBeNull();
    expect(pickSetupAsset("nope")).toBeNull();
  });

  it("extracts Setup filename from a GitHub download URL", () => {
    expect(
      setupFileNameFromUrl(
        "https://github.com/qingyou0420/fantasy-writer/releases/download/v2.1.0/Fantasy-Writer-Setup-2.1.0.exe"
      )
    ).toBe("Fantasy-Writer-Setup-2.1.0.exe");
    expect(
      setupFileNameFromUrl("https://github.com/qingyou0420/fantasy-writer/releases/download/v2.1.0/notes.md")
    ).toBeNull();
  });
});

describe("github download guards", () => {
  it("allows GitHub / objects hosts and rejects others", () => {
    expect(
      isAllowedDownloadUrl(
        "https://github.com/qingyou0420/fantasy-writer/releases/download/v2.1.0/Fantasy-Writer-Setup-2.1.0.exe"
      )
    ).toBe(true);
    expect(
      isAllowedDownloadUrl(
        "https://api.github.com/repos/qingyou0420/fantasy-writer/releases/assets/2"
      )
    ).toBe(true);
    expect(
      isAllowedDownloadUrl(
        "https://objects.githubusercontent.com/github-production-release-asset-2e65be/foo"
      )
    ).toBe(true);
    expect(isAllowedDownloadUrl("http://github.com/foo")).toBe(false);
    expect(isAllowedDownloadUrl("https://evil.example/Fantasy-Writer-Setup-2.1.0.exe")).toBe(
      false
    );
  });

  it("adds Authorization only when a token is present", () => {
    expect(githubApiHeaders("").Authorization).toBeUndefined();
    expect(githubApiHeaders("ghp_test").Authorization).toBe("Bearer ghp_test");
    expect(githubAssetHeaders("ghp_test").Accept).toBe("application/octet-stream");
  });

  it("maps private-repo HTTP errors to setup hints", () => {
    expect(githubCheckErrorMessage(new Error("HTTP 404"))).toMatch(/私有仓/);
    expect(githubCheckErrorMessage(new Error("HTTP 401"))).toMatch(/令牌/);
  });
});
