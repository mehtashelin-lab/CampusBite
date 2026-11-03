import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Notice from "../components/Notice.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { dashboardPath } from "../components/ProtectedRoute.jsx";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: location.state?.email || "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={dashboardPath(user.role)} replace />;

  async function handleSubmit(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const loggedInUser = await login(form);
      navigate(location.state?.from?.pathname || dashboardPath(loggedInUser.role), { replace: true });
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return <section className="auth-page"><div className="auth-visual"><p className="eyebrow">Welcome back</p><h1>Your next<br />great meal<br /><span>is waiting.</span></h1><div className="auth-visual-stamp">CAMPUS<br />BITES<br />BETTER</div></div><div className="auth-panel"><div className="auth-panel-inner"><p className="eyebrow">Sign in to CampusBite</p><h2>Good to see you.</h2><p className="muted">Log in to continue to your account.</p><Notice tone="success">{location.state?.notice}</Notice><Notice>{error}</Notice><form className="form-stack" onSubmit={handleSubmit}>
    <label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
    <label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Your password" /></label>
    <button className="button button-wide" disabled={busy}>{busy ? "Logging in…" : "Log in"}<span aria-hidden="true">→</span></button>
  </form><p className="auth-switch">New to CampusBite? <Link to="/register">Create an account</Link></p></div></div></section>;
}
