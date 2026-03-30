import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { getUsers, createUser, updateUser, deleteUser, regenerateQrToken, adminResetPassword } from "../../api";
import type { User } from "../../types";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
} from "@mui/material";
import { QrCode2, Edit, Delete, Print, Refresh, ArrowUpward, ArrowDownward, Lock, Receipt } from "@mui/icons-material";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "CD-Mitarbeiter",
  user: "Benutzer",
};

const ROLE_COLORS: Record<string, "error" | "info" | "default"> = {
  admin: "error",
  manager: "info",
  user: "default",
};

const EMPTY_FORM = { firstname: "", lastname: "", username: "", role: "user" };

export default function UsersTab() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [qrModal, setQrModal] = useState<User | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [regenerating, setRegenerating] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "role">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tempPasswordDialog, setTempPasswordDialog] = useState<{ username: string; password: string } | null>(null);
  const [passwordResetDialog, setPasswordResetDialog] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getUsers().then(setUsers).finally(() => setLoading(false));
  };

  const handleSort = (column: "name" | "role") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "name") {
      const nameA = `${a.firstname} ${a.lastname}`.toLowerCase();
      const nameB = `${b.firstname} ${b.lastname}`.toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (sortBy === "role") {
      comparison = a.role.localeCompare(b.role);
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (qrModal) {
      const loginUrl = `${window.location.origin}/login/${qrModal.qr_token}`;
      QRCode.toDataURL(loginUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).then((url) => {
        setQrDataUrl(url);
      }).catch((err) => {
        console.error('QR Code generation failed:', err);
      });
    }
  }, [qrModal]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openEdit = (u: User) => {
    setEditId(u.id);
    setForm({ firstname: u.firstname, lastname: u.lastname, username: u.username || "", role: u.role });
    setDialogOpen(true);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleCancel = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!form.firstname.trim() || !form.lastname.trim()) return;
    if (editId === null && !form.username.trim()) return;
    setSaving(true);
    try {
      if (editId !== null) {
        await updateUser(editId, form);
        showToast("Benutzer gespeichert.");
      } else {
        const result = await createUser(form);
        setTempPasswordDialog({ username: form.username, password: result.tempPassword });
        showToast("Benutzer erstellt.");
      }
      setDialogOpen(false);
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`"${u.firstname} ${u.lastname}" wirklich löschen?`)) return;
    await deleteUser(u.id);
    showToast("Benutzer gelöscht.");
    load();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRegenerateQr = async () => {
    if (!qrModal) return;
    setRegenerating(true);
    try {
      const result = await regenerateQrToken(qrModal.id);
      const updatedUser = { ...qrModal, qr_token: result.qr_token };
      setQrModal(updatedUser);
      setUsers(users.map(u => u.id === qrModal.id ? updatedUser : u));
      showToast("QR-Code wurde neu generiert");
    } catch (err) {
      showToast("Fehler beim Regenerieren des QR-Codes");
    } finally {
      setRegenerating(false);
    }
  };

  const openPasswordReset = (user: User) => {
    setPasswordResetDialog(user);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  };

  const handlePasswordReset = async () => {
    if (!passwordResetDialog) return;

    setPasswordError(null);

    if (!newPassword || !confirmPassword) {
      setPasswordError("Bitte beide Felder ausfüllen.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwörter stimmen nicht überein.");
      return;
    }

    setSaving(true);
    try {
      const result = await adminResetPassword(passwordResetDialog.id, newPassword);
      if ("error" in result) {
        setPasswordError(result.error);
      } else {
        showToast("Passwort erfolgreich gesetzt.");
        setPasswordResetDialog(null);
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPasswordError("Fehler beim Setzen des Passworts.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h2">
          Benutzerverwaltung
        </Typography>
        <Button variant="contained" onClick={openNew} startIcon={<Edit />}>
          Neuer Benutzer
        </Button>
      </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell
                    onClick={() => handleSort("name")}
                    sx={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      Name
                      {sortBy === "name" && (
                        sortOrder === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell
                    onClick={() => handleSort("role")}
                    sx={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      Rolle
                      {sortBy === "role" && (
                        sortOrder === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedUsers.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {u.firstname} {u.lastname}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ROLE_LABELS[u.role]}
                        color={ROLE_COLORS[u.role]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => navigate(`/orders/user/${u.id}`)}
                          title="Bestellungen anzeigen"
                        >
                          <Receipt fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => setQrModal(u)}
                        >
                          <QrCode2 fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openEdit(u)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => openPasswordReset(u)}
                          title="Passwort setzen"
                        >
                          <Lock fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(u)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <Typography color="text.secondary">
                        Keine Benutzer vorhanden.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

      <Dialog
        open={dialogOpen}
        onClose={handleCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editId !== null ? "Benutzer bearbeiten" : "Neuer Benutzer"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Vorname"
              value={form.firstname}
              onChange={(e) => setForm((f) => ({ ...f, firstname: e.target.value }))}
              placeholder="z.B. Maria"
            />

            <TextField
              fullWidth
              size="small"
              label="Nachname"
              value={form.lastname}
              onChange={(e) => setForm((f) => ({ ...f, lastname: e.target.value }))}
              placeholder="z.B. Müller"
            />

            <TextField
              fullWidth
              size="small"
              label="Benutzername"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="z.B. maria.mueller"
              disabled={editId !== null}
              helperText={editId !== null ? "Benutzername kann nach Erstellung nicht geändert werden" : ""}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Rolle</InputLabel>
              <Select
                value={form.role}
                label="Rolle"
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <MenuItem value="user">Benutzer</MenuItem>
                <MenuItem value="manager">CD-Mitarbeiter</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.firstname.trim() || !form.lastname.trim() || (editId === null && !form.username.trim())}
          >
            {saving ? "Speichere…" : editId !== null ? "Speichern" : "Erstellen"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!qrModal} onClose={() => setQrModal(null)} maxWidth="xs" fullWidth>
        <style>{`
          @media print {
            @page {
              margin: 2cm;
            }
            body * {
              visibility: hidden;
            }
            .print-area,
            .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              page-break-inside: avoid;
              text-align: center;
              padding: 40px 20px;
            }
            .print-username {
              font-size: 32px !important;
              font-weight: 700 !important;
              color: #000 !important;
              margin-bottom: 30px !important;
              display: block !important;
            }
            .print-qr {
              display: block !important;
              margin: 0 auto !important;
              max-width: 300px !important;
              height: auto !important;
            }
            .no-print {
              display: none !important;
              visibility: hidden !important;
            }
          }
        `}</style>
        <DialogTitle sx={{ textAlign: "center" }} className="no-print">
          {qrModal?.firstname} {qrModal?.lastname}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div className="print-area">
            <div className="print-username">
              {qrModal?.firstname} {qrModal?.lastname}
            </div>
            <Typography variant="caption" color="text.secondary" textAlign="center" className="no-print" sx={{ mb: 2 }}>
              QR-Code scannen zum Anmelden
            </Typography>
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="print-qr" style={{ borderRadius: 8, maxWidth: '100%', height: 'auto' }} />}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: "monospace", wordBreak: "break-all", textAlign: "center", mt: 2, display: "block" }}
              className="no-print"
            >
              /login/{qrModal?.qr_token}
            </Typography>
          </div>
        </DialogContent>
        <DialogActions className="no-print">
          <Button
            onClick={handleRegenerateQr}
            startIcon={<Refresh />}
            disabled={regenerating}
            color="warning"
          >
            {regenerating ? "Regeneriere..." : "QR-Code neu generieren"}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={handlePrint} startIcon={<Print />}>
            Drucken
          </Button>
          <Button onClick={() => setQrModal(null)} variant="contained">
            Schließen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!tempPasswordDialog} onClose={() => setTempPasswordDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Benutzer erfolgreich erstellt</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Alert severity="info">
              Der Benutzer wurde erfolgreich erstellt. Bitte notiere das temporäre Passwort - es wird nur einmal angezeigt!
            </Alert>

            <Box sx={{ bgcolor: "grey.100", p: 2, borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Benutzername:
              </Typography>
              <Typography variant="h6" sx={{ fontFamily: "monospace", mb: 2 }}>
                {tempPasswordDialog?.username}
              </Typography>

              <Typography variant="body2" color="text.secondary" gutterBottom>
                Temporäres Passwort:
              </Typography>
              <Typography variant="h5" sx={{ fontFamily: "monospace", fontWeight: 700, color: "primary.main" }}>
                {tempPasswordDialog?.password}
              </Typography>
            </Box>

            <Alert severity="warning">
              Der Benutzer sollte das Passwort nach dem ersten Login ändern.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTempPasswordDialog(null)} variant="contained">
            Verstanden
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!passwordResetDialog} onClose={() => setPasswordResetDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Passwort setzen für {passwordResetDialog?.firstname} {passwordResetDialog?.lastname}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
            {passwordError && (
              <Alert severity="error">{passwordError}</Alert>
            )}

            <TextField
              fullWidth
              type="password"
              label="Neues Passwort"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              autoFocus
            />

            <TextField
              fullWidth
              type="password"
              label="Passwort bestätigen"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
            />

            <Alert severity="info">
              Das Passwort wird sofort für den Benutzer gesetzt und kann zum Login verwendet werden.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordResetDialog(null)}>Abbrechen</Button>
          <Button
            onClick={handlePasswordReset}
            variant="contained"
            disabled={saving}
          >
            {saving ? "Setze Passwort..." : "Passwort setzen"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="success" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
