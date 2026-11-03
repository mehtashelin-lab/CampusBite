import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { dashboardPath } from "./ProtectedRoute.jsx";

export default function SiteLayout() {
  const { user, logout } = useAuth();
  const { itemCount, clearCart } = useCart();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    clearCart();
    navigate("/");
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to={user?.role === "RESTAURANT_OWNER" ? "/owner" : "/"} aria-label="CampusBite home">
            <span className="brand-mark">C</span>
            <span>campus<span className="brand-accent">bite</span></span>
          </Link>
          <nav className="main-nav" aria-label="Main navigation">
            {user?.role !== "RESTAURANT_OWNER" && <NavLink to="/">Restaurants</NavLink>}
            {user?.role === "CUSTOMER" && <NavLink to="/customer">My orders</NavLink>}
            {user?.role === "RESTAURANT_OWNER" && <NavLink to="/owner">Owner dashboard</NavLink>}
            {!user && <NavLink to="/login">Log in</NavLink>}
          </nav>
          <div className="header-actions">
            {(!user || user?.role === "CUSTOMER") && <Link className="cart-link" to="/cart">View cart <span>{itemCount}</span></Link>}
            {user ? (
              <button className="user-chip" onClick={handleLogout} title="Log out">
                <span>{user.full_name?.slice(0, 1).toUpperCase()}</span><span className="user-chip-label">Log out</span>
              </button>
            ) : <Link className="button button-small header-join" to="/register">Join us</Link>}
          </div>
        </div>
      </header>
      <main className="site-main"><Outlet /></main>
      <footer className="site-footer"><span>CampusBite</span><span>Good food, right around campus.</span></footer>
    </div>
  );
}
