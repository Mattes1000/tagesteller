import { db } from "../db";
import { randomUUID } from "crypto";

export async function handleUsers(req: Request, url: URL): Promise<Response | null> {
  const path = url.pathname;

  // POST /api/auth/login  — Username+Password Login
  if (req.method === "POST" && path === "/api/auth/login") {
    const body = await req.json() as { username: string; password: string };
    const { username, password } = body;
    if (!username || !password) return new Response("Bad Request", { status: 400 });

    const user = db.query(
      "SELECT id, firstname, lastname, role, qr_token, password_hash FROM users WHERE username = $username"
    ).get({ $username: username }) as {
      id: number; firstname: string; lastname: string; role: string; qr_token: string; password_hash: string;
    } | null;

    if (!user || !user.password_hash) return new Response("Unauthorized", { status: 401 });

    const valid = await Bun.password.verify(password, user.password_hash);
    if (!valid) return new Response("Unauthorized", { status: 401 });

    const { password_hash: _, ...safeUser } = user;
    return Response.json(safeUser);
  }

  // GET /api/auth/qr/:token  — QR-Login
  const matchQr = path.match(/^\/api\/auth\/qr\/(.+)$/);
  if (req.method === "GET" && matchQr) {
    const token = matchQr[1];
    const user = db.query("SELECT id, firstname, lastname, role, qr_token FROM users WHERE qr_token = $token").get({ $token: token }) as {
      id: number; firstname: string; lastname: string; role: string; qr_token: string;
    } | null;
    if (!user) return new Response("Unauthorized", { status: 401 });
    return Response.json(user);
  }

  // GET /api/users  — alle User (admin/manager)
  if (req.method === "GET" && path === "/api/users") {
    const rows = db.query("SELECT id, firstname, lastname, username, role, qr_token, created_at FROM users ORDER BY role, lastname").all();
    return Response.json(rows);
  }

  // POST /api/users  — neuen User anlegen
  if (req.method === "POST" && path === "/api/users") {
    const body = await req.json() as { firstname: string; lastname: string; username: string; role: string };
    const { firstname, lastname, username, role } = body;
    if (!firstname || !lastname || !username || !["admin", "manager", "user"].includes(role)) {
      return new Response("Bad Request", { status: 400 });
    }
    const qr_token = randomUUID();
    
    // Generiere temporäres Passwort (8 Zeichen: Buchstaben + Zahlen)
    const tempPassword = Math.random().toString(36).slice(2, 10).toUpperCase();
    const password_hash = await Bun.password.hash(tempPassword);
    
    db.query("INSERT INTO users (firstname, lastname, role, qr_token, username, password_hash) VALUES ($firstname, $lastname, $role, $qr_token, $username, $password_hash)")
      .run({ $firstname: firstname, $lastname: lastname, $role: role, $qr_token: qr_token, $username: username, $password_hash: password_hash });
    const row = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
    return Response.json({ id: row.id, qr_token, tempPassword }, { status: 201 });
  }

  // PUT /api/users/:id
  const matchPut = path.match(/^\/api\/users\/(\d+)$/);
  if (req.method === "PUT" && matchPut) {
    const id = parseInt(matchPut[1]);
    const body = await req.json() as { firstname: string; lastname: string; role: string };
    const { firstname, lastname, role } = body;
    db.query("UPDATE users SET firstname=$firstname, lastname=$lastname, role=$role WHERE id=$id")
      .run({ $firstname: firstname, $lastname: lastname, $role: role, $id: id });
    return Response.json({ ok: true });
  }

  // POST /api/users/:id/regenerate-qr — QR-Token neu generieren
  const matchRegenerate = path.match(/^\/api\/users\/(\d+)\/regenerate-qr$/);
  if (req.method === "POST" && matchRegenerate) {
    const id = parseInt(matchRegenerate[1]);
    const newToken = randomUUID();
    db.query("UPDATE users SET qr_token = $qr_token WHERE id = $id")
      .run({ $qr_token: newToken, $id: id });
    return Response.json({ qr_token: newToken });
  }

  // POST /api/users/:id/change-password — Passwort ändern
  const matchChangePassword = path.match(/^\/api\/users\/(\d+)\/change-password$/);
  if (req.method === "POST" && matchChangePassword) {
    const id = parseInt(matchChangePassword[1]);
    const body = await req.json() as { currentPassword: string; newPassword: string };
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return Response.json({ error: "Aktuelles und neues Passwort erforderlich." }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return Response.json({ error: "Neues Passwort muss mindestens 6 Zeichen lang sein." }, { status: 400 });
    }

    const user = db.query("SELECT password_hash FROM users WHERE id = $id").get({ $id: id }) as { password_hash: string | null } | null;

    if (!user) {
      return Response.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    if (!user.password_hash) {
      return Response.json({ error: "Kein Passwort gesetzt." }, { status: 400 });
    }

    const valid = await Bun.password.verify(currentPassword, user.password_hash);
    if (!valid) {
      return Response.json({ error: "Aktuelles Passwort ist falsch." }, { status: 401 });
    }

    const newHash = await Bun.password.hash(newPassword);
    db.query("UPDATE users SET password_hash = $password_hash WHERE id = $id")
      .run({ $password_hash: newHash, $id: id });

    return Response.json({ success: true });
  }

  // POST /api/users/:id/admin-reset-password — Admin setzt Passwort für Benutzer
  const matchAdminReset = path.match(/^\/api\/users\/(\d+)\/admin-reset-password$/);
  if (req.method === "POST" && matchAdminReset) {
    const id = parseInt(matchAdminReset[1]);
    const body = await req.json() as { newPassword: string };
    const { newPassword } = body;

    if (!newPassword) {
      return Response.json({ error: "Neues Passwort erforderlich." }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return Response.json({ error: "Passwort muss mindestens 6 Zeichen lang sein." }, { status: 400 });
    }

    const user = db.query("SELECT id FROM users WHERE id = $id").get({ $id: id });
    if (!user) {
      return Response.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    const newHash = await Bun.password.hash(newPassword);
    db.query("UPDATE users SET password_hash = $password_hash WHERE id = $id")
      .run({ $password_hash: newHash, $id: id });

    return Response.json({ success: true });
  }

  // DELETE /api/users/:id
  const matchDel = path.match(/^\/api\/users\/(\d+)$/);
  if (req.method === "DELETE" && matchDel) {
    const id = parseInt(matchDel[1]);
    db.query("DELETE FROM users WHERE id = $id").run({ $id: id });
    return Response.json({ ok: true });
  }

  return null;
}
