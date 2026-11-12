const ONE_HOUR_MS = 60 * 60 * 1000;
const OWNER_ARCHIVE_STATUSES = new Set(["DELIVERED", "REJECTED", "REFUNDED"]);
const OWNER_EXCLUDED_GROSS_STATUSES = new Set(["CANCELLED", "REJECTED", "REFUNDED"]);

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sortOrdersNewestFirst(orders) {
  return [...orders].sort((left, right) => {
    const leftDate = Date.parse(left.created_at || "") || 0;
    const rightDate = Date.parse(right.created_at || "") || 0;
    return rightDate - leftDate || right.id - left.id;
  });
}

export function visibleOrderBatch(orders, count) {
  return orders.slice(0, count);
}

export function splitOwnerOrders(orders, now = Date.now()) {
  const current = [];
  const past = [];
  for (const order of orders) {
    if (order.status === "CANCELLED") {
      const cancelledAt = Date.parse(order.cancelled_at || "");
      if (Number.isFinite(cancelledAt) && now - cancelledAt < ONE_HOUR_MS) current.push(order);
    } else if (OWNER_ARCHIVE_STATUSES.has(order.status)) {
      past.push(order);
    } else {
      current.push(order);
    }
  }
  return { current, past };
}

export function calculateOwnerGrossTotal(orders, dateRange, now = new Date()) {
  const from = dateRange.from || "";
  const to = dateRange.to || "";
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return orders.reduce((total, order) => {
    if (OWNER_EXCLUDED_GROSS_STATUSES.has(order.status)) return total;
    const date = new Date(order.created_at);
    if (Number.isNaN(date.getTime())) return total;
    const day = localDateKey(date);
    if (from || to) {
      if (from && day < from) return total;
      if (to && day > to) return total;
    } else if (day.slice(0, 7) !== currentMonth) {
      return total;
    }
    return total + order.total_paise;
  }, 0);
}

export function averageRestaurantRating(reviews) {
  if (!reviews.length) return null;
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
}
