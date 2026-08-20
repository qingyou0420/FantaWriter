import fs from "fs";

const p = "src/app/project/[id]/page.tsx";
let s = fs.readFileSync(p, "utf8");
const marker = "\n/* ─── Chapters ─── */\n";
const i = s.indexOf(marker);
if (i < 0) {
  console.error("marker not found");
  process.exit(1);
}
// Keep everything before Chapters section
s = s.slice(0, i).replace(/\s+$/, "\n");
fs.writeFileSync(p, s);
console.log("stripped old ChaptersPanel, new length", s.length);
