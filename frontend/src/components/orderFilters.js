export const ORDER_STATUSES = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
  "REFUNDED",
];

export const CUSTOMER_OWNER_ORDER_STATUSES = ORDER_STATUSES.filter((status) => status !== "READY");
export const DELIVERY_ORDER_STATUSES = ["ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"];

function orderDate(order) {
  if (!order.created_at) return "";
  const date = new Date(order.created_at);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function filterOrders(orders, filters) {
  return orders.filter((order) => {
    if (filters.statuses.length && !filters.statuses.includes(order.status)) return false;
    const date = orderDate(order);
    if (filters.from && (!date || date < filters.from)) return false;
    if (filters.to && (!date || date > filters.to)) return false;
    return true;
  });
}
