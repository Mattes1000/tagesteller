import { useState, useEffect } from "react";
import { getMenus, placeOrder, checkOrderForDate, deleteOrder, getAvailableDates, getUsers, getLockedDates } from "../api";
import type { Menu, User } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { CheckCircle, Login, Delete } from "@mui/icons-material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/de";
import { Link } from "react-router-dom";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });
}

export default function MenuPage() {
  const { user } = useAuth();
  const today = dayjs();

  const [selectedDate, setSelectedDate] = useState<Dayjs>(today);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [lockedDates, setLockedDates] = useState<string[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasOrder, setHasOrder] = useState(false);
  const [orderedMenuId, setOrderedMenuId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const isAdmin = user && (user.role === "admin" || user.role === "manager");

  useEffect(() => {
    getAvailableDates().then(setAvailableDates);
    getLockedDates().then(setLockedDates);
    if (isAdmin) {
      getUsers().then(setUsers);
    }
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    const dateStr = selectedDate.format('YYYY-MM-DD');
    getMenus(dateStr)
      .then(setMenus)
      .finally(() => setLoading(false));
  }, [selectedDate]);

  useEffect(() => {
    if (user) {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      checkOrderForDate(user.id, dateStr).then((res) => {
        setHasOrder(res.hasOrder);
        setOrderedMenuId(res.menuId);
      });
    } else {
      setHasOrder(false);
      setOrderedMenuId(null);
    }
    setError(null);
    setSuccess(null);
  }, [user, selectedDate]);

  const handleOrder = async (menu: Menu) => {
    if (!user) {
      setError("Bitte melde dich an, um zu bestellen.");
      return;
    }

    // Admin/Manager: Zeige Dialog zur Benutzerauswahl
    if (isAdmin) {
      setSelectedMenu(menu);
      setSelectedUserId(null);
      setAdminDialogOpen(true);
      return;
    }

    // Normale Benutzer: Direkt bestellen
    await placeOrderForUser(menu, user.id, `${user.firstname} ${user.lastname}`);
  };

  const placeOrderForUser = async (menu: Menu, userId: number, customerName: string) => {
    setError(null);
    setSuccess(null);

    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const result = await placeOrder({
        customer_name: customerName,
        user_id: userId,
        order_date: dateStr,
        menu_id: menu.id,
        quantity: 1,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(`Bestellung erfolgreich! ${menu.name} für ${customerName} am ${formatDate(dateStr)}`);
        if (userId === user?.id) {
          setHasOrder(true);
          setOrderedMenuId(menu.id);
        }
        // Aktualisiere Menüs, um verfügbare Menge zu aktualisieren
        getMenus(dateStr).then(setMenus);
      }
    } catch {
      setError("Fehler beim Bestellen. Bitte versuche es erneut.");
    }
  };

  const handleAdminOrderConfirm = async () => {
    if (!selectedMenu || !selectedUserId) return;

    const selectedUser = users.find(u => u.id === selectedUserId);
    if (!selectedUser) return;

    await placeOrderForUser(
      selectedMenu,
      selectedUserId,
      `${selectedUser.firstname} ${selectedUser.lastname}`
    );

    setAdminDialogOpen(false);
    setSelectedMenu(null);
    setSelectedUserId(null);
  };

  const handleCancelOrder = async (event: React.MouseEvent) => {
    event.stopPropagation();

    if (!user) return;

    setError(null);
    setSuccess(null);

    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const result = await deleteOrder(user.id, dateStr);

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess("Bestellung erfolgreich storniert.");
        setHasOrder(false);
        setOrderedMenuId(null);
        // Aktualisiere Menüs, um verfügbare Menge zu aktualisieren
        const dateStr = selectedDate.format('YYYY-MM-DD');
        getMenus(dateStr).then(setMenus);
      }
    } catch {
      setError("Fehler beim Stornieren. Bitte versuche es erneut.");
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 2 }}>
        Speisekarte
      </Typography>

      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
        <Box sx={{ mb: 4 }}>
          <DatePicker
            label="Datum wählen"
            value={selectedDate}
            onChange={(newValue) => newValue && setSelectedDate(newValue)}
            shouldDisableDate={(date) => {
              const dateStr = date.format('YYYY-MM-DD');
              const isBeforeToday = date.isBefore(today, 'day');
              const isAvailable = availableDates.includes(dateStr);
              return isBeforeToday || !isAvailable;
            }}
            slotProps={{
              textField: {
                fullWidth: true,
                sx: { maxWidth: 400 }
              }
            }}
            format="dddd, DD. MMMM YYYY"
          />
        </Box>
      </LocalizationProvider>

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

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && menus.length === 0 && (
        <Typography color="text.secondary">
          Keine Menüs für diesen Tag verfügbar.
        </Typography>
      )}

      {!loading && (
        <Grid container spacing={3}>
          {menus.map((menu) => {
            const isOrdered = orderedMenuId === menu.id;
            const dateStr = selectedDate.format('YYYY-MM-DD');
            const isDateLocked = lockedDates.includes(dateStr);

            return (
              <Grid item xs={12} sm={6} md={4} key={menu.id}>
                <Card
                  elevation={2}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "all 0.2s",
                    border: isOrdered ? 2 : 0,
                    borderColor: isOrdered ? "success.main" : "transparent",
                    "&:hover": {
                      boxShadow: 4,
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {menu.name}
                      </Typography>
                      {isOrdered && (
                        <Chip
                          icon={<CheckCircle />}
                          label="Bestellt"
                          color="success"
                          size="small"
                          onDelete={isDateLocked ? undefined : handleCancelOrder}
                          deleteIcon={
                            isDateLocked ? undefined : (
                              <IconButton
                                size="small"
                                sx={{
                                  padding: 0,
                                  "&:hover": { color: "error.main" }
                                }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            )
                          }
                        />
                      )}
                    </Box>

                    {menu.description && (
                      <Card variant="outlined" sx={{ mb: 2, p: 1.5, backgroundColor: "grey.50" }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5, fontSize: "0.7rem" }}>
                          Allergene:
                        </Typography>
                        <Box>
                          {menu.description.split(/\s+/).filter(word => word.trim()).map((word, index) => (
                            <Typography key={index} variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", display: "block" }}>
                              {word}
                            </Typography>
                          ))}
                        </Box>
                      </Card>
                    )}

                    {!isDateLocked && (menu as any).max_quantity !== null && (menu as any).max_quantity !== undefined && (
                      <Box sx={{ mb: 2 }}>
                        {(menu as any).remaining_quantity !== null && (menu as any).remaining_quantity !== undefined && (
                          <Chip
                            label={`Noch ${(menu as any).remaining_quantity} von ${(menu as any).max_quantity} verfügbar`}
                            size="small"
                            color={(menu as any).remaining_quantity > 0 ? "default" : "error"}
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                      </Box>
                    )}

                    <Box sx={{ mt: "auto", pt: 2, borderTop: 1, borderColor: "divider" }}>
                      <Typography variant="h6" color="primary" sx={{ fontWeight: 700, mb: 2, whiteSpace: "nowrap" }}>
                        {menu.price.toFixed(2).replace('.', ',')}&nbsp;€
                      </Typography>

                      {!user ? (
                        <Button
                          fullWidth
                          variant="outlined"
                          component={Link}
                          to="/login"
                          startIcon={<Login />}
                        >
                          Anmelden zum Bestellen
                        </Button>
                      ) : isDateLocked ? (
                        <Button
                          fullWidth
                          variant="outlined"
                          disabled
                        >
                          Tag fixiert - keine Bestellungen möglich
                        </Button>
                      ) : isOrdered && !isAdmin ? (
                        <Button
                          fullWidth
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircle />}
                          disabled
                        >
                          Bereits bestellt
                        </Button>
                      ) : hasOrder && !isAdmin ? (
                        <Button
                          fullWidth
                          variant="outlined"
                          disabled
                        >
                          Bereits für heute bestellt
                        </Button>
                      ) : (menu as any).remaining_quantity === 0 ? (
                        <Button
                          fullWidth
                          variant="outlined"
                          color="error"
                          disabled
                        >
                          Ausverkauft
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={() => handleOrder(menu)}
                        >
                          {isAdmin ? "Bestellung aufgeben" : "Jetzt bestellen"}
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={adminDialogOpen} onClose={() => setAdminDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bestellung für Benutzer aufgeben</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
            {selectedMenu && (
              <Alert severity="info">
                Menü: <strong>{selectedMenu.name}</strong> ({selectedMenu.price.toFixed(2).replace('.', ',')}&nbsp;€)
              </Alert>
            )}
            
            <FormControl fullWidth>
              <InputLabel>Benutzer auswählen</InputLabel>
              <Select
                value={selectedUserId ?? ""}
                label="Benutzer auswählen"
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
              >
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.firstname} {u.lastname} ({u.role})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdminDialogOpen(false)}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={handleAdminOrderConfirm}
            disabled={!selectedUserId}
          >
            Bestellung aufgeben
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
