import { test, expect } from "@playwright/test";
import { seedFlowEditorGraph, E2E_FE_ID } from "./fixtures/seed-flow-editor";

test.beforeEach(async () => { await seedFlowEditorGraph(); }); // reset graph each test

test("add node via editor increases node count", async ({ page }) => {
  await page.goto(`/#/flow/${E2E_FE_ID}`);
  await page.getByTestId("flow-edit-toggle").click();
  const before = await page.locator('[data-testid^="flow-node-"]').count();
  await page.getByTestId("flow-add-node").click();
  await expect.poll(async () => page.locator('[data-testid^="flow-node-"]').count()).toBe(before + 1);
});

test("dragging a node persists its position across reload", async ({ page }) => {
  await page.goto(`/#/flow/${E2E_FE_ID}`);
  await page.getByTestId("flow-edit-toggle").click();
  const node = page.getByTestId("flow-node-s");
  const box = await node.boundingBox();
  if (!box) throw new Error("node not found");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 120, { steps: 8 });
  await page.mouse.up();
  // wait for persist round-trip
  await page.waitForTimeout(800);
  await page.reload();
  // after reload, the seed had no position; if drag persisted, the API graph now has a position for "s"
  const res = await page.request.get(`/api/v1/projects/${E2E_FE_ID}/story-graph`);
  const graph = await res.json() as { nodes: Array<{ id: string; position?: { x: number; y: number } }> };
  expect(graph.nodes.find((n) => n.id === "s")?.position).toBeTruthy();
});
