import { test, expect } from "@playwright/test";
import { seedAuthoringGraph, E2E_FILM_ID } from "./fixtures/seed-authoring";

test.beforeAll(async () => {
  await seedAuthoringGraph();
});

test("user edits a node's scene inline in the tree view and it persists", async ({ page }) => {
  await page.goto(`/#/film/${E2E_FILM_ID}`);
  await expect(page.getByTestId("film-title")).toContainText("E2E 创作样例");

  const scene = page.getByTestId("film-scene-s");
  await expect(scene).toHaveValue("旧场景");
  await scene.fill("新写的开场场景");
  await page.getByTestId("film-save-s").click();

  // After save + refetch, the textarea reflects the persisted value
  await expect(page.getByTestId("film-scene-s")).toHaveValue("新写的开场场景");

  // Cross-check via the player: open it and confirm the start node shows the new scene
  await page.getByTestId("film-play").click();
  await page.getByTestId("player-start").click();
  await expect(page.getByTestId("player-screen")).toContainText("新写的开场场景");
});
