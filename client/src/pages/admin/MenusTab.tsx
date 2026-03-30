import { useState, useEffect } from "react";
import { getAllMenus, getMenu, createMenu, updateMenu, deleteMenu, copyMenu, getMenus } from "../../api";
import type { MenuPayload } from "../../api";
import type { Menu } from "../../types";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
} from "@mui/material";
import { ContentCopy, Delete, Edit as EditIcon, ArrowUpward, ArrowDownward, Add, ChevronLeft, ChevronRight } from "@mui/icons-material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/de";

dayjs.extend(isoWeek);

function getWeekDays(date: Dayjs): Dayjs[] {
  const monday = date.startOf('isoWeek');
  return [0, 1, 2, 3, 4].map(offset => monday.add(offset, 'day'));
}

function formatWeekRange(weekDays: Dayjs[]): string {
  const first = weekDays[0];
  const last = weekDays[weekDays.length - 1];
  return `${first.format('DD.MM.')} - ${last.format('DD.MM.YYYY')}`;
}

interface DayMenus {
  date: string;
  dayName: string;
  menus: Menu[];
}

interface MenuDay {
  available_date: string;
  max_quantity: number | null;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  active: 1,
  dates: [] as string[],
  menuDays: [] as MenuDay[],
};


export default function MenusTab() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "price" | "status">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Dayjs>(dayjs());
  const [weekData, setWeekData] = useState<DayMenus[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getAllMenus()
      .then((menusData) => {
        setMenus(menusData);
      })
      .finally(() => setLoading(false));
  };

  const handleSort = (column: "name" | "price" | "status") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const activeMenus = menus.filter(m => m.active === 1);
  const inactiveMenus = menus.filter(m => m.active === 0);

  const sortMenus = (menuList: Menu[]) => {
    return [...menuList].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      } else if (sortBy === "price") {
        comparison = a.price - b.price;
      } else if (sortBy === "status") {
        comparison = (a.active ? 1 : 0) - (b.active ? 1 : 0);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  };

  const sortedActiveMenus = sortMenus(activeMenus);
  const sortedInactiveMenus = sortMenus(inactiveMenus);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadWeekData();
  }, [currentWeek]);

  const loadWeekData = async () => {
    setWeekLoading(true);
    try {
      const weekDays = getWeekDays(currentWeek);
      const dayDataPromises = weekDays.map(async (day) => {
        const dateStr = day.format('YYYY-MM-DD');
        const menus = await getMenus(dateStr);

        return {
          date: dateStr,
          dayName: day.locale('de').format('dddd, DD.MM.YYYY'),
          menus,
        };
      });

      const data = await Promise.all(dayDataPromises);
      setWeekData(data);
    } finally {
      setWeekLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => prev.subtract(1, 'week'));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => prev.add(1, 'week'));
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(dayjs());
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openNew = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = async (id: number) => {
    const menu = await getMenu(id);
    setEditId(id);
    setForm({
      name: menu.name,
      description: menu.description || "",
      price: menu.price.toString(),
      active: menu.active,
      dates: menu.dates || [],
      menuDays: menu.menuDays || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      showToast("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }

    setSaving(true);
    try {
      const payload: MenuPayload = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        active: form.active,
        dates: form.dates,
        menuDays: form.menuDays,
      };

      if (editId !== null) {
        await updateMenu(editId, payload);
        showToast("Menü gespeichert.");
      } else {
        await createMenu(payload);
        showToast("Menü erstellt.");
      }

      setForm({ ...EMPTY_FORM });
      setEditId(null);
      setDialogOpen(false);
      load();
      loadWeekData();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setDialogOpen(false);
  };

  const handleCopy = async (id: number) => {
    await copyMenu(id);
    showToast("Menü kopiert!");
    load();
    loadWeekData();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    await deleteMenu(id);
    showToast("Menü gelöscht.");
    load();
    loadWeekData();
  };

  const addDate = () => {
    if (!selectedDate) return;
    const dateStr = selectedDate.format("YYYY-MM-DD");
    if (!form.menuDays.find((md) => md.available_date === dateStr)) {
      setForm((prev) => ({
        ...prev,
        dates: [...prev.dates, dateStr].sort(),
        menuDays: [
          ...prev.menuDays,
          { available_date: dateStr, max_quantity: null },
        ].sort((a, b) => a.available_date.localeCompare(b.available_date)),
      }));
    }
    setSelectedDate(null);
  };

  const removeDate = (date: string) => {
    setForm((prev) => ({
      ...prev,
      dates: prev.dates.filter((d) => d !== date),
      menuDays: prev.menuDays.filter((md) => md.available_date !== date),
    }));
  };

  const updateMaxQuantity = (date: string, maxQuantity: string) => {
    const value = maxQuantity === "" ? null : parseInt(maxQuantity);
    setForm((prev) => ({
      ...prev,
      menuDays: prev.menuDays.map((md) =>
        md.available_date === date
          ? { ...md, max_quantity: value }
          : md
      ),
    }));
  };

  const renderMenuTable = (menuList: Menu[], title: string) => (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        {title}
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell
                onClick={() => handleSort("name")}
                sx={{ cursor: "pointer", userSelect: "none" }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Name
                  {sortBy === "name" && (
                    sortOrder === "asc" ? (
                      <ArrowUpward fontSize="small" />
                    ) : (
                      <ArrowDownward fontSize="small" />
                    )
                  )}
                </Box>
              </TableCell>
              <TableCell>Speisen</TableCell>
              <TableCell
                align="right"
                onClick={() => handleSort("price")}
                sx={{ cursor: "pointer", userSelect: "none" }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                  Preis
                  {sortBy === "price" && (
                    sortOrder === "asc" ? (
                      <ArrowUpward fontSize="small" />
                    ) : (
                      <ArrowDownward fontSize="small" />
                    )
                  )}
                </Box>
              </TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {menuList.map((menu) => (
              <TableRow key={menu.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {menu.name}
                  </Typography>
                  {menu.description && (
                    <Typography variant="caption" color="text.secondary">
                      {menu.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {menu.description || "-"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    color="primary"
                    sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    {menu.price.toFixed(2).replace(".", ",")}&nbsp;€
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => openEdit(menu.id)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="warning"
                      onClick={() => handleCopy(menu.id)}
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(menu.id, menu.name)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {menuList.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography color="text.secondary">Keine Menüs vorhanden.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const weekDays = getWeekDays(currentWeek);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h2">Menüs</Typography>
        <Button variant="contained" onClick={openNew} startIcon={<EditIcon />}>
          Neues Menü
        </Button>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <IconButton onClick={goToPreviousWeek} color="primary" size="small">
            <ChevronLeft />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Wochenübersicht: KW {currentWeek.isoWeek()} ({formatWeekRange(weekDays)})
            </Typography>
          </Box>
          <IconButton onClick={goToNextWeek} color="primary" size="small">
            <ChevronRight />
          </IconButton>
          <Button variant="outlined" onClick={goToCurrentWeek} size="small">
            Aktuelle Woche
          </Button>
        </Box>

        {weekLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Wochentag</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Konfigurierte Menüs</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {weekData.map((dayData) => (
                  <TableRow key={dayData.date}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {dayData.dayName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {dayData.menus.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Keine Menüs konfiguriert
                        </Typography>
                      ) : (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          {dayData.menus.map((menu) => (
                            <Card key={menu.id} variant="outlined" sx={{ p: 1 }}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {menu.name}
                                  </Typography>
                                  {menu.description && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: "pre-line" }}>
                                      <strong>Allergene:</strong> {menu.description.length > 100 ? menu.description.substring(0, 100) + '...' : menu.description}
                                    </Typography>
                                  )}
                                </Box>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                                    {menu.price.toFixed(2).replace('.', ',')}&nbsp;€
                                  </Typography>
                                  {menu.max_quantity !== null && menu.max_quantity !== undefined && (
                                    <Chip
                                      label={`${menu.remaining_quantity ?? 0}/${menu.max_quantity}`}
                                      size="small"
                                      color={menu.remaining_quantity && menu.remaining_quantity > 0 ? "default" : "error"}
                                    />
                                  )}
                                  <IconButton size="small" color="primary" onClick={() => openEdit(menu.id)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>
                            </Card>
                          ))}
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {renderMenuTable(sortedActiveMenus, "Aktive Menüs")}
          {renderMenuTable(sortedInactiveMenus, "Inaktive Menüs")}
        </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={handleCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editId !== null ? "Menü bearbeiten" : "Neues Menü"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="z.B. Tagesmenü"
            />

            <TextField
              fullWidth
              size="small"
              label="Allergene"
              multiline
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="z.B. Gluten, Laktose, Nüsse..."
            />

            <TextField
              size="small"
              label="Preis (€)"
              type="number"
              inputProps={{ step: 0.1, min: 0 }}
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
            />

            <FormControl size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={form.active}
                label="Status"
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: parseInt(e.target.value as string) }))
                }
              >
                <MenuItem value={1}>Aktiv</MenuItem>
                <MenuItem value={0}>Inaktiv</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Verfügbar an
              </Typography>
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
                <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                  <DatePicker
                    label="Datum hinzufügen"
                    value={selectedDate}
                    onChange={(newValue) => setSelectedDate(newValue)}
                    format="DD.MM.YYYY"
                    slotProps={{
                      textField: {
                        size: "small",
                        fullWidth: true,
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={addDate}
                    disabled={!selectedDate}
                    startIcon={<Add />}
                    sx={{ minWidth: 120 }}
                  >
                    Hinzufügen
                  </Button>
                </Box>
              </LocalizationProvider>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  maxHeight: 300,
                  overflowY: "auto",
                }}
              >
                {form.menuDays.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Keine Daten ausgewählt
                  </Typography>
                ) : (
                  form.menuDays.map((md) => (
                    <Box
                      key={md.available_date}
                      sx={{ display: "flex", gap: 1, alignItems: "center" }}
                    >
                      <Chip
                        label={new Date(md.available_date).toLocaleDateString(
                          "de-DE",
                          {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }
                        )}
                        onDelete={() => removeDate(md.available_date)}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ minWidth: 180 }}
                      />
                      <TextField
                        size="small"
                        label="Max. Anzahl"
                        type="number"
                        inputProps={{ min: 0 }}
                        value={md.max_quantity ?? ""}
                        onChange={(e) => updateMaxQuantity(md.available_date, e.target.value)}
                        placeholder="Unbegrenzt"
                        sx={{ width: 150 }}
                      />
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
          >
            {saving ? "Speichere…" : editId !== null ? "Speichern" : "Erstellen"}
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
