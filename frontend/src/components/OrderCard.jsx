import { useState } from "react";
import { formatMoney, formatOrderDate } from "../api/client.js";
import { hasDeliveryDetails } from "./orderCardUtils.js";

export default function OrderCard({ order, restaurantName, onCancel, onAccept, onReject, onUpdateStatus, onReview, onRefund, review, refundRequest, busy = false }) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [refundReason, setRefundReason] = useState("");
  return (
    <article className="order-card">
      <div className="order-card-top">
        <div>
          <p className="eyebrow">Order #{order.id}</p>
          <p className="order-date">Ordered {formatOrderDate(order.created_at)}</p>
          {hasDeliveryDetails(order) && <p className="order-delivered-date">Delivered {formatOrderDate(order.delivered_at)} by {order.delivery_partner_name || "delivery partner"}</p>}
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
      {order.delivery_address && <p className="order-delivery-address"><strong>Delivery address:</strong> {order.delivery_address}</p>}
      {order.delivery_partner_name && <p className="order-assignment">Assigned to {order.delivery_partner_name}</p>}
      {order.status === "REJECTED" && <p className="order-status-message">The restaurant rejected this order. Please choose another restaurant for your next order.</p>}
      <div className="order-card-bottom">
        <strong>Total {formatMoney(order.total_paise)}</strong>
        {order.status === "PLACED" && onCancel && (
          <button className="button button-small button-quiet" disabled={busy} onClick={() => onCancel(order.id)}>Cancel order</button>
        )}
        {order.status === "PLACED" && onAccept && (
          <div className="order-owner-actions"><button className="button button-small" disabled={busy} onClick={() => onAccept(order.id)}>Accept order</button><button className="button button-small button-reject" disabled={busy} onClick={() => onReject?.(order.id)}>Reject</button></div>
        )}
        {order.status === "ACCEPTED" && onUpdateStatus && <button className="button button-small" disabled={busy} onClick={() => onUpdateStatus(order.id, "PREPARING")}>Start preparing</button>}
        {order.status === "PREPARING" && onUpdateStatus && <button className="button button-small" disabled={busy} onClick={() => onUpdateStatus(order.id, "READY")}>Mark ready and assign</button>}
      </div>
      {order.status === "DELIVERED" && onReview && <section className="order-customer-actions">
        {review ? <p><strong>Your review:</strong> {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}{review.comment ? ` · ${review.comment}` : ""}</p> : showReviewForm ? <form className="form-stack compact-form" onSubmit={async (event) => { event.preventDefault(); if (await onReview(order.id, Number(rating), comment)) setShowReviewForm(false); }}><label>Rating<select value={rating} onChange={(event) => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value > 1 ? "s" : ""}</option>)}</select></label><label>Comment (optional)<textarea maxLength="1000" value={comment} onChange={(event) => setComment(event.target.value)} /></label><div className="inline-actions"><button className="button button-small" disabled={busy}>Submit review</button><button type="button" className="text-button" onClick={() => setShowReviewForm(false)}>Cancel</button></div></form> : <button type="button" className="text-button" onClick={() => setShowReviewForm(true)}>Write a review</button>}
        {refundRequest ? <p><strong>Refund request:</strong> {refundRequest.status.toLowerCase()} · {refundRequest.reason}</p> : showRefundForm ? <form className="form-stack compact-form" onSubmit={async (event) => { event.preventDefault(); if (await onRefund(order.id, refundReason)) setShowRefundForm(false); }}><label>Reason for refund<textarea required minLength="3" maxLength="1000" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} /></label><div className="inline-actions"><button className="button button-small" disabled={busy || refundReason.trim().length < 3}>Request refund</button><button type="button" className="text-button" onClick={() => setShowRefundForm(false)}>Cancel</button></div></form> : <button type="button" className="text-button" onClick={() => setShowRefundForm(true)}>Request a refund</button>}
      </section>}
    </article>
  );
}
