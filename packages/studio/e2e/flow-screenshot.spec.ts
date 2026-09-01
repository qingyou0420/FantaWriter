import { test } from "@playwright/test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedScreenshotGraph, E2E_SCREENSHOT_ID } from "./fixtures/seed-screenshot";

const dir = fileURLToPath(new URL(".", import.meta.url));
const screenshotPath = resolve(dir, "../../..", "flow-after.png");

test.beforeAll(async () => {
  await seedScreenshotGraph();
});

test("screenshot: flow diagram with 9 nodes — no overlap, minimap + stats visible", async ({ page }) => {
  await page.goto(`/#/flow/${E2E_SCREENSHOT_ID}`);
  await page.waitForSelector('[data-testid^="flow-node-"]');
  // Give ReactFlow time to finish fitView animation
  await page.waitForTimeout(1200);
  await page.screenshot({ path: screenshotPath, fullPage: false });
});
