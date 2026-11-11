import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notice from "../components/Notice.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm_password: "", role: "CUSTOMER" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault(); setError("");
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await register(form);
      navigate("/login", { replace: true, state: { notice: "Account created. Log in to continue.", email: form.email } });
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return <section className="auth-page"><div className="auth-visual auth-visual-register"><p className="eyebrow">One account, good food</p><h1>Make room<br />for a new<br /><span>favourite.</span></h1><div className="auth-visual-stamp">JOIN THE<br />TABLE</div></div><div className="auth-panel"><div className="auth-panel-inner"><p className="eyebrow">Create your account</p><h2>Let’s get started.</h2><p className="muted">Choose the account type that fits you.</p><Notice>{error}</Notice><form className="form-stack" onSubmit={handleSubmit}>
    <label>Full name<input autoComplete="name" required minLength="2" maxLength="120" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Your name" /></label>
    <label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
    <label>Password<input type="password" autoComplete="new-password" required minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /></label>
    <label>Confirm password<input type="password" autoComplete="new-password" required minLength="8" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} placeholder="Re-enter your password" /></label>
    <label>Account type<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="CUSTOMER">Customer</option><option value="RESTAURANT_OWNER">Restaurant owner</option><option value="DELIVERY_PARTNER">Delivery partner</option></select></label>
    <button className="button button-wide" disabled={busy}>{busy ? "Creating account…" : "Create account"}<span aria-hidden="true">→</span></button>
  </form><p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p></div></div></section>;
}
