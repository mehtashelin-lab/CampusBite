export function hasDeliveryDetails(order) {
  return Boolean(order?.delivered_at);
}
