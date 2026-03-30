import { useState, useEffect } from "react";
import { getMenus, placeOrder, checkOrderForDate } from "../api";
import type { Menu } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";
import { CheckCircle } from "@mui/icons-material";

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });
}

export default function OrderPage() {
  const { user } = useAuth();
  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return toDateStr(d);
  });

  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasOrder, setHasOrder] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getMenus(selectedDate)
      .then(setMenus)
      .finally(() => setLoading(false));
  }, [selectedDate]);

  useEffect(() => {
    if (user) {
      checkOrderForDate(selectedDate).then((res) => setHasOrder(res.hasOrder));
    } else {
      setHasOrder(false);
    }
    setSelectedMenu(null);
    setSuccess(null);
    setError(null);
  }, [user, selectedDate]);

  const handleOrder = async () => {
    if (!user) {
      setError("Bitte melde dich an, um zu bestellen.");
      return;
    }

    if (!selectedMenu) {
      setError("Bitte wähle ein Menü aus.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await placeOrder({
        customer_name: `${user.firstname} ${user.lastname}`,
        user_id: user.id,
        order_date: selectedDate,
        menu_id: selectedMenu,
        quantity: 1,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(`Bestellung erfolgreich! Gesamt: ${result.total.toFixed(2)} €`);
        setHasOrder(true);
        setSelectedMenu(null);
      }
    } catch (err) {
      setError("Fehler beim Bestellen. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 8, p: 3 }}>
        <Alert severity="info">
          Bitte melde dich an, um Essen zu bestellen.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
        🍽 Essen bestellen
      </Typography>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Wähle einen Tag
          </Typography>
          <Grid container spacing={1}>
            {dates.map((date) => (
              <Grid item key={date} xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant={selectedDate === date ? "contained" : "outlined"}
                  onClick={() => setSelectedDate(date)}
                  sx={{ py: 1.5 }}
                >
                  {formatDate(date)}
                </Button>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {hasOrder && (
        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 4 }}>
          Du hast bereits eine Bestellung für {formatDate(selectedDate)}.
        </Alert>
      )}

      {!hasOrder && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Wähle dein Menü für {formatDate(selectedDate)}
            </Typography>

            {success && (
              <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : menus.length === 0 ? (
              <Alert severity="info">
                Keine Menüs verfügbar für {formatDate(selectedDate)}.
              </Alert>
            ) : (
              <>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Menü auswählen</InputLabel>
                  <Select
                    value={selectedMenu ?? ""}
                    label="Menü auswählen"
                    onChange={(e) => setSelectedMenu(Number(e.target.value))}
                  >
                    {menus.map((menu) => (
                      <MenuItem key={menu.id} value={menu.id}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                          <span>{menu.name}</span>
                          <Chip label={`${menu.price.toFixed(2)} €`} size="small" color="primary" />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedMenu && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                    {menus.find((m) => m.id === selectedMenu)?.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
                        {menus.find((m) => m.id === selectedMenu)?.description}
                      </Typography>
                    )}
                  </Box>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleOrder}
                  disabled={!selectedMenu || loading}
                >
                  {loading ? "Wird bestellt..." : "Jetzt bestellen"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
