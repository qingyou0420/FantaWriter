import { test, expect } from "@playwright/test";
import { saveStoryGraph, StoryGraphSchema } from "@actalk/inkos-core";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const E2E_ROOT = resolve(dir, "../../..", "test-project");

const FILM_A_ID = "e2e-film-list-alpha";
const FILM_B_ID = "e2e-film-list-beta";

function makeGraph(projectId: string, title: string) {
  return StoryGraphSchema.parse({
    schemaVersion: 1,
    projectId,
    title,
    variables: [],
    nodes: [{ id: "s", type: "start", sceneDesc: "desc", choices: [] }],
    endings: [],
  });
}

test.beforeAll(async () => {
  await saveStoryGraph(E2E_ROOT, FILM_A_ID, makeGraph(FILM_A_ID, "Alpha 测试剧"));
  await saveStoryGraph(E2E_ROOT, FILM_B_ID, makeGraph(FILM_B_ID, "Beta 测试剧"));
});

test("sidebar hides the interactive film section while film routes stay reachable", async ({ page }) => {
  await page.goto("/#/");

  await expect(page.getByTestId("sidebar-create-list")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("film-projects-section")).toHaveCount(0);
  await expect(page.getByTestId(`film-project-${FILM_A_ID}`)).toHaveCount(0);
  await expect(page.getByTestId(`film-project-${FILM_B_ID}`)).toHaveCount(0);

  await page.goto(`/#/studio/film/${FILM_A_ID}`);
  await expect(page.getByTestId("film-wizard")).toBeVisible({ timeout: 20_000 });
});
