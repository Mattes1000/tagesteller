import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loginByQr } from "../api";
import { useAuth } from "../context/AuthContext";
import { Box, Card, CardContent, Typography, CircularProgress, Container } from "@mui/material";
import { Error as ErrorIcon } from "@mui/icons-material";

export default function QrLoginPage() {
  const { token } = useParams<{ token: string }>();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) { setError(true); return; }
    loginByQr(token).then((result) => {
      if (result && result.token) {
        const { token: jwtToken, ...user } = result;
        login(user, jwtToken);
        navigate("/", { replace: true });
      } else {
        setError(true);
      }
    });
  }, [token]);

  if (error) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <Container maxWidth="xs">
          <Card elevation={3}>
            <CardContent sx={{ p: 4, textAlign: "center" }}>
              <ErrorIcon sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                Ungültiger QR-Code
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dieser QR-Code wurde nicht gefunden.
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Container maxWidth="xs">
        <Card elevation={3}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <CircularProgress size={64} sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Anmeldung läuft…
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
