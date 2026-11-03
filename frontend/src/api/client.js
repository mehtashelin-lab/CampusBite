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
  createMenuItem: (restaurantId, body) =>
    request(`/api/restaurants/${restaurantId}/menu`, { method: "POST", body }),
  updateMenuItem: (restaurantId, itemId, body) =>
    request(`/api/restaurants/${restaurantId}/menu/${itemId}`, { method: "PATCH", body }),
  placeOrder: (body) => request("/api/orders", { method: "POST", body }),
  myOrders: () => request("/api/orders/me"),
  cancelOrder: (orderId) => request(`/api/orders/${orderId}/cancel`, { method: "PATCH" }),
  ownerOrders: () => request("/api/owner/orders"),
  acceptOrder: (orderId) => request(`/api/owner/orders/${orderId}/accept`, { method: "PATCH" }),
  rejectOrder: (orderId) => request(`/api/owner/orders/${orderId}/reject`, { method: "PATCH" }),
};

export function formatMoney(paise = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}
