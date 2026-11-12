import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client.js";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";
import OrderCard from "../components/OrderCard.jsx";
import OrderFilters, { CUSTOMER_OWNER_ORDER_STATUSES, filterOrders } from "../components/OrderFilters.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [refundRequests, setRefundRequests] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [busyId, setBusyId] = useState(null);
  const [orderFilters, setOrderFilters] = useState({ statuses: [], from: "", to: "" });
  const [insightQuestion, setInsightQuestion] = useState("");
  const [insightAnswer, setInsightAnswer] = useState("");
  const [insightError, setInsightError] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);

  async function refresh() {
    setError(""); setLoading(true);
    try {
      const [myOrders, allRestaurants, myReviews, myRefundRequests] = await Promise.all([
        api.myOrders(), api.restaurants(), api.myReviews(), api.myRefundRequests(),
      ]);
      setOrders(myOrders); setRestaurants(allRestaurants); setReviews(myReviews); setRefundRequests(myRefundRequests);
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

  async function submitReview(orderId, rating, comment) {
    setError(""); setNotice("");
    try {
      const review = await api.createReview(orderId, { rating, comment });
      setReviews((current) => [review, ...current.filter((item) => item.order_id !== orderId)]);
      setNotice(`Thanks for reviewing order #${orderId}.`);
      return true;
    } catch (reason) { setError(reason.message); return false; }
  }

  async function requestRefund(orderId, reasonText) {
    setError(""); setNotice("");
    try {
      const request = await api.requestRefund(orderId, reasonText);
      setRefundRequests((current) => [request, ...current.filter((item) => item.order_id !== orderId)]);
      setNotice(`Refund request for order #${orderId} sent to the restaurant.`);
      return true;
    } catch (reason) { setError(reason.message); return false; }
  }

  async function askAboutOrders(event) {
    event.preventDefault();
    const question = insightQuestion.trim();
    if (question.length < 3 || insightLoading) return;
    setInsightError(""); setInsightAnswer(""); setInsightLoading(true);
    try {
      const result = await api.askOrderInsight(question);
      setInsightAnswer(result.answer);
    } catch (reason) {
      setInsightError(reason.message);
    } finally {
      setInsightLoading(false);
    }
  }

  const restaurantNames = Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant.name]));
  const activeCount = orders.filter((order) => !["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"].includes(order.status)).length;
  const filteredOrders = useMemo(() => filterOrders(orders, orderFilters), [orders, orderFilters]);

  return <section className="section-wrap dashboard-page">
    <div className="dashboard-welcome"><div><p className="eyebrow">Your CampusBite</p><h1>Hello, {user.full_name.split(" ")[0]}.</h1><p className="muted">Your orders, all in one place.</p></div><Link className="button" to="/">Find a meal <span aria-hidden="true">→</span></Link></div>
    <div className="stats-row"><div className="stat-card"><span className="stat-icon">↗</span><p>All orders</p><strong>{orders.length}</strong></div><div className="stat-card stat-card-green"><span className="stat-icon">◷</span><p>In progress</p><strong>{activeCount}</strong></div></div>
    <section className="insight-card" aria-labelledby="order-insights-title">
      <div className="section-heading dashboard-section-heading"><div><p className="eyebrow">Your order history</p><h2 id="order-insights-title">Ask CampusBite</h2></div></div>
      <p className="muted insight-description">Ask about your 20 most recent orders. Your delivery address is not shared.</p>
      <form className="insight-form" onSubmit={askAboutOrders}>
        <label htmlFor="order-insight-question">Your question</label>
        <textarea id="order-insight-question" rows="3" minLength="3" maxLength="500" required value={insightQuestion} onChange={(event) => setInsightQuestion(event.target.value)} placeholder="What have I ordered most often?" />
        <button className="button button-small" disabled={insightLoading || insightQuestion.trim().length < 3}>
          {insightLoading ? "Thinking…" : "Ask about my orders"}
        </button>
      </form>
      <Notice>{insightError}</Notice>
      {insightAnswer && <div className="insight-answer" role="status"><p className="eyebrow">Answer</p><p>{insightAnswer}</p></div>}
    </section>
    <div className="section-heading dashboard-section-heading"><div><p className="eyebrow">Order history</p><h2>Your recent orders</h2></div><button className="text-button" onClick={refresh}>Refresh list ↻</button></div>
    <Notice>{error}</Notice><Notice tone="success">{notice}</Notice>
    {!loading && orders.length > 0 && <OrderFilters value={orderFilters} onChange={setOrderFilters} statuses={CUSTOMER_OWNER_ORDER_STATUSES} />}
    {loading ? <Loading label="Loading your orders" /> : orders.length ? filteredOrders.length ? <div className="order-list">{filteredOrders.map((order) => <OrderCard key={order.id} order={order} restaurantName={restaurantNames[order.restaurant_id]} onCancel={cancelOrder} onReview={submitReview} onRefund={requestRefund} review={reviews.find((item) => item.order_id === order.id)} refundRequest={refundRequests.find((item) => item.order_id === order.id)} busy={busyId === order.id} />)}</div> : <div className="compact-empty"><h3>No matching orders</h3><p>Change or clear the filters to see more orders.</p></div> : <div className="empty-state"><span className="empty-icon">↗</span><h3>No orders yet</h3><p>Your next favourite meal is a few clicks away.</p><Link className="button" to="/">Explore restaurants</Link></div>}
  </section>;
}
