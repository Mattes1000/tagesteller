import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginByPassword } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  Container,
} from "@mui/material";
import { Restaurant } from "@mui/icons-material";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Bitte Benutzername und Passwort eingeben.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const user = await loginByPassword(username.trim(), password);
      if (user) {
        login(user);
        navigate("/", { replace: true });
      } else {
        setError("Benutzername oder Passwort ungültig.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Card elevation={3}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Restaurant sx={{ fontSize: 64, color: "primary.main", mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                TagesTeller
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Bitte anmelden
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <TextField
                fullWidth
                label="Benutzername"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="z.B. admin"
              />

              <TextField
                fullWidth
                label="Passwort"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />

              {error && <Alert severity="error">{error}</Alert>}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ py: 1.5 }}
              >
                {loading ? "Anmelden…" : "Anmelden"}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Alternativ per QR-Code anmelden
              </Typography>
              <Button
                component={Link}
                to="/"
                size="small"
                sx={{ textTransform: "none" }}
              >
                Zurück zur Speisekarte
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
