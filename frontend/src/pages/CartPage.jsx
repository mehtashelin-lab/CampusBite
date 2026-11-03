import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatMoney } from "../api/client.js";
import Notice from "../components/Notice.jsx";
import { useCart } from "../context/CartContext.jsx";

export default function CartPage() {
  const { restaurant, items, totalPaise, setQuantity, removeItem, clearCart } = useCart();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function checkout() {
    setError(""); setBusy(true);
    try {
      const order = await api.placeOrder({
        restaurant_id: restaurant.id,
        items: items.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })),
      });
      clearCart();
      navigate("/customer", { state: { notice: `Order #${order.id} placed successfully.` } });
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return <section className="section-wrap cart-page">
    <Link className="back-link" to={restaurant ? `/restaurants/${restaurant.id}` : "/"}>← Continue browsing</Link>
    <div className="page-title-row"><div><p className="eyebrow">Almost there</p><h1>Your cart</h1></div>{items.length > 0 && <button className="text-button" onClick={clearCart}>Clear cart</button>}</div>
    <Notice>{error}</Notice>
    {!items.length ? <div className="empty-state"><span className="empty-icon">＋</span><h3>Your cart is taking a break</h3><p>Find a restaurant and add something delicious.</p><Link className="button" to="/">Browse restaurants</Link></div> : <div className="cart-layout">
      <div className="cart-items-panel"><div className="cart-restaurant"><span className="restaurant-avatar">{restaurant.name.slice(0, 1)}</span><div><p className="eyebrow">Ordering from</p><strong>{restaurant.name}</strong></div></div>
        {items.map((item) => <article className="cart-line" key={item.id}><div className="cart-line-art" aria-hidden="true">✳</div><div className="cart-line-copy"><h3>{item.name}</h3><p>{formatMoney(item.price_paise)} each</p></div><div className="quantity-control"><button aria-label={`Decrease ${item.name}`} onClick={() => setQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button aria-label={`Increase ${item.name}`} onClick={() => setQuantity(item.id, item.quantity + 1)}>+</button></div><strong className="cart-line-total">{formatMoney(item.price_paise * item.quantity)}</strong><button className="remove-button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}>×</button></article>)}
      </div>
      <aside className="checkout-card"><p className="eyebrow">Order summary</p><h2>Ready when you are.</h2><div className="summary-row"><span>Items ({items.reduce((sum, item) => sum + item.quantity, 0)})</span><span>{formatMoney(totalPaise)}</span></div><div className="summary-row"><span>Payment</span><span className="mock-paid">Mock payment</span></div><div className="summary-total"><span>Total</span><strong>{formatMoney(totalPaise)}</strong></div><p className="checkout-note">This project uses a dummy payment. No real payment will be taken.</p><button className="button button-wide" disabled={busy} onClick={checkout}>{busy ? "Placing your order…" : "Place order"}<span aria-hidden="true">→</span></button></aside>
    </div>}
  </section>;
}
