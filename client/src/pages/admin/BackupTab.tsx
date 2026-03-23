import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Stack,
} from "@mui/material";
import { Download, Upload, CloudDownload } from "@mui/icons-material";

export default function BackupTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreateBackup = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/backup/create", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Backup-Erstellung fehlgeschlagen");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tagesteller-backup-${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess("Backup erfolgreich erstellt und heruntergeladen!");
    } catch (err) {
      setError("Fehler beim Erstellen des Backups. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("backup", file);

      const response = await fetch("/api/backup/restore", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Backup-Wiederherstellung fehlgeschlagen");
      }

      setSuccess("Backup erfolgreich wiederhergestellt! Bitte lade die Seite neu.");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Wiederherstellen des Backups.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Backup & Wiederherstellung
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <CloudDownload sx={{ mr: 2, fontSize: 32, color: "primary.main" }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Backup erstellen
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Erstelle eine Sicherungskopie der Datenbank
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Download />}
              onClick={handleCreateBackup}
              disabled={loading}
              fullWidth
            >
              {loading ? "Erstelle Backup..." : "Backup herunterladen"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Upload sx={{ mr: 2, fontSize: 32, color: "warning.main" }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Backup wiederherstellen
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Stelle die Datenbank aus einer Sicherungskopie wieder her
                </Typography>
              </Box>
            </Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Warnung:</strong> Diese Aktion überschreibt alle aktuellen Daten!
            </Alert>
            <Button
              variant="outlined"
              component="label"
              startIcon={<Upload />}
              disabled={loading}
              fullWidth
              color="warning"
            >
              Backup-Datei auswählen
              <input
                type="file"
                hidden
                accept=".db"
                onChange={handleRestoreBackup}
              />
            </Button>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
