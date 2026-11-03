import { useEffect, useMemo, useState } from "react";
import { api, formatMoney } from "../api/client.js";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";
import OrderCard from "../components/OrderCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
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

  async function loadDashboard() {
    setLoading(true); setError("");
    try {
      const [ownedRestaurants, incomingOrders] = await Promise.all([api.myRestaurants(), api.ownerOrders()]);
      setRestaurants(ownedRestaurants); setOrders(incomingOrders);
      setSelectedId((current) => current || (ownedRestaurants[0] ? String(ownedRestaurants[0].id) : ""));
      if (ownedRestaurants.length === 0) setShowRestaurantForm(true);
    } catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadDashboard(); }, []);

  useEffect(() => {
    if (!selectedId) { setMenuItems([]); return; }
    let active = true;
    api.menu(selectedId).then((items) => active && setMenuItems(items)).catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, [selectedId, restaurants]);

  const selectedRestaurant = useMemo(() => restaurants.find((item) => item.id === Number(selectedId)), [restaurants, selectedId]);
  const restaurantNames = Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant.name]));
  const pendingCount = orders.filter((order) => order.status === "PLACED").length;

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
      setNotice(`Order #${orderId} accepted.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function rejectOrder(orderId) {
    setBusy(true); setError(""); setNotice("");
    try {
      const rejected = await api.rejectOrder(orderId);
      setOrders((current) => current.map((order) => order.id === orderId ? rejected : order));
      setNotice(`Order #${orderId} was rejected. The customer will see the updated status in their order history.`);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="section-wrap"><Loading label="Opening your dashboard" /></section>;

  return <section className="section-wrap dashboard-page owner-page">
    <div className="dashboard-welcome"><div><p className="eyebrow">Restaurant owner workspace</p><h1>Welcome, {user.full_name.split(" ")[0]}.</h1><p className="muted">Keep your menu fresh and orders moving.</p></div><button className="button button-outline" onClick={loadDashboard}>Refresh dashboard ↻</button></div>
    <div className="stats-row"><div className="stat-card"><span className="stat-icon">⌂</span><p>Your restaurants</p><strong>{restaurants.length}</strong></div><div className="stat-card stat-card-green"><span className="stat-icon">◷</span><p>Orders to accept</p><strong>{pendingCount}</strong></div><div className="stat-card stat-card-gold"><span className="stat-icon">✳</span><p>Available dishes</p><strong>{menuItems.length}</strong></div></div>
    <Notice>{error}</Notice><Notice tone="success">{notice}</Notice>

    <div className="owner-workspace">
      <div className="owner-main-column">
        <section className="panel-card"><div className="section-heading panel-heading"><div><p className="eyebrow">Your kitchen</p><h2>Restaurant and menu</h2></div><button type="button" className="button button-small button-outline" onClick={() => setShowRestaurantForm((visible) => !visible)}>{showRestaurantForm ? "Close" : "＋ Add restaurant"}</button></div>
          {restaurants.length > 1 && <label className="select-restaurant">Choose a restaurant<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>}
          {showRestaurantForm && <form className="form-stack compact-form restaurant-create-form" onSubmit={createRestaurant}><p className="muted">Create another restaurant page for your owner account.</p><label>Restaurant name<input required minLength="2" maxLength="160" value={restaurantForm.name} onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })} placeholder="e.g. Campus Cafe" /></label><label>Short description<textarea maxLength="500" value={restaurantForm.description} onChange={(e) => setRestaurantForm({ ...restaurantForm, description: e.target.value })} placeholder="What should customers know?" /></label><button className="button" disabled={busy}>{busy ? "Saving…" : "Create restaurant"}</button></form>}
          {selectedRestaurant && <div className="selected-restaurant"><div><span className="restaurant-avatar">{selectedRestaurant.name.slice(0, 1)}</span><div><h3>{selectedRestaurant.name}</h3><p>{selectedRestaurant.description || "Your CampusBite restaurant"}</p></div></div></div>}
          {selectedRestaurant && <><div className="subsection-title"><div><p className="eyebrow">Available now</p><h3>Your menu</h3></div><span className="count-label">{menuItems.length} dishes</span></div>
            {menuItems.length ? <div className="owner-menu-list">{menuItems.map((item) => <div className="owner-menu-row" key={item.id}><span className="dish-dot">✳</span>{editingItemId === item.id ? <form className="form-stack compact-form edit-dish-form" onSubmit={updateDish}><label>Dish name<input required minLength="2" maxLength="160" value={editDishForm.name} onChange={(e) => setEditDishForm({ ...editDishForm, name: e.target.value })} /></label><label>Description<textarea maxLength="500" value={editDishForm.description} onChange={(e) => setEditDishForm({ ...editDishForm, description: e.target.value })} /></label><label>Price in rupees<input type="number" min="0.01" step="0.01" required value={editDishForm.price} onChange={(e) => setEditDishForm({ ...editDishForm, price: e.target.value })} /></label><div className="inline-actions"><button className="button button-small" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button><button type="button" className="text-button" onClick={() => setEditingItemId(null)}>Cancel</button></div></form> : <><div><strong>{item.name}</strong><p>{item.description || "No description"}</p></div><div className="menu-item-actions"><strong>{formatMoney(item.price_paise)}</strong><button type="button" className="text-button" onClick={() => beginEditDish(item)}>Edit</button></div></>}</div>)}</div> : <p className="muted small-space">Your menu is empty. Add your first dish below.</p>}
            <form className="form-stack compact-form add-dish-form" onSubmit={createDish}><h3>Add a dish</h3><label>Dish name<input required minLength="2" maxLength="160" value={dishForm.name} onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })} placeholder="e.g. Veggie bowl" /></label><label>Description<textarea maxLength="500" value={dishForm.description} onChange={(e) => setDishForm({ ...dishForm, description: e.target.value })} placeholder="A short description" /></label><label>Price in rupees<input type="number" min="0.01" step="0.01" required value={dishForm.price} onChange={(e) => setDishForm({ ...dishForm, price: e.target.value })} placeholder="120" /></label><button className="button" disabled={busy}>{busy ? "Saving…" : "Add to menu"}</button></form>
          </>}
        </section>
      </div>

      <section className="panel-card owner-orders-panel"><div className="section-heading panel-heading"><div><p className="eyebrow">Incoming</p><h2>Orders</h2></div><span className="count-label">{orders.length} total</span></div>
        {orders.length ? <div className="order-list">{orders.map((order) => <OrderCard key={order.id} order={order} restaurantName={restaurantNames[order.restaurant_id]} onAccept={acceptOrder} onReject={rejectOrder} busy={busy} />)}</div> : <div className="compact-empty"><span className="empty-icon">◷</span><h3>No orders yet</h3><p>New customer orders will show up here.</p></div>}
      </section>
    </div>
  </section>;
}
