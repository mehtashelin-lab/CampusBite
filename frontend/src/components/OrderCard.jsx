import { formatMoney } from "../api/client.js";

export default function OrderCard({ order, restaurantName, onCancel, onAccept, onReject, busy = false }) {
  return (
    <article className="order-card">
      <div className="order-card-top">
        <div>
          <p className="eyebrow">Order #{order.id}</p>
          <h3>{restaurantName || `Restaurant #${order.restaurant_id}`}</h3>
        </div>
        <span className={`status-pill status-${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span>
      </div>
      <ul className="order-lines">
        {order.items?.map((item) => (
          <li key={item.id || `${order.id}-${item.menu_item_id}`}>
            <span>{item.quantity} × {item.item_name}</span>
            <span>{formatMoney(item.unit_price_paise * item.quantity)}</span>
          </li>
        ))}
      </ul>
      {order.status === "REJECTED" && <p className="order-status-message">The restaurant rejected this order. Please choose another restaurant for your next order.</p>}
      <div className="order-card-bottom">
        <strong>Total {formatMoney(order.total_paise)}</strong>
        {order.status === "PLACED" && onCancel && (
          <button className="button button-small button-quiet" disabled={busy} onClick={() => onCancel(order.id)}>Cancel order</button>
        )}
        {order.status === "PLACED" && onAccept && (
          <div className="order-owner-actions"><button className="button button-small" disabled={busy} onClick={() => onAccept(order.id)}>Accept order</button><button className="button button-small button-reject" disabled={busy} onClick={() => onReject?.(order.id)}>Reject</button></div>
        )}
      </div>
    </article>
  );
}
