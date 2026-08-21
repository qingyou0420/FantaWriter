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
  it("defaults to the public huanxiang-zuojia repo", () => {
    expect(DEFAULT_GITHUB_REPO).toBe("qingyou0420/huanxiang-zuojia");
    expect(githubLatestApiUrl()).toBe(
      "https://api.github.com/repos/qingyou0420/huanxiang-zuojia/releases/latest"
    );
  });

  it("picks Fantasy-Writer-Setup and ignores other assets", () => {
    const picked = pickSetupAsset([
      {
        name: "Fantasy-Writer-Setup-1.0.0.exe",
        browser_download_url:
          "https://github.com/qingyou0420/huanxiang-zuojia/releases/download/v1.0.0/Fantasy-Writer-Setup-1.0.0.exe",
        url: "https://api.github.com/repos/qingyou0420/huanxiang-zuojia/releases/assets/2",
      },
      {
        name: "latest.yml",
        browser_download_url:
          "https://github.com/qingyou0420/huanxiang-zuojia/releases/download/v1.0.0/latest.yml",
      },
    ]);
    expect(picked?.name).toBe("Fantasy-Writer-Setup-1.0.0.exe");
    expect(picked?.version).toBe("1.0.0");
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
        "https://github.com/qingyou0420/huanxiang-zuojia/releases/download/v1.0.0/Fantasy-Writer-Setup-1.0.0.exe"
      )
    ).toBe("Fantasy-Writer-Setup-1.0.0.exe");
    expect(
      setupFileNameFromUrl("https://github.com/qingyou0420/huanxiang-zuojia/releases/download/v1.0.0/notes.md")
    ).toBeNull();
  });
});

describe("github download guards", () => {
  it("allows GitHub / objects hosts and rejects others", () => {
    expect(
      isAllowedDownloadUrl(
        "https://github.com/qingyou0420/huanxiang-zuojia/releases/download/v1.0.0/Fantasy-Writer-Setup-1.0.0.exe"
      )
    ).toBe(true);
    expect(
      isAllowedDownloadUrl(
        "https://api.github.com/repos/qingyou0420/huanxiang-zuojia/releases/assets/2"
      )
    ).toBe(true);
    expect(
      isAllowedDownloadUrl(
        "https://objects.githubusercontent.com/github-production-release-asset-2e65be/foo"
      )
    ).toBe(true);
    expect(isAllowedDownloadUrl("http://github.com/foo")).toBe(false);
    expect(isAllowedDownloadUrl("https://evil.example/Fantasy-Writer-Setup-1.0.0.exe")).toBe(
      false
    );
  });

  it("adds Authorization only when a token is present", () => {
    expect(githubApiHeaders("").Authorization).toBeUndefined();
    expect(githubApiHeaders("ghp_test").Authorization).toBe("Bearer ghp_test");
    expect(githubAssetHeaders("ghp_test").Accept).toBe("application/octet-stream");
  });

  it("maps HTTP errors to public-repo hints", () => {
    expect(githubCheckErrorMessage(new Error("HTTP 404"))).toMatch(/公开/);
    expect(githubCheckErrorMessage(new Error("HTTP 401"))).toMatch(/拒绝/);
  });
});
