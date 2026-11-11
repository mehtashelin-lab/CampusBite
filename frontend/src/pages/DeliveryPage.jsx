import { useEffect, useMemo, useState } from "react";
import { api, formatMoney, formatOrderDate } from "../api/client.js";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";
import OrderFilters, { DELIVERY_ORDER_STATUSES, filterOrders } from "../components/OrderFilters.jsx";

function DeliveryOrder({ order, busy, onStatusChange }) {
  const nextStatus = order.status === "ASSIGNED" ? "OUT_FOR_DELIVERY" : "DELIVERED";
  const buttonLabel = order.status === "ASSIGNED" ? "Start delivery" : "Mark delivered";

  return <article className="order-card delivery-order-card">
    <div className="order-card-top">
      <div><p className="eyebrow">Order #{order.id}</p><p className="order-date">Ordered {formatOrderDate(order.created_at)}</p>{order.status === "DELIVERED" && order.delivered_at && <p className="order-delivered-date">Delivered {formatOrderDate(order.delivered_at)} by {order.delivery_partner_name || "delivery partner"}</p>}<h3>{order.restaurant_name}</h3></div>
      <span className={`status-pill status-${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span>
    </div>
    <p className="delivery-customer"><strong>Customer:</strong> {order.customer_name}</p>
    <p className="delivery-destination"><strong>Deliver to:</strong> {order.delivery_address}</p>
    <ul className="order-lines">{order.items.map((item) => <li key={item.id}><span>{item.quantity} × {item.item_name}</span><span>{formatMoney(item.unit_price_paise * item.quantity)}</span></li>)}</ul>
    {order.status !== "DELIVERED" && <div className="order-card-bottom"><strong>Total {formatMoney(order.total_paise)}</strong><button className="button button-small" disabled={busy} onClick={() => onStatusChange(order.id, nextStatus)}>{busy ? "Saving…" : buttonLabel}</button></div>}
  </article>;
}

export default function DeliveryPage() {
  const [orders, setOrders] = useState([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [orderFilters, setOrderFilters] = useState({ statuses: [], from: "", to: "" });

  async function refresh(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const [availability, assignedOrders] = await Promise.all([
        api.deliveryAvailability(),
        api.deliveryOrders(),
      ]);
      setIsAvailable(availability.is_available);
      setOrders(assignedOrders);
      setError("");
    } catch (reason) {
      setError(reason.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    refresh(true);
    const pollId = window.setInterval(() => refresh(), 15000);
    return () => window.clearInterval(pollId);
  }, []);

  async function toggleAvailability() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api.setDeliveryAvailability(!isAvailable);
      setIsAvailable(result.is_available);
      setNotice(result.is_available
        ? "You are available for new delivery assignments."
        : "You are unavailable for new assignments. You can still finish deliveries already assigned to you.");
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function updateStatus(orderId, status) {
    setBusyOrderId(orderId); setError(""); setNotice("");
    try {
      const updated = await api.updateDeliveryOrderStatus(orderId, status);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, ...updated } : order));
      setNotice(status === "DELIVERED" ? `Order #${orderId} marked delivered.` : `Order #${orderId} is out for delivery.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusyOrderId(null); }
  }

  const activeOrders = orders.filter((order) => order.status !== "DELIVERED");
  const deliveredOrders = orders.filter((order) => order.status === "DELIVERED");
  const filteredActiveOrders = useMemo(() => filterOrders(activeOrders, orderFilters), [activeOrders, orderFilters]);
  const filteredDeliveredOrders = useMemo(() => filterOrders(deliveredOrders, orderFilters), [deliveredOrders, orderFilters]);

  if (loading) return <section className="section-wrap"><Loading label="Opening your delivery workspace" /></section>;

  return <section className="section-wrap dashboard-page delivery-page">
    <div className="dashboard-welcome"><div><p className="eyebrow">Delivery partner</p><h1>Your deliveries.</h1><p className="muted">Manage your availability and keep customers updated.</p></div><button className={`button ${isAvailable ? "button-outline" : ""}`} disabled={busy} onClick={toggleAvailability}>{busy ? "Saving…" : isAvailable ? "Available for orders" : "Go available"}</button></div>
    <Notice>{error}</Notice><Notice tone="success">{notice}</Notice>
    <div className="delivery-availability-note">{isAvailable ? "New ready orders may be assigned to you automatically. Your current deliveries stay assigned if you switch off availability." : "You will not receive new assignments while unavailable."}</div>
    {orders.length > 0 && <OrderFilters value={orderFilters} onChange={setOrderFilters} statuses={DELIVERY_ORDER_STATUSES} />}
    <div className="section-heading dashboard-section-heading"><div><p className="eyebrow">On the road</p><h2>Active deliveries</h2></div><span className="count-label">{activeOrders.length} active</span></div>
    {activeOrders.length ? filteredActiveOrders.length ? <div className="order-list">{filteredActiveOrders.map((order) => <DeliveryOrder key={order.id} order={order} busy={busyOrderId === order.id} onStatusChange={updateStatus} />)}</div> : <div className="compact-empty"><h3>No matching active deliveries</h3></div> : <div className="compact-empty"><span className="empty-icon">◷</span><h3>No active deliveries</h3><p>Orders assigned to you will appear here.</p></div>}
    {deliveredOrders.length > 0 && <><div className="section-heading dashboard-section-heading delivery-history-heading"><div><p className="eyebrow">Completed</p><h2>Delivery history</h2></div><span className="count-label">{deliveredOrders.length} delivered</span></div>{filteredDeliveredOrders.length ? <div className="order-list">{filteredDeliveredOrders.map((order) => <DeliveryOrder key={order.id} order={order} busy={false} onStatusChange={updateStatus} />)}</div> : <div className="compact-empty"><h3>No matching delivered orders</h3></div>}</>}
  </section>;
}
