import { existsSync } from "node:fs";
import { readdir, readFile, mkdir, writeFile, copyFile } from "node:fs/promises";

const typeByExt = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  webp: "image/webp",
  woff2: "font/woff2",
};

const assets = {};
async function readAssets(directory, path = "/") {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const filename = entry.name;
    if (entry.isDirectory()) { await readAssets(directory + "/" + filename, path + filename + "/"); continue; }
    const type = typeByExt[filename.split(".").pop()];
    if (!type) throw new Error("Unexpected asset type: " + filename);
    const raw = await readFile(directory + "/" + filename);
    assets[filename === "index.html" ? path : path + filename] = [
      type, type.includes("charset") ? raw.toString("utf8") : raw.toString("base64"),
    ];
  }
}
await readAssets("public");

const game = (await readFile("server/game.js", "utf8")).replace(/^export /gm, "");
const arena = await readFile("server/arena.js", "utf8");
const run = await readFile("server/run.js", "utf8");
const app = (await readFile("server/worker.js", "utf8")).replace(/^import .*\n/gm, "");
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/server/index.js", "const assets = " + JSON.stringify(assets) + ";\n" + game + "\n" + arena + "\n" + run + "\n" + app);
if (existsSync(".openai/hosting.json")) {
  await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
}
