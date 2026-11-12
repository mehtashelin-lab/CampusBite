import test from "node:test";
import assert from "node:assert/strict";
import {
  averageRestaurantRating,
  calculateOwnerGrossTotal,
  sortOrdersNewestFirst,
  splitOwnerOrders,
  visibleOrderBatch,
} from "../src/components/dashboardOrderUtils.js";

const now = new Date("2026-11-13T12:00:00");

test("orders sort newest first and reveal in batches", () => {
  const orders = [
    { id: 1, created_at: "2026-11-01T12:00:00Z" },
    { id: 2, created_at: "2026-11-03T12:00:00Z" },
    { id: 3, created_at: "2026-11-02T12:00:00Z" },
  ];
  const sorted = sortOrdersNewestFirst(orders);
  assert.deepEqual(sorted.map(({ id }) => id), [2, 3, 1]);
  assert.deepEqual(visibleOrderBatch(sorted, 2).map(({ id }) => id), [2, 3]);
});

test("owner cancellations expire at one hour and archived statuses stay separate", () => {
  const timestamp = now.getTime();
  const orders = [
    { id: 1, status: "CANCELLED", cancelled_at: new Date(timestamp - 59 * 60_000 - 59_000).toISOString() },
    { id: 2, status: "CANCELLED", cancelled_at: new Date(timestamp - 60 * 60_000).toISOString() },
    { id: 3, status: "CANCELLED" },
    { id: 4, status: "DELIVERED" },
    { id: 5, status: "PLACED" },
  ];
  const result = splitOwnerOrders(orders, timestamp);
  assert.deepEqual(result.current.map(({ id }) => id), [1, 5]);
  assert.deepEqual(result.past.map(({ id }) => id), [4]);
});

test("gross total uses current month or inclusive dates and ignores status filters", () => {
  const orders = [
    { status: "PLACED", created_at: "2026-11-01T12:00:00Z", total_paise: 100 },
    { status: "DELIVERED", created_at: "2026-10-31T12:00:00Z", total_paise: 200 },
    { status: "CANCELLED", created_at: "2026-11-02T12:00:00Z", total_paise: 300 },
    { status: "REJECTED", created_at: "2026-11-03T12:00:00Z", total_paise: 400 },
    { status: "REFUNDED", created_at: "2026-11-04T12:00:00Z", total_paise: 500 },
    { status: "PREPARING", created_at: "2026-11-30T12:00:00Z", total_paise: 600 },
  ];
  assert.equal(calculateOwnerGrossTotal(orders, { statuses: ["CANCELLED"], from: "", to: "" }, now), 700);
  assert.equal(calculateOwnerGrossTotal(orders, { statuses: ["REJECTED"], from: "2026-11-01", to: "2026-11-04" }, now), 100);
});

test("restaurant rating averages all reviews and represents no reviews", () => {
  assert.equal(averageRestaurantRating([{ rating: 5 }, { rating: 3 }, { rating: 4 }]), 4);
  assert.equal(averageRestaurantRating([]), null);
});
