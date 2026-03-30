import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMyOrders, getUserOrders } from "../api";
import type { Order } from "../types";
import { useAuth } from "../context/AuthContext";
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
  CircularProgress,
  Alert,
  Button,
  Chip,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/de";

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

export default function UserOrdersPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = dayjs();
  const twoWeeksLater = today.add(14, "day");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<Dayjs | null>(today);
  const [toDate, setToDate] = useState<Dayjs | null>(twoWeeksLater);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId ? parseInt(userId) : user?.id;
  const isAdmin = user && (user.role === "admin" || user.role === "manager");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!targetUserId) {
      return;
    }

    // Sicherheit: Normale Benutzer dürfen nur ihre eigenen Bestellungen sehen
    if (!isAdmin && targetUserId !== user.id) {
      return;
    }

    setLoading(true);
    setError(null);

    const fromDateStr = fromDate ? fromDate.format("YYYY-MM-DD") : undefined;
    const toDateStr = toDate ? toDate.format("YYYY-MM-DD") : undefined;

    // Normale Benutzer: Eigene Bestellungen ohne userId
    // Admins: Bestellungen eines spezifischen Benutzers
    const fetchPromise = isAdmin && targetUserId && targetUserId !== user?.id
      ? getUserOrders(targetUserId, fromDateStr, toDateStr)
      : getMyOrders(fromDateStr, toDateStr);

    fetchPromise
      .then((data) => {
        // Sortiere nach Datum aufsteigend
        const sorted = [...data].sort((a, b) => {
          return new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
        });
        setOrders(sorted);
      })
      .catch(() => setError("Fehler beim Laden der Bestellungen."))
      .finally(() => setLoading(false));
  }, [user, targetUserId, fromDate, toDate, navigate, isAdmin]);

  useEffect(() => {
    if (user && !targetUserId) {
      setError("Benutzer-ID fehlt.");
      setLoading(false);
    } else if (user && !isAdmin && targetUserId !== user.id) {
      setError("Du hast keine Berechtigung, die Bestellungen anderer Benutzer zu sehen.");
      setLoading(false);
    }
  }, [user, targetUserId, isAdmin]);

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)}>
          Zurück
        </Button>
      </Box>
    );
  }

  const displayUser = orders.length > 0 ? orders[0].user_fullname : "Benutzer";

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)}>
          Zurück
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {isAdmin && targetUserId !== user.id
            ? `Bestellungen von ${displayUser}`
            : "Meine Bestellungen"}
        </Typography>
      </Box>

      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            mb: 3,
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexGrow: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              Von:
            </Typography>
            <DatePicker
              label="Von"
              value={fromDate}
              onChange={(newValue) => setFromDate(newValue)}
              slotProps={{
                textField: {
                  size: "small",
                  sx: { flexGrow: 1 },
                },
              }}
              format="DD.MM.YYYY"
            />
          </Box>

          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexGrow: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              Bis:
            </Typography>
            <DatePicker
              label="Bis"
              value={toDate}
              onChange={(newValue) => setToDate(newValue)}
              slotProps={{
                textField: {
                  size: "small",
                  sx: { flexGrow: 1 },
                },
              }}
              format="DD.MM.YYYY"
            />
          </Box>

          <Button 
            variant="contained" 
            onClick={() => {
              setFromDate(fromDate);
              setToDate(toDate);
            }} 
            disabled={loading}
          >
            Aktualisieren
          </Button>
        </Box>
      </LocalizationProvider>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : orders.length === 0 ? (
        <Alert severity="info">Keine Bestellungen im ausgewählten Zeitraum gefunden.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>

                {isAdmin && <TableCell>Benutzer</TableCell>}
                <TableCell>Speisen</TableCell>
                <TableCell>Bemerkung</TableCell>
                <TableCell>Datum</TableCell>
                <TableCell align="right">Gesamt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} hover>

                  {isAdmin && (
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {o.user_fullname ?? o.customer_name}
                      </Typography>
                      {o.user_role && (
                        <Chip
                          label={ROLE_LABELS[o.user_role] || o.user_role}
                          color={ROLE_COLORS[o.user_role] || "default"}
                          size="small"
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        maxWidth: 300,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {o.items ?? "–"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {o.remarks || "–"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(o.order_date).toLocaleDateString("de-DE", {
                        weekday: "long",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                      {o.total.toFixed(2)} €
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
