import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import UsersTab from "./admin/UsersTab";
import OrdersTab from "./admin/OrdersTab";
import MenusTab from "./admin/MenusTab";
import BackupTab from "./admin/BackupTab";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
} from "@mui/material";
import { Lock } from "@mui/icons-material";

type Tab = "menus" | "users" | "orders" | "backup";

export default function AdminPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const defaultTab = user?.role === "admin" ? "menus" : "orders";
  const activeTab = (searchParams.get("tab") as Tab) || defaultTab;
  
  const setActiveTab = (tab: Tab) => {
    setSearchParams({ tab });
  };
  
  // Validate tab on mount
  useEffect(() => {
    const tab = searchParams.get("tab") as Tab;
    const validTabs = user?.role === "admin" ? ["menus", "users", "orders", "backup"] : ["orders"];
    if (!tab || !validTabs.includes(tab)) {
      setSearchParams({ tab: defaultTab }, { replace: true });
    }
  }, [user]);

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
        <Card sx={{ maxWidth: 400, textAlign: "center" }}>
          <CardContent sx={{ p: 5 }}>
            <Lock sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Kein Zugriff
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Du benötigst die Rolle CD-Mitarbeiter oder Admin, um diese Seite aufzurufen.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: "menus",  label: "📋 Menüs",        visible: user.role === "admin" },
    { id: "users",  label: "👤 Benutzer",     visible: user.role === "admin" },
    { id: "orders", label: "📦 Bestellungen", visible: true },
    { id: "backup", label: "💾 Backup",       visible: user.role === "admin" },
  ];

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}
      >
        {tabs.filter((t) => t.visible).map((t) => (
          <Tab key={t.id} label={t.label} value={t.id} />
        ))}
      </Tabs>

      {activeTab === "menus" && user.role === "admin" && <MenusTab />}
      {activeTab === "users" && user.role === "admin" && <UsersTab />}
      {activeTab === "orders" && <OrdersTab />}
      {activeTab === "backup" && user.role === "admin" && <BackupTab />}
    </Box>
  );
}
