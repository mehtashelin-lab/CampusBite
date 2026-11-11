import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_OWNER_ORDER_STATUSES,
  DELIVERY_ORDER_STATUSES,
  filterOrders,
} from "../src/components/orderFilters.js";

const orders = [
  { id: 1, status: "PLACED", created_at: "2026-11-10T12:00:00Z" },
  { id: 2, status: "DELIVERED", created_at: "2026-11-11T12:00:00Z" },
  { id: 3, status: "CANCELLED", created_at: "2026-11-12T12:00:00Z" },
];

test("status and inclusive date filters can be combined", () => {
  const result = filterOrders(orders, {
    statuses: ["PLACED", "DELIVERED"],
    from: "2026-11-10",
    to: "2026-11-11",
  });
  assert.deepEqual(result.map((order) => order.id), [1, 2]);
});

test("empty filters return all orders", () => {
  assert.deepEqual(filterOrders(orders, { statuses: [], from: "", to: "" }), orders);
});

test("date filters exclude orders without a usable timestamp", () => {
  const result = filterOrders([{ id: 4, status: "PLACED" }], {
    statuses: [],
    from: "2026-11-10",
    to: "",
  });
  assert.deepEqual(result, []);
});

test("status choices are scoped to each dashboard role", () => {
  assert.equal(CUSTOMER_OWNER_ORDER_STATUSES.includes("READY"), false);
  assert.deepEqual(DELIVERY_ORDER_STATUSES, ["ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"]);
});
