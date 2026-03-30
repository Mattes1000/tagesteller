import {useState, useEffect} from "react";
import {getOrders, deleteOrderById, lockOrderDate, unlockOrderDate, getLockedDates} from "../../api";
import type {Order} from "../../types";
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
    Chip,
    CircularProgress,
    Button,
    IconButton,
    Snackbar,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from "@mui/material";
import {ArrowUpward, ArrowDownward, Delete, Refresh, Lock, LockOpen, Print} from "@mui/icons-material";
import {LocalizationProvider} from "@mui/x-date-pickers/LocalizationProvider";
import {DatePicker} from "@mui/x-date-pickers/DatePicker";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, {Dayjs} from "dayjs";
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

export default function OrdersTab() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<"id" | "user" | "date" | "total">("date");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [filterDate, setFilterDate] = useState<Dayjs | null>(dayjs());
    const [toast, setToast] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ orderId: number; customerName: string; orderDate: string } | null>(null);
    const [locking, setLocking] = useState(false);
    const [lockedDates, setLockedDates] = useState<string[]>([]);
    const [lockDialog, setLockDialog] = useState<{ action: 'lock' | 'unlock'; date: string } | null>(null);

    const loadOrders = () => {
        setLoading(true);
        getOrders().then(setOrders).finally(() => setLoading(false));
    };

    const loadLockedDates = () => {
        getLockedDates().then(setLockedDates);
    };

    useEffect(() => {
        loadOrders();
        loadLockedDates();
    }, []);

    const openDeleteDialog = (orderId: number, customerName: string, orderDate: string) => {
        setDeleteDialog({orderId, customerName, orderDate});
    };

    const closeDeleteDialog = () => {
        setDeleteDialog(null);
    };

    const confirmDelete = async () => {
        if (!deleteDialog) return;

        try {
            await deleteOrderById(deleteDialog.orderId);
            setToast("Bestellung gelöscht.");
            loadOrders();
        } catch {
            setToast("Fehler beim Löschen der Bestellung.");
        } finally {
            closeDeleteDialog();
        }
    };

    const openLockDialog = () => {
        const dateToLock = filterDate ? filterDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
        const isLocked = lockedDates.includes(dateToLock);
        setLockDialog({action: isLocked ? 'unlock' : 'lock', date: dateToLock});
    };

    const closeLockDialog = () => {
        setLockDialog(null);
    };

    const confirmLockAction = async () => {
        if (!lockDialog) return;

        setLocking(true);
        try {
            if (lockDialog.action === 'unlock') {
                const result = await unlockOrderDate(lockDialog.date);
                if ('error' in result) {
                    setToast(result.error);
                } else {
                    setToast(`Fixierung für ${dayjs(lockDialog.date).format('DD.MM.YYYY')} wurde aufgehoben.`);
                    loadLockedDates();
                }
            } else {
                const result = await lockOrderDate(lockDialog.date);
                if ('error' in result) {
                    setToast(result.error);
                } else {
                    setToast(`Bestellungen für ${dayjs(lockDialog.date).format('DD.MM.YYYY')} wurden fixiert.`);
                    loadLockedDates();
                }
            }
        } catch {
            setToast(lockDialog.action === 'unlock' ? "Fehler beim Aufheben der Fixierung." : "Fehler beim Fixieren der Bestellungen.");
        } finally {
            setLocking(false);
            closeLockDialog();
        }
    };

    const handlePrint = () => {
        if (!filterDate) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = filterDate.format('DD.MM.YYYY');
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Bestellungen ${dateStr}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    h1 {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background-color: #f0f0f0;
                        font-weight: bold;
                    }
                    .checkbox-cell {
                        width: 60px;
                        text-align: center;
                    }
                    .remarks-cell {
                        width: 250px;
                    }
                    @media print {
                        body {
                            padding: 10px;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>Bestellungen für ${dateStr}</h1>
                <table>
                    <thead>
                        <tr>
                            <th>Nr.</th>
                            <th>Name</th>
                            <th>Menü</th>
                            <th class="remarks-cell">Bemerkung</th>
                            <th class="checkbox-cell">Bezahlt</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedOrders.map((order, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${order.user_fullname || order.customer_name}</td>
                                <td>${order.items || '–'}</td>
                                <td class="remarks-cell">${order.remarks || '–'}</td>
                                <td class="checkbox-cell">☐</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const handleSort = (column: "id" | "user" | "date" | "total") => {
        if (sortBy === column) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortBy(column);
            setSortOrder("asc");
        }
    };

    const filteredOrders = filterDate
        ? orders.filter((o) => {
            const orderDate = dayjs(o.order_date).format('YYYY-MM-DD');
            const selectedDate = filterDate.format('YYYY-MM-DD');
            return orderDate === selectedDate;
        })
        : orders;

    const sortedOrders = [...filteredOrders].sort((a, b) => {
        let comparison = 0;
        if (sortBy === "id") {
            comparison = a.id - b.id;
        } else if (sortBy === "user") {
            const nameA = (a.user_fullname ?? a.customer_name).toLowerCase();
            const nameB = (b.user_fullname ?? b.customer_name).toLowerCase();
            comparison = nameA.localeCompare(nameB);
        } else if (sortBy === "date") {
            comparison = new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
        } else if (sortBy === "total") {
            comparison = a.total - b.total;
        }
        return sortOrder === "asc" ? comparison : -comparison;
    });

    return (
        <Box>
            <Box sx={{mb: 3}}>
                <Typography variant="h2" sx={{mb: 2}}>
                    Bestellungen
                </Typography>
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
                    <Box sx={{display: "flex", flexDirection: {xs: "column", md: "row"}, gap: 2, alignItems: {xs: "stretch", md: "center"}, flexWrap: "wrap"}}>
                        <Box sx={{display: "flex", gap: 1, alignItems: "center", flexGrow: {xs: 1, md: 0}}}>
                            <Typography variant="body2" color="text.secondary" sx={{display: {xs: "none", sm: "block"}}}>
                                Datum:
                            </Typography>
                            <DatePicker
                                value={filterDate}
                                onChange={(newValue) => setFilterDate(newValue)}
                                slotProps={{
                                    textField: {
                                        size: "small",
                                        sx: {flexGrow: 1, minWidth: {xs: "auto", sm: 200}}
                                    }
                                }}
                                format="DD.MM.YYYY"
                            />
                            {filterDate && (
                                <Button
                                    size="small"
                                    onClick={() => setFilterDate(null)}
                                    variant="outlined"
                                    sx={{flexShrink: 0}}
                                >
                                    Zurücksetzen
                                </Button>
                            )}
                        </Box>
                        <Box sx={{display: "flex", gap: 1, flexWrap: "wrap"}}>
                            <Button
                                variant="contained"
                                size="small"
                                color={filterDate && lockedDates.includes(filterDate.format('YYYY-MM-DD')) ? "success" : "warning"}
                                startIcon={filterDate && lockedDates.includes(filterDate.format('YYYY-MM-DD')) ?
                                    <LockOpen/> : <Lock/>}
                                onClick={openLockDialog}
                                disabled={locking || !filterDate}
                                sx={{flexGrow: {xs: 1, sm: 0}}}
                            >
                                {filterDate && lockedDates.includes(filterDate.format('YYYY-MM-DD'))
                                    ? `Fixierung aufheben`
                                    : filterDate
                                        ? `Fixieren`
                                        : "Datum wählen"}
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<Refresh/>}
                                onClick={loadOrders}
                                disabled={loading}
                                sx={{flexGrow: {xs: 1, sm: 0}}}
                            >
                                Aktualisieren
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                color="primary"
                                startIcon={<Print/>}
                                onClick={handlePrint}
                                disabled={!filterDate || sortedOrders.length === 0}
                                sx={{flexGrow: {xs: 1, sm: 0}}}
                            >
                                Drucken
                            </Button>
                        </Box>
                    </Box>
                </LocalizationProvider>
            </Box>

            {loading ? (
                <Box sx={{display: "flex", justifyContent: "center", py: 4}}>
                    <CircularProgress/>
                </Box>
            ) : orders.length === 0 ? (
                <Typography color="text.secondary">
                    Noch keine Bestellungen vorhanden.
                </Typography>
            ) : (
                <TableContainer component={Paper} sx={{overflowX: "auto"}}>
                    <Table sx={{minWidth: {xs: 650, sm: 750}}}>
                        <TableHead>
                            <TableRow>
                                <TableCell
                                    onClick={() => handleSort("id")}
                                    sx={{cursor: "pointer", userSelect: "none"}}
                                >
                                    <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                                        #
                                        {sortBy === "id" && (
                                            sortOrder === "asc" ? <ArrowUpward fontSize="small"/> :
                                                <ArrowDownward fontSize="small"/>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell
                                    onClick={() => handleSort("user")}
                                    sx={{cursor: "pointer", userSelect: "none"}}
                                >
                                    <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                                        Benutzer
                                        {sortBy === "user" && (
                                            sortOrder === "asc" ? <ArrowUpward fontSize="small"/> :
                                                <ArrowDownward fontSize="small"/>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell>Speisen</TableCell>
                                <TableCell>Bemerkung</TableCell>
                                <TableCell
                                    onClick={() => handleSort("date")}
                                    sx={{cursor: "pointer", userSelect: "none"}}
                                >
                                    <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                                        Datum
                                        {sortBy === "date" && (
                                            sortOrder === "asc" ? <ArrowUpward fontSize="small"/> :
                                                <ArrowDownward fontSize="small"/>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell
                                    align="right"
                                    onClick={() => handleSort("total")}
                                    sx={{cursor: "pointer", userSelect: "none"}}
                                >
                                    <Box sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "flex-end",
                                        gap: 0.5
                                    }}>
                                        Gesamt
                                        {sortBy === "total" && (
                                            sortOrder === "asc" ? <ArrowUpward fontSize="small"/> :
                                                <ArrowDownward fontSize="small"/>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell align="right">Aktionen</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedOrders.map((o) => (
                                <TableRow key={o.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            #{o.id}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{fontWeight: 600, mb: 0.5}}>
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
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                            })}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" color="primary" sx={{fontWeight: 700}}>
                                            {o.total.toFixed(2)} €
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => openDeleteDialog(o.id, o.user_fullname ?? o.customer_name, o.order_date)}
                                        >
                                            <Delete fontSize="small"/>
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog
                open={!!deleteDialog}
                onClose={closeDeleteDialog}
            >
                <DialogTitle>Bestellung löschen</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Möchtest du die Bestellung von <strong>{deleteDialog?.customerName}</strong> wirklich löschen?
                        Diese Aktion kann nicht rückgängig gemacht werden.
                    </DialogContentText>
                    {deleteDialog && lockedDates.includes(deleteDialog.orderDate) && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            <strong>Achtung:</strong> Dieser Tag ist fixiert.
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog}>Abbrechen</Button>
                    <Button onClick={confirmDelete} color="error" variant="contained">
                        Löschen
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!lockDialog} onClose={closeLockDialog}>
                <DialogTitle>
                    {lockDialog?.action === 'unlock' ? 'Fixierung aufheben' : 'Bestellungen fixieren'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {lockDialog?.action === 'unlock'
                            ? `Fixierung für ${lockDialog?.date ? dayjs(lockDialog.date).format('DD.MM.YYYY') : ''} aufheben?

Benutzer können dann ihre Bestellungen für diesen Tag wieder ändern oder stornieren.`
                            : `Bestellungen für ${lockDialog?.date ? dayjs(lockDialog.date).format('DD.MM.YYYY') : ''} fixieren?

Nach dem Fixieren können Benutzer ihre Bestellungen für diesen Tag nicht mehr ändern oder stornieren.`}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeLockDialog}>Abbrechen</Button>
                    <Button
                        onClick={confirmLockAction}
                        color={lockDialog?.action === 'unlock' ? 'success' : 'warning'}
                        variant="contained"
                        disabled={locking}
                    >
                        {lockDialog?.action === 'unlock' ? 'Aufheben' : 'Fixieren'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!toast}
                autoHideDuration={3000}
                onClose={() => setToast(null)}
                anchorOrigin={{vertical: "bottom", horizontal: "right"}}
            >
                <Alert severity="success" onClose={() => setToast(null)}>
                    {toast}
                </Alert>
            </Snackbar>
        </Box>
    );
}
