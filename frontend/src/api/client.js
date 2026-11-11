const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const AUTH_STORAGE_KEY = "campusbite_auth";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
  let token = null;
  try {
    token = savedAuth ? JSON.parse(savedAuth)?.access_token : null;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  const headers = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Cannot reach the CampusBite API. Make sure the backend is running.", 0);
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    const message = Array.isArray(detail)
      ? detail.map((entry) => `${entry.loc?.at(-1) || "Field"}: ${entry.msg}`).join(" ")
      : detail || `The request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return payload;
}

export const api = {
  health: () => request("/health"),
  register: (body) => request("/api/auth/register", { method: "POST", body }),
  login: (body) => request("/api/auth/login", { method: "POST", body }),
  restaurants: () => request("/api/restaurants"),
  myRestaurants: () => request("/api/restaurants/mine"),
  createRestaurant: (body) => request("/api/restaurants", { method: "POST", body }),
  menu: (restaurantId) => request(`/api/restaurants/${restaurantId}/menu`),
  ownerMenu: (restaurantId) => request(`/api/restaurants/${restaurantId}/menu/manage`),
  createMenuItem: (restaurantId, body) =>
    request(`/api/restaurants/${restaurantId}/menu`, { method: "POST", body }),
  updateMenuItem: (restaurantId, itemId, body) =>
    request(`/api/restaurants/${restaurantId}/menu/${itemId}`, { method: "PATCH", body }),
  placeOrder: (body) => request("/api/orders", { method: "POST", body }),
  customerAddresses: () => request("/api/orders/addresses"),
  addCustomerAddress: (address) => request("/api/orders/addresses", { method: "POST", body: { address } }),
  deleteCustomerAddress: (addressId) => request(`/api/orders/addresses/${addressId}`, { method: "DELETE" }),
  myOrders: () => request("/api/orders/me"),
  myReviews: () => request("/api/orders/reviews/me"),
  createReview: (orderId, body) => request(`/api/orders/${orderId}/review`, { method: "POST", body }),
  myRefundRequests: () => request("/api/orders/refund-requests/me"),
  requestRefund: (orderId, reason) => request(`/api/orders/${orderId}/refund-request`, { method: "POST", body: { reason } }),
  cancelOrder: (orderId) => request(`/api/orders/${orderId}/cancel`, { method: "PATCH" }),
  ownerOrders: () => request("/api/owner/orders"),
  ownerStats: () => request("/api/owner/stats"),
  ownerReminders: () => request("/api/owner/reminders"),
  ownerReviews: () => request("/api/owner/reviews"),
  ownerRefundRequests: () => request("/api/owner/refund-requests"),
  decideRefund: (requestId, decision) => request(`/api/owner/refund-requests/${requestId}`, { method: "PATCH", body: { decision } }),
  acceptOrder: (orderId) => request(`/api/owner/orders/${orderId}/accept`, { method: "PATCH" }),
  rejectOrder: (orderId) => request(`/api/owner/orders/${orderId}/reject`, { method: "PATCH" }),
  updateOwnerOrderStatus: (orderId, status) =>
    request(`/api/owner/orders/${orderId}/status`, { method: "PATCH", body: { status } }),
  deliveryAvailability: () => request("/api/delivery/availability"),
  setDeliveryAvailability: (is_available) =>
    request("/api/delivery/availability", { method: "PATCH", body: { is_available } }),
  deliveryOrders: () => request("/api/delivery/orders"),
  updateDeliveryOrderStatus: (orderId, status) =>
    request(`/api/delivery/orders/${orderId}/status`, { method: "PATCH", body: { status } }),
};

export function formatMoney(paise = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatOrderDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}
