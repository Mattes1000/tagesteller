import { handleMenus } from "./routes/menus";
import { handleOrders } from "./routes/orders";
import { handleUsers } from "./routes/users";
import { handleBackup } from "./routes/backup";
import { join } from "path";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PORT = parseInt(process.env.PORT ?? "3001");
const DIST_DIR = join(import.meta.dir, "../../client/dist");

async function serveStatic(pathname: string): Promise<Response | null> {
  const tryPaths = [
    join(DIST_DIR, pathname),
    join(DIST_DIR, pathname, "index.html"),
    join(DIST_DIR, "index.html"),
  ];

  for (const filePath of tryPaths) {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }
  }
  return null;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    let res: Response | null = null;

    if (url.pathname === "/api/health") {
      res = Response.json({ ok: true });
    } else if (url.pathname.startsWith("/api/menus")) {
      res = await handleMenus(req, url);
    } else if (url.pathname.startsWith("/api/orders")) {
      res = await handleOrders(req, url);
    } else if (url.pathname.startsWith("/api/users") || url.pathname.startsWith("/api/auth")) {
      res = await handleUsers(req, url);
    } else if (url.pathname.startsWith("/api/backup")) {
      res = await handleBackup(req, url);
    } else {
      res = await serveStatic(url.pathname);
    }

    if (!res) res = new Response("Not Found", { status: 404 });

    if (url.pathname.startsWith("/api/")) {
      for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    }
    return res;
  },
});

console.log(`Server listening on http://localhost:${server.port}`);
