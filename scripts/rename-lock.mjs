import fs from "fs";
const p = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
p.name = "fantasy-writer";
if (p.packages?.[""]) p.packages[""].name = "fantasy-writer";
fs.writeFileSync("package-lock.json", JSON.stringify(p, null, 2) + "\n");
console.log("package-lock name -> fantasy-writer");
