/**
 * 2.0 must not ship the retired Next.js 1.x Studio.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = [
  join(repoRoot, "src", "app"),
  join(repoRoot, "next.config.ts"),
  join(repoRoot, "next.config.js"),
  join(repoRoot, "electron", "main.cjs"),
];

const hits = forbidden.filter((p) => existsSync(p));
if (hits.length) {
  console.error("仓库里仍有 Next 1.x 入口，拒绝发版:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("refuse-next-1x: ok (no src/app, next.config, or electron/main.cjs)");
