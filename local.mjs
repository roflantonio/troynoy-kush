import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

await import("./build.mjs");
const { default: worker } = await import("./dist/server/index.js");
const { values } = parseArgs({
  options: { host: { type: "string", default: "0.0.0.0" }, port: { type: "string", default: "4173" }, strictPort: { type: "boolean" } },
});

const store = new DatabaseSync(process.env.HEIST_SQLITE_PATH || "heist.sqlite");
store.exec(await readFile(new URL("./drizzle/0000_rooms.sql", import.meta.url), "utf8"));
const DB = {
  prepare(statement) {
    const prepared = store.prepare(statement);
    return {
      bind(...params) {
        return {
          first: async () => prepared.get(...params) ?? null,
          run: async () => ({ meta: { changes: Number(prepared.run(...params).changes) } }),
        };
      },
    };
  },
};

createServer(async (incoming, outgoing) => {
  try {
    const method = incoming.method;
    const body = method !== "GET" && method !== "HEAD" ? incoming : undefined;
    const request = new Request("http://" + incoming.headers.host + incoming.url, {
      method, headers: incoming.headers, body, duplex: body ? "half" : undefined,
    });
    const response = await worker.fetch(request, { DB, HEIST_PAGES_ORIGIN: process.env.HEIST_PAGES_ORIGIN });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500).end();
  }
}).listen(Number(values.port), values.host, () => {
  console.log("Тройной куш: http://localhost:" + values.port);
});
