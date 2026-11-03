import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import SiteLayout from "./components/SiteLayout.jsx";
import ProtectedRoute, { dashboardPath } from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import CartPage from "./pages/CartPage.jsx";
import CustomerDashboard from "./pages/CustomerDashboard.jsx";
import DeliveryPage from "./pages/DeliveryPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import OwnerDashboard from "./pages/OwnerDashboard.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import RestaurantsPage from "./pages/RestaurantsPage.jsx";

function DashboardRedirect() {
  const { user } = useAuth();
  return <Navigate to={dashboardPath(user?.role)} replace />;
}

function CustomerFacingArea() {
  const { user } = useAuth();
  return user?.role === "RESTAURANT_OWNER" ? <Navigate to="/owner" replace /> : <Outlet />;
}

function RouteFallback() {
  const { user } = useAuth();
  return user?.role === "RESTAURANT_OWNER" ? <Navigate to="/owner" replace /> : <NotFoundPage />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route element={<CustomerFacingArea />}>
          <Route path="/" element={<RestaurantsPage />} />
          <Route path="/restaurants/:restaurantId" element={<MenuPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute allowedRoles={["CUSTOMER"]} />}>
            <Route path="/cart" element={<CartPage />} />
            <Route path="/customer" element={<CustomerDashboard />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardRedirect />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["RESTAURANT_OWNER"]} />}>
          <Route path="/owner" element={<OwnerDashboard />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["DELIVERY_PARTNER"]} />}>
          <Route path="/delivery" element={<DeliveryPage />} />
        </Route>
        <Route path="*" element={<RouteFallback />} />
      </Route>
    </Routes>
  );
}
