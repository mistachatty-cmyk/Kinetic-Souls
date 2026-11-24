// Lok ecosystem standard: no emoji anywhere in UI, copy, data or docs.
// Usage: node scripts/check-no-emoji.mjs   (exits 1 if any are found)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".css", ".md", ".svg", ".webmanifest"]);
const SKIP = new Set(["node_modules", "dist", ".git", "pnpm-lock.yaml"]);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{23E9}-\u{23FA}\u{FE0F}\u{200D}]/u;

let bad = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!EXT.has(extname(name))) continue;
    readFileSync(path, "utf8").split("\n").forEach((line, i) => {
      if (EMOJI.test(line)) { bad++; console.log(`${path}:${i + 1}: ${line.trim().slice(0, 80)}`); }
    });
  }
};
walk(process.argv[2] ?? ".");
console.log(bad ? `${bad} line(s) with emoji` : "No emoji found");
process.exit(bad ? 1 : 0);
