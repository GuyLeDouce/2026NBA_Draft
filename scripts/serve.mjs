import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
http
  .createServer(async (req, res) => {
    try {
      let relative = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (relative.endsWith("/")) relative += "index.html";
      const file = path.resolve(root, "." + relative);
      if (!file.startsWith(root + path.sep)) throw Error("Invalid path");
      const bytes = await fs.readFile(file);
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] ?? "application/octet-stream",
      );
      res.setHeader(
        "Cache-Control",
        file.includes("_next")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      );
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () =>
    console.log(
      "Draft War Room: http://localhost:" + (process.env.PORT ?? 3000),
    ),
  );
