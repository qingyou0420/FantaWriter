import { test, expect } from "@playwright/test";
import { seedValidationGraph, E2E_VAL_ID } from "./fixtures/seed-validation";

test.beforeAll(async () => { await seedValidationGraph(); });

test("validation panel lists quality issues in the tree view", async ({ page }) => {
  await page.goto(`/#/film/${E2E_VAL_ID}`);
  await expect(page.getByTestId("validation-panel")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("validation-issue-IMAGE_MISSING").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("validation-issue-VARIABLE_UNWRITTEN").first()).toBeVisible({ timeout: 20_000 });
});
