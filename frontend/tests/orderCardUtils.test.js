import assert from "node:assert/strict";
import test from "node:test";
import { hasDeliveryDetails } from "../src/components/orderCardUtils.js";

test("refunded orders keep their delivery summary when delivery time is recorded", () => {
  assert.equal(hasDeliveryDetails({ status: "REFUNDED", delivered_at: "2026-11-11T10:00:00Z" }), true);
});

test("orders without a recorded delivery time omit the delivery summary", () => {
  assert.equal(hasDeliveryDetails({ status: "DELIVERED", delivered_at: null }), false);
});
