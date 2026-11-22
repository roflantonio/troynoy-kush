import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const source = process.env.HEIST_API_ORIGIN;
const api = source ? new URL(source) : null;
if (!api || api.protocol !== "https:" || (source !== api.origin && source !== api.origin + "/")) {
  throw new Error("Set HEIST_API_ORIGIN to the HTTPS origin of the room server.");
}

const output = "dist/pages";
await mkdir(output, { recursive: true });
await cp("public", output, { recursive: true });
const index = await readFile(output + "/index.html", "utf8");
await writeFile(output + "/index.html", index.replace(
  '<meta charset="utf-8">',
  '<meta charset="utf-8">\n  <meta name="game-api-origin" content="' + api.origin + '">',
));
