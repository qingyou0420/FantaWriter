import { test, expect } from "@playwright/test";
import { seedE2EGraph, E2E_PROJECT_ID } from "./fixtures/seed-graph";

test.beforeAll(async () => {
  await seedE2EGraph(); // 测试准备：把已知图写到磁盘
});

test("用户点真实按钮把剧本玩到 good 结局，变量与结局计数正确", async ({ page }) => {
  // 1. 打开播放器页（真实导航）
  await page.goto(`/#/play/${E2E_PROJECT_ID}`);

  // 2. 点"开始游玩"
  await page.getByTestId("player-start").click();

  // 3. 开场：HUD 初始 trust=0
  await expect(page.getByTestId("player-node-title")).toHaveText("开场");
  await expect(page.getByTestId("hud-trust")).toHaveText("0");

  // 4. 点"交出证据（信任+1）"——真实选项按钮
  await page.getByTestId("choice-trustup").click();

  // 5. 到达抉择节点，HUD 变为 trust=1（断言真实渲染状态）
  await expect(page.getByTestId("player-node-title")).toHaveText("抉择");
  await expect(page.getByTestId("hud-trust")).toHaveText("1");

  // 6. 因 trust>=1，"坦白"这个有条件选项应可见并可点
  await expect(page.getByTestId("choice-good")).toBeVisible();
  await page.getByTestId("choice-good").click();

  // 7. 到达 good 结局，类型/标题/已解锁计数正确
  await expect(page.getByTestId("player-ending")).toBeVisible();
  await expect(page.getByTestId("player-ending-type")).toHaveText("good");
  await expect(page.getByTestId("player-ending-title")).toHaveText("真相大白");
  await expect(page.getByTestId("player-unlocked")).toContainText("1 / 2");
});

test("条件选项在 trust 不足时隐藏（藏起证据路径走向 bad 结局）", async ({ page }) => {
  await page.goto(`/#/play/${E2E_PROJECT_ID}`);
  await page.getByTestId("player-start").click();

  // 选"藏起证据"——trust 保持 0
  await page.getByTestId("choice-hide").click();
  await expect(page.getByTestId("hud-trust")).toHaveText("0");

  // trust<1，"坦白"选项应不可见，只能"逃跑"
  await expect(page.getByTestId("choice-good")).toHaveCount(0);
  await page.getByTestId("choice-bad").click();

  await expect(page.getByTestId("player-ending-type")).toHaveText("bad");
});
