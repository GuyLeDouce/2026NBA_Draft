import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
async function walk(dir) {
  const result = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...(await walk(name)));
    else result.push(name);
  }
  return result;
}
const files = (await walk("out"))
  .filter((f) => !f.endsWith(".map") && !f.endsWith("sw.js"))
  .map((f) => "/" + path.relative("out", f).split(path.sep).join("/"));
const version = crypto
  .createHash("sha256")
  .update(await fs.readFile("out/index.html"))
  .update(files.join("|"))
  .digest("hex")
  .slice(0, 12);
const template = await fs.readFile("public/sw.js", "utf8");
await fs.writeFile(
  "out/sw.js",
  template
    .replace("draft-room-v1-2026-10-10", "draft-room-" + version)
    .replace(
      "['/','/icon.svg','/manifest.webmanifest']",
      JSON.stringify(["/", ...files]),
    ),
);
console.log(
  "PWA precache: " + files.length + " static assets, version " + version,
);
