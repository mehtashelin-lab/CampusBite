import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function dashboardPath(role) {
  if (role === "RESTAURANT_OWNER") return "/owner";
  if (role === "DELIVERY_PARTNER") return "/delivery";
  return "/customer";
}

export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={dashboardPath(user?.role)} replace />;
  }
  return <Outlet />;
}
