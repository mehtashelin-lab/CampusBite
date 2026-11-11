import { useEffect, useMemo, useState } from "react";
import { api, formatMoney } from "../api/client.js";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";
import OrderCard from "../components/OrderCard.jsx";
import OrderFilters, { CUSTOMER_OWNER_ORDER_STATUSES, filterOrders } from "../components/OrderFilters.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [refundRequests, setRefundRequests] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [restaurantForm, setRestaurantForm] = useState({ name: "", description: "" });
  const [showRestaurantForm, setShowRestaurantForm] = useState(false);
  const [dishForm, setDishForm] = useState({ name: "", description: "", price: "" });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editDishForm, setEditDishForm] = useState({ name: "", description: "", price: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [orderFilters, setOrderFilters] = useState({ statuses: [], from: "", to: "" });

  async function loadDashboard() {
    setLoading(true); setError("");
    try {
      const [ownedRestaurants, incomingOrders, ownerStats, activeReminders, ownerReviews, refunds] = await Promise.all([
        api.myRestaurants(), api.ownerOrders(), api.ownerStats(), api.ownerReminders(), api.ownerReviews(), api.ownerRefundRequests(),
      ]);
      setRestaurants(ownedRestaurants); setOrders(incomingOrders); setStats(ownerStats);
      setReminders(activeReminders); setReviews(ownerReviews); setRefundRequests(refunds);
      setSelectedId((current) => current || (ownedRestaurants[0] ? String(ownedRestaurants[0].id) : ""));
      setShowRestaurantForm(ownedRestaurants.length === 0);
    } catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadDashboard(); }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      api.ownerReminders().then(setReminders).catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedId) { setMenuItems([]); return; }
    let active = true;
    api.ownerMenu(selectedId).then((items) => active && setMenuItems(items)).catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, [selectedId, restaurants]);

  const selectedRestaurant = useMemo(() => restaurants.find((item) => item.id === Number(selectedId)), [restaurants, selectedId]);
  const restaurantNames = Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant.name]));
  const filteredOrders = useMemo(() => filterOrders(orders, orderFilters), [orders, orderFilters]);

  async function refreshStats() {
    setStats(await api.ownerStats());
  }

  async function createRestaurant(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const created = await api.createRestaurant(restaurantForm);
      setRestaurants((current) => [...current, created]); setSelectedId(String(created.id));
      setRestaurantForm({ name: "", description: "" }); setShowRestaurantForm(false); setNotice("Your restaurant is ready. Add a few menu items next.");
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function createDish(event) {
    event.preventDefault(); if (!selectedId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await api.createMenuItem(selectedId, {
        name: dishForm.name,
        description: dishForm.description,
        price_paise: Math.round(Number(dishForm.price) * 100),
      });
      setMenuItems((current) => [...current, created]); setDishForm({ name: "", description: "", price: "" }); setNotice(`${created.name} was added to your menu.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  function beginEditDish(item) {
    setEditingItemId(item.id);
    setEditDishForm({ name: item.name, description: item.description || "", price: String(item.price_paise / 100) });
  }

  async function updateDish(event) {
    event.preventDefault();
    if (!selectedId || !editingItemId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await api.updateMenuItem(selectedId, editingItemId, {
        name: editDishForm.name,
        description: editDishForm.description,
        price_paise: Math.round(Number(editDishForm.price) * 100),
      });
      setMenuItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingItemId(null); setNotice(`${updated.name} was updated.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function acceptOrder(orderId) {
    setBusy(true); setError(""); setNotice("");
    try {
      const accepted = await api.acceptOrder(orderId);
      setOrders((current) => current.map((order) => order.id === orderId ? accepted : order));
      await refreshStats();
      setNotice(`Order #${orderId} accepted.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function rejectOrder(orderId) {
    setBusy(true); setError(""); setNotice("");
    try {
      const rejected = await api.rejectOrder(orderId);
      setOrders((current) => current.map((order) => order.id === orderId ? rejected : order));
      await refreshStats();
      setNotice(`Order #${orderId} was rejected. The customer will see the updated status in their order history.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function updateOrderStatus(orderId, status) {
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await api.updateOwnerOrderStatus(orderId, status);
      setOrders((current) => current.map((order) => order.id === orderId ? updated : order));
      await refreshStats();
      setNotice(status === "READY"
        ? `Order #${orderId} is ready and assigned to ${updated.delivery_partner_name}.`
        : `Order #${orderId} is now being prepared.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function toggleDishAvailability(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await api.updateMenuItem(selectedId, item.id, { is_available: !item.is_available });
      setMenuItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      setNotice(`${updated.name} is now ${updated.is_available ? "available" : "unavailable"}.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function decideRefund(requestId, decision) {
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await api.decideRefund(requestId, decision);
      setRefundRequests((current) => current.map((entry) => entry.id === requestId ? updated : entry));
      if (decision === "APPROVED") setOrders((current) => current.map((order) => order.id === updated.order_id ? { ...order, status: "REFUNDED" } : order));
      await refreshStats();
      setNotice(`Refund request for order #${updated.order_id} ${decision.toLowerCase()}.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="section-wrap"><Loading label="Opening your dashboard" /></section>;

  return <section className="section-wrap dashboard-page owner-page">
    <div className="dashboard-welcome"><div><p className="eyebrow">Restaurant owner workspace</p><h1>Welcome, {user.full_name.split(" ")[0]}.</h1><p className="muted">Keep your menu fresh and orders moving.</p></div><button className="button button-outline" onClick={loadDashboard}>Refresh dashboard ↻</button></div>
    <div className="stats-row"><div className="stat-card"><span className="stat-icon">◷</span><p>Orders to accept</p><strong>{stats?.placed_orders ?? 0}</strong></div><div className="stat-card stat-card-green"><span className="stat-icon">↗</span><p>Active orders</p><strong>{stats?.active_orders ?? 0}</strong></div><div className="stat-card stat-card-gold"><span className="stat-icon">₹</span><p>Gross order total</p><strong>{formatMoney(stats?.gross_total_paise ?? 0)}</strong></div></div>
    <Notice>{error}</Notice><Notice tone="success">{notice}</Notice>

    <div className="owner-workspace">
      <div className="owner-main-column">
        <section className="panel-card"><div className="section-heading panel-heading"><div><p className="eyebrow">Your kitchen</p><h2>Restaurant and menu</h2></div>{restaurants.length === 0 && <button type="button" className="button button-small button-outline" onClick={() => setShowRestaurantForm((visible) => !visible)}>{showRestaurantForm ? "Close" : "＋ Add restaurant"}</button>}</div>
          {restaurants.length > 1 && <label className="select-restaurant">Choose a restaurant<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>}
          {showRestaurantForm && restaurants.length === 0 && <form className="form-stack compact-form restaurant-create-form" onSubmit={createRestaurant}><p className="muted">Create your restaurant page and menu.</p><label>Restaurant name<input required minLength="2" maxLength="160" value={restaurantForm.name} onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })} placeholder="e.g. Campus Cafe" /></label><label>Short description<textarea maxLength="500" value={restaurantForm.description} onChange={(e) => setRestaurantForm({ ...restaurantForm, description: e.target.value })} placeholder="What should customers know?" /></label><button className="button" disabled={busy}>{busy ? "Saving…" : "Create restaurant"}</button></form>}
          {selectedRestaurant && <div className="selected-restaurant"><div><span className="restaurant-avatar">{selectedRestaurant.name.slice(0, 1)}</span><div><h3>{selectedRestaurant.name}</h3><p>{selectedRestaurant.description || "Your CampusBite restaurant"}</p></div></div></div>}
          {selectedRestaurant && <><div className="subsection-title"><div><p className="eyebrow">Available now</p><h3>Your menu</h3></div><span className="count-label">{menuItems.length} dishes</span></div>
            {menuItems.length ? <div className="owner-menu-list">{menuItems.map((item) => <div className={`owner-menu-row ${item.is_available ? "" : "menu-item-unavailable"}`} key={item.id}><span className="dish-dot">✳</span>{editingItemId === item.id ? <form className="form-stack compact-form edit-dish-form" onSubmit={updateDish}><label>Dish name<input required minLength="2" maxLength="160" value={editDishForm.name} onChange={(e) => setEditDishForm({ ...editDishForm, name: e.target.value })} /></label><label>Description<textarea maxLength="500" value={editDishForm.description} onChange={(e) => setEditDishForm({ ...editDishForm, description: e.target.value })} /></label><label>Price in rupees<input type="number" min="0.01" step="0.01" required value={editDishForm.price} onChange={(e) => setEditDishForm({ ...editDishForm, price: e.target.value })} /></label><div className="inline-actions"><button className="button button-small" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button><button type="button" className="text-button" onClick={() => setEditingItemId(null)}>Cancel</button></div></form> : <><div><strong>{item.name}</strong><p>{item.description || "No description"} {!item.is_available && <span className="muted">· Unavailable</span>}</p></div><div className="menu-item-actions"><strong>{formatMoney(item.price_paise)}</strong><button type="button" className="text-button" onClick={() => beginEditDish(item)}>Edit</button><button type="button" className="text-button" disabled={busy} onClick={() => toggleDishAvailability(item)}>{item.is_available ? "Mark unavailable" : "Make available"}</button></div></>}</div>)}</div> : <p className="muted small-space">Your menu is empty. Add your first dish below.</p>}
            <form className="form-stack compact-form add-dish-form" onSubmit={createDish}><h3>Add a dish</h3><label>Dish name<input required minLength="2" maxLength="160" value={dishForm.name} onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })} placeholder="e.g. Veggie bowl" /></label><label>Description<textarea maxLength="500" value={dishForm.description} onChange={(e) => setDishForm({ ...dishForm, description: e.target.value })} placeholder="A short description" /></label><label>Price in rupees<input type="number" min="0.01" step="0.01" required value={dishForm.price} onChange={(e) => setDishForm({ ...dishForm, price: e.target.value })} placeholder="120" /></label><button className="button" disabled={busy}>{busy ? "Saving…" : "Add to menu"}</button></form>
          </>}
        </section>
      </div>

      <section className="panel-card owner-orders-panel"><div className="section-heading panel-heading"><div><p className="eyebrow">Incoming</p><h2>Orders</h2></div><span className="count-label">{orders.length} total</span></div>
        {reminders.length > 0 && <section className="owner-dashboard-block"><p className="eyebrow">Needs attention</p><h3>Order reminders</h3><ul className="owner-activity-list">{reminders.map((reminder) => <li key={reminder.id}><strong>Order #{reminder.order_id} · {reminder.status.replaceAll("_", " ")}</strong><span>{reminder.restaurant_name} · idle over 15 minutes</span></li>)}</ul></section>}
        {refundRequests.length > 0 && <section className="owner-dashboard-block"><p className="eyebrow">Customer requests</p><h3>Refund requests</h3><ul className="owner-activity-list">{refundRequests.map((request) => <li key={request.id}><strong>Order #{request.order_id} · {request.status}</strong><span>{request.customer_name}: {request.reason}</span>{request.status === "PENDING" && <div className="inline-actions"><button className="button button-small" disabled={busy} onClick={() => decideRefund(request.id, "APPROVED")}>Approve refund</button><button className="button button-small button-quiet" disabled={busy} onClick={() => decideRefund(request.id, "REJECTED")}>Reject</button></div>}</li>)}</ul></section>}
        {orders.length > 0 && <OrderFilters value={orderFilters} onChange={setOrderFilters} statuses={CUSTOMER_OWNER_ORDER_STATUSES} />}
        {orders.length ? filteredOrders.length ? <div className="order-list">{filteredOrders.map((order) => <OrderCard key={order.id} order={order} restaurantName={restaurantNames[order.restaurant_id]} onAccept={acceptOrder} onReject={rejectOrder} onUpdateStatus={updateOrderStatus} busy={busy} />)}</div> : <div className="compact-empty"><h3>No matching orders</h3><p>Change or clear the filters to see more orders.</p></div> : <div className="compact-empty"><span className="empty-icon">◷</span><h3>No orders yet</h3><p>New customer orders will show up here.</p></div>}
      </section>
      <section className="panel-card owner-orders-panel"><div className="section-heading panel-heading"><div><p className="eyebrow">Customer feedback</p><h2>Reviews</h2></div><span className="count-label">{reviews.length} reviews</span></div>{reviews.length ? <ul className="owner-activity-list">{reviews.map((review) => <li key={review.id}><strong>Order #{review.order_id} · {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} · {review.customer_name}</strong><span>{review.comment || "No written comment"}</span></li>)}</ul> : <p className="muted">Customer reviews for delivered orders will appear here.</p>}</section>
    </div>
  </section>;
}
