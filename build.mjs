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
for (const filename of (await readdir("public")).sort()) {
  const type = typeByExt[filename.split(".").pop()];
  if (!type) throw new Error("Unexpected asset type: " + filename);
  const raw = await readFile("public/" + filename);
  assets[filename === "index.html" ? "/" : "/" + filename] = [
    type, type.includes("charset") ? raw.toString("utf8") : raw.toString("base64"),
  ];
}

const game = (await readFile("server/game.js", "utf8")).replace(/^export /gm, "");
const app = (await readFile("server/worker.js", "utf8")).replace(/^import .*\n/gm, "");
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/server/index.js", "const assets = " + JSON.stringify(assets) + ";\n" + game + "\n" + app);
if (existsSync(".openai/hosting.json")) {
  await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
}
