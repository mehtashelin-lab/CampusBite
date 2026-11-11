import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatMoney } from "../api/client.js";
import Notice from "../components/Notice.jsx";
import { useCart } from "../context/CartContext.jsx";

export default function CartPage() {
  const { restaurant, items, totalPaise, setQuantity, removeItem, clearCart } = useCart();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [addressesBusy, setAddressesBusy] = useState(false);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("new");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.customerAddresses()
      .then((addresses) => {
        setSavedAddresses(addresses);
        if (addresses.length) {
          setSelectedAddressId(String(addresses[0].id));
          setDeliveryAddress(addresses[0].address);
        }
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setAddressesLoading(false));
  }, []);

  function chooseAddress(addressId) {
    setSelectedAddressId(addressId);
    const address = savedAddresses.find((item) => String(item.id) === addressId);
    setDeliveryAddress(address?.address || "");
  }

  async function saveAddress() {
    setError(""); setAddressesBusy(true);
    try {
      const address = await api.addCustomerAddress(deliveryAddress.trim());
      setSavedAddresses((current) => [address, ...current.filter((item) => item.id !== address.id)]);
      setSelectedAddressId(String(address.id));
      setDeliveryAddress(address.address);
    } catch (reason) { setError(reason.message); }
    finally { setAddressesBusy(false); }
  }

  async function removeSelectedAddress() {
    const addressId = Number(selectedAddressId);
    setError(""); setAddressesBusy(true);
    try {
      await api.deleteCustomerAddress(addressId);
      const remaining = savedAddresses.filter((address) => address.id !== addressId);
      setSavedAddresses(remaining);
      if (remaining.length) {
        setSelectedAddressId(String(remaining[0].id));
        setDeliveryAddress(remaining[0].address);
      } else {
        setSelectedAddressId("new");
        setDeliveryAddress("");
      }
    } catch (reason) { setError(reason.message); }
    finally { setAddressesBusy(false); }
  }

  async function checkout() {
    setError(""); setBusy(true);
    try {
      const order = await api.placeOrder({
        restaurant_id: restaurant.id,
        delivery_address: deliveryAddress.trim(),
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
      <aside className="checkout-card"><p className="eyebrow">Order summary</p><h2>Ready when you are.</h2>
        <div className="saved-address-heading"><strong>Saved addresses</strong><span>{savedAddresses.length} of 5</span></div>
        <label className="delivery-address-field">Choose an address<select value={selectedAddressId} disabled={addressesLoading || addressesBusy} onChange={(event) => chooseAddress(event.target.value)}><option value="new">＋ Add a new address</option>{savedAddresses.map((address) => <option key={address.id} value={address.id}>{address.address}</option>)}</select></label>
        <label className="delivery-address-field">Delivery address<textarea required minLength="5" maxLength="500" readOnly={selectedAddressId !== "new"} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Building, street, area, and any directions for your delivery partner" /></label>
        {selectedAddressId === "new" ? <div className="saved-address-actions"><button type="button" className="text-button" disabled={addressesBusy || addressesLoading || deliveryAddress.trim().length < 5 || savedAddresses.length >= 5} onClick={saveAddress}>{addressesBusy ? "Saving…" : "Save this address"}</button>{savedAddresses.length >= 5 && <span className="checkout-note">Remove a saved address before adding another.</span>}</div> : <button type="button" className="text-button saved-address-remove" disabled={addressesBusy} onClick={removeSelectedAddress}>Remove selected saved address</button>}
        <div className="summary-row"><span>Items ({items.reduce((sum, item) => sum + item.quantity, 0)})</span><span>{formatMoney(totalPaise)}</span></div><div className="summary-row"><span>Payment</span><span className="mock-paid">Mock payment</span></div><div className="summary-total"><span>Total</span><strong>{formatMoney(totalPaise)}</strong></div><p className="checkout-note">This project uses a dummy payment. No real payment will be taken.</p><button className="button button-wide" disabled={busy || addressesBusy || addressesLoading || selectedAddressId === "new" || deliveryAddress.trim().length < 5} onClick={checkout}>{busy ? "Placing your order…" : "Place order"}<span aria-hidden="true">→</span></button></aside>
    </div>}
  </section>;
}
