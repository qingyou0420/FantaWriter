import { test, expect } from "@playwright/test";
import { seedFilmWizard, E2E_WIZ_ID } from "./fixtures/seed-film-wizard";

test.beforeAll(async () => {
  await seedFilmWizard();
});

test("user walks the wizard: structure → tree → validate → preview", async ({ page }) => {
  // 1. Open wizard page and verify stepper is visible
  await page.goto(`/#/studio/film/${E2E_WIZ_ID}`);
  await expect(page.getByTestId("film-wizard")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("wizard-step-world")).toBeVisible();
  await expect(page.getByTestId("wizard-step-validate")).toBeVisible();

  // 2. Click "structure" step → default sub-view is "flow" → FlowView renders
  await page.getByTestId("wizard-step-structure").click();
  await expect(page.getByTestId("flow-view")).toBeVisible({ timeout: 15_000 });

  // 3. Switch sub-view to tree → StoryGraphTree renders
  await page.getByTestId("wizard-subview-tree").click();
  await expect(page.getByTestId("film-tree")).toBeVisible({ timeout: 15_000 });

  // 4. Click "validate" step → validation panel renders
  await page.getByTestId("wizard-step-validate").click();
  await expect(page.getByTestId("validation-panel")).toBeVisible({ timeout: 15_000 });

  // 5. Click "preview" → StoryPlayer renders start screen → click start → player screen
  await page.getByTestId("wizard-preview").click();
  await expect(page.getByTestId("player-start")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("player-start").click();
  await expect(page.getByTestId("player-screen")).toBeVisible({ timeout: 15_000 });
});
