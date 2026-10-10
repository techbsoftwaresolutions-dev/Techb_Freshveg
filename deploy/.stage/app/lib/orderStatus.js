// How an order's status reads in the order list. The backend has about twenty
// statuses (picking, packing, assigned to a rider…); a shopper only needs the
// stage, so they are folded into a handful of labels. `tone` picks the colour.

const GROUPS = [
  { label: "Delivered", tone: "ok", statuses: ["DELIVERED"] },
  { label: "Cancelled", tone: "danger", statuses: ["CANCELLED"] },
  { label: "Rejected", tone: "danger", statuses: ["REJECTED"] },
  { label: "Refunded", tone: "danger", statuses: ["REFUNDED"] },
  { label: "Pending", tone: "warn", statuses: ["ORDER_PLACED", "PAYMENT_PENDING"] },
  {
    label: "Processing",
    tone: "brand",
    statuses: ["ORDER_CONFIRMED", "ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP"],
  },
  {
    label: "Out for delivery",
    tone: "brand",
    statuses: ["ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"],
  },
];

export const CLOSED_STATUSES = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

export function orderStatusInfo(status = "") {
  const group = GROUPS.find((g) => g.statuses.includes(status));
  if (group) return { label: group.label, tone: group.tone };
  // Anything not listed (return and refund stages) still reads sensibly.
  const text = String(status).replace(/_/g, " ").toLowerCase();
  return { label: text ? text[0].toUpperCase() + text.slice(1) : "Order", tone: "brand" };
}
