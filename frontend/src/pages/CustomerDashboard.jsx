import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client.js";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";
import OrderCard from "../components/OrderCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    setError(""); setLoading(true);
    try {
      const [myOrders, allRestaurants] = await Promise.all([api.myOrders(), api.restaurants()]);
      setOrders(myOrders); setRestaurants(allRestaurants);
    } catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    refresh();
    const pollId = window.setInterval(async () => {
      try { setOrders(await api.myOrders()); setError(""); }
      catch (reason) { setError(reason.message); }
    }, 15000);
    return () => window.clearInterval(pollId);
  }, []);

  async function cancelOrder(orderId) {
    setBusyId(orderId); setError(""); setNotice("");
    try {
      const updated = await api.cancelOrder(orderId);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: updated.status } : order));
      setNotice(`Order #${orderId} was cancelled.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusyId(null); }
  }

  const restaurantNames = Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant.name]));
  const activeCount = orders.filter((order) => !["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"].includes(order.status)).length;

  return <section className="section-wrap dashboard-page">
    <div className="dashboard-welcome"><div><p className="eyebrow">Your CampusBite</p><h1>Hello, {user.full_name.split(" ")[0]}.</h1><p className="muted">Your orders, all in one place.</p></div><Link className="button" to="/">Find a meal <span aria-hidden="true">→</span></Link></div>
    <div className="stats-row"><div className="stat-card"><span className="stat-icon">↗</span><p>All orders</p><strong>{orders.length}</strong></div><div className="stat-card stat-card-green"><span className="stat-icon">◷</span><p>In progress</p><strong>{activeCount}</strong></div></div>
    <div className="section-heading dashboard-section-heading"><div><p className="eyebrow">Order history</p><h2>Your recent orders</h2></div><button className="text-button" onClick={refresh}>Refresh list ↻</button></div>
    <Notice>{error}</Notice><Notice tone="success">{notice}</Notice>
    {loading ? <Loading label="Loading your orders" /> : orders.length ? <div className="order-list">{orders.map((order) => <OrderCard key={order.id} order={order} restaurantName={restaurantNames[order.restaurant_id]} onCancel={cancelOrder} busy={busyId === order.id} />)}</div> : <div className="empty-state"><span className="empty-icon">↗</span><h3>No orders yet</h3><p>Your next favourite meal is a few clicks away.</p><Link className="button" to="/">Explore restaurants</Link></div>}
  </section>;
}
