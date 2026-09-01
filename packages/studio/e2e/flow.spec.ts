import { test, expect } from "@playwright/test";
import { seedFlowGraph, E2E_FLOW_ID } from "./fixtures/seed-flow";

test.beforeAll(async () => { await seedFlowGraph(); });

test("flow diagram renders the story graph nodes", async ({ page }) => {
  await page.goto(`/#/flow/${E2E_FLOW_ID}`);
  await expect(page.getByTestId("flow-view")).toBeVisible();
  await expect(page.getByTestId("flow-node-s")).toBeVisible();
  await expect(page.getByTestId("flow-node-g")).toBeVisible();
  await expect(page.getByTestId("flow-node-x")).toBeVisible();
});
