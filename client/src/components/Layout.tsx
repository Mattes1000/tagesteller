import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  useMediaQuery,
  useTheme,
  IconButton,
  Menu,
  MenuItem,
} from "@mui/material";
import { Restaurant, Menu as MenuIcon } from "@mui/icons-material";
import { useState } from "react";
import ChangePasswordDialog from "./ChangePasswordDialog";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const canAccessAdmin = user?.role === "admin" || user?.role === "manager";

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static" elevation={2}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 2 }}>
            <Restaurant sx={{ mr: 1 }} />
            <Typography
              variant="h6"
              component={Link}
              to="/"
              sx={{
                flexGrow: isMobile ? 1 : 0,
                textDecoration: "none",
                color: "inherit",
                fontWeight: 700,
                mr: 4,
              }}
            >
              TagesTeller
            </Typography>

            {!isMobile ? (
              <>
                <Box sx={{ flexGrow: 1, display: "flex", gap: 1 }}>
                  <Button
                    component={Link}
                    to="/"
                    color="inherit"
                    variant={pathname === "/" ? "outlined" : "text"}
                    sx={{
                      bgcolor: pathname === "/" ? "white" : "transparent",
                      color: pathname === "/" ? "primary.main" : "inherit",
                      "&:hover": {
                        bgcolor: pathname === "/" ? "white" : "primary.dark",
                      },
                    }}
                  >
                    Speisekarte
                  </Button>
                  {canAccessAdmin && (
                    <Button
                      component={Link}
                      to="/admin"
                      color="inherit"
                      variant={pathname === "/admin" ? "outlined" : "text"}
                      sx={{
                        bgcolor: pathname === "/admin" ? "white" : "transparent",
                        color: pathname === "/admin" ? "primary.main" : "inherit",
                        "&:hover": {
                          bgcolor: pathname === "/admin" ? "white" : "primary.dark",
                        },
                      }}
                    >
                      Administration
                    </Button>
                  )}
                </Box>

                {user ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {user.firstname} {user.lastname}
                    </Typography>
                    <Button
                      component={Link}
                      to="/my-orders"
                      variant="outlined"
                      size="small"
                      sx={{ color: "white", borderColor: "white" }}
                    >
                      Meine Bestellungen
                    </Button>
                    {canAccessAdmin && (
                      <Button
                        onClick={() => setPasswordDialogOpen(true)}
                        variant="outlined"
                        size="small"
                        sx={{ color: "white", borderColor: "white" }}
                      >
                        Passwort ändern
                      </Button>
                    )}
                    <Button
                      onClick={logout}
                      variant="contained"
                      size="small"
                      sx={{ bgcolor: "primary.dark" }}
                    >
                      Abmelden
                    </Button>
                  </Box>
                ) : (
                  <Button
                    component={Link}
                    to="/login"
                    variant="contained"
                    size="small"
                    sx={{ bgcolor: "white", color: "primary.main" }}
                  >
                    Anmelden
                  </Button>
                )}
              </>
            ) : (
              <>
                <IconButton
                  color="inherit"
                  onClick={handleMenuOpen}
                  edge="end"
                >
                  <MenuIcon />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                >
                  <MenuItem
                    component={Link}
                    to="/"
                    onClick={handleMenuClose}
                    selected={pathname === "/"}
                  >
                    Speisekarte
                  </MenuItem>
                  {canAccessAdmin && (
                    <MenuItem
                      component={Link}
                      to="/admin"
                      onClick={handleMenuClose}
                      selected={pathname === "/admin"}
                    >
                      Administration
                    </MenuItem>
                  )}
                  {user ? (
                    <>
                      <MenuItem disabled>
                        {user.firstname} {user.lastname}
                      </MenuItem>
                      <MenuItem component={Link} to="/my-orders" onClick={handleMenuClose}>
                        Meine Bestellungen
                      </MenuItem>
                      {canAccessAdmin && (
                        <MenuItem onClick={() => { setPasswordDialogOpen(true); handleMenuClose(); }}>
                          Passwort ändern
                        </MenuItem>
                      )}
                      <MenuItem onClick={() => { logout(); handleMenuClose(); }}>
                        Abmelden
                      </MenuItem>
                    </>
                  ) : (
                    <MenuItem component={Link} to="/login" onClick={handleMenuClose}>
                      Anmelden
                    </MenuItem>
                  )}
                </Menu>
              </>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      <Container
        component="main"
        maxWidth="lg"
        sx={{ flexGrow: 1, py: { xs: 3, md: 4 } }}
      >
        {children}
      </Container>

      <Box
        component="footer"
        sx={{
          py: 2,
          textAlign: "center",
          color: "text.secondary",
          fontSize: "0.875rem",
        }}
      >
        © {new Date().getFullYear()} TagesTeller
      </Box>

      {user && (
        <ChangePasswordDialog
          open={passwordDialogOpen}
          onClose={() => setPasswordDialogOpen(false)}
          userId={user.id}
        />
      )}
    </Box>
  );
}
