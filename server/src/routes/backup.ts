import { db } from "../db";
import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { join } from "path";

export async function handleBackup(req: Request, url: URL): Promise<Response | null> {
  const path = url.pathname;

  // POST /api/backup/create
  if (req.method === "POST" && path === "/api/backup/create") {
    try {
      // Get the database file path - use the same path as db.ts
      const dbPath = process.env.DATABASE_PATH ?? "tagesteller.db";
      
      // Read the database file
      const dbBuffer = readFileSync(dbPath);
      
      // Return the database file as a download
      return new Response(dbBuffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="tagesteller-backup-${new Date().toISOString().split('T')[0]}.db"`,
        },
      });
    } catch (err) {
      console.error("Backup creation error:", err);
      return Response.json({ 
        error: `Fehler beim Erstellen des Backups: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}` 
      }, { status: 500 });
    }
  }

  // POST /api/backup/restore
  if (req.method === "POST" && path === "/api/backup/restore") {
    try {
      const formData = await req.formData();
      const file = formData.get("backup") as File;
      
      if (!file) {
        return Response.json({ error: "Keine Backup-Datei hochgeladen." }, { status: 400 });
      }

      // Validate file is a SQLite database
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      // Check SQLite magic number (first 16 bytes should be "SQLite format 3\0")
      const magicNumber = String.fromCharCode(...uint8Array.slice(0, 15));
      if (!magicNumber.startsWith("SQLite format 3")) {
        return Response.json({ error: "Ungültige Backup-Datei. Nur SQLite-Datenbanken werden unterstützt." }, { status: 400 });
      }

      const dbPath = process.env.DATABASE_PATH ?? "tagesteller.db";
      const backupPath = dbPath + ".backup-" + Date.now();
      
      // Create a backup of the current database
      copyFileSync(dbPath, backupPath);
      
      try {
        // Write the uploaded file to the database path
        writeFileSync(dbPath, uint8Array);
        
        return Response.json({ success: true, message: "Backup erfolgreich wiederhergestellt." });
      } catch (err) {
        // If restore fails, restore the backup
        copyFileSync(backupPath, dbPath);
        throw err;
      }
    } catch (err) {
      console.error("Backup restore error:", err);
      return Response.json({ 
        error: `Fehler beim Wiederherstellen des Backups: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}` 
      }, { status: 500 });
    }
  }

  return null;
}
