import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import MenuPage from "./pages/MenuPage";
import AdminPage from "./pages/AdminPage";
import QrLoginPage from "./pages/QrLoginPage";
import LoginPage from "./pages/LoginPage";
import UserOrdersPage from "./pages/UserOrdersPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/:token" element={<QrLoginPage />} />
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<MenuPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/my-orders" element={<UserOrdersPage />} />
                  <Route path="/orders/user/:userId" element={<UserOrdersPage />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
