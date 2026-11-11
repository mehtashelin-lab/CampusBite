import {
  CUSTOMER_OWNER_ORDER_STATUSES,
  DELIVERY_ORDER_STATUSES,
  ORDER_STATUSES,
  filterOrders,
} from "./orderFilters.js";

export { CUSTOMER_OWNER_ORDER_STATUSES, DELIVERY_ORDER_STATUSES, ORDER_STATUSES, filterOrders };

export default function OrderFilters({ value, onChange, statuses = ORDER_STATUSES }) {
  const hasFilters = value.statuses.length > 0 || value.from || value.to;

  function toggleStatus(status) {
    const statuses = value.statuses.includes(status)
      ? value.statuses.filter((selected) => selected !== status)
      : [...value.statuses, status];
    onChange({ ...value, statuses });
  }

  return (
    <div className="order-filters" aria-label="Filter orders">
      <details className="status-filter">
        <summary>{value.statuses.length ? `Statuses (${value.statuses.length})` : "All statuses"}</summary>
        <fieldset className="status-filter-options">
          <legend>Filter by status</legend>
          {statuses.map((status) => (
            <label key={status}>
              <input type="checkbox" checked={value.statuses.includes(status)} onChange={() => toggleStatus(status)} />
              {status.replaceAll("_", " ")}
            </label>
          ))}
        </fieldset>
      </details>
      <label className="date-filter">From<input type="date" value={value.from} onChange={(event) => onChange({ ...value, from: event.target.value })} /></label>
      <label className="date-filter">To<input type="date" value={value.to} onChange={(event) => onChange({ ...value, to: event.target.value })} /></label>
      {hasFilters && <button type="button" className="text-button" onClick={() => onChange({ statuses: [], from: "", to: "" })}>Clear filters</button>}
    </div>
  );
}
