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

// What is happening right now, in a shopper's words. Used under an open
// order ("Your order is being packed · Arriving tomorrow, 17 Nov").
const STAGE = {
  ORDER_PLACED: "Order placed, waiting for the store to confirm",
  PAYMENT_PENDING: "Waiting for your payment",
  ORDER_CONFIRMED: "Order confirmed, the store is preparing it",
  ORDER_ACCEPTED: "Order confirmed, the store is preparing it",
  PICKING: "Your items are being picked",
  PACKING: "Your order is being packed",
  READY_FOR_PICKUP: "Packed and ready to leave the store",
  ASSIGNED_TO_DELIVERY: "A delivery partner has been assigned",
  PICKED_UP: "On the way to you",
  OUT_FOR_DELIVERY: "On the way to you",
  ARRIVED: "Your delivery partner has arrived",
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const timeOf = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const dateOf = (d) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

// "Arriving today by 6:30 pm" / "Arriving tomorrow, 17 Nov" / "Arriving Wed, 19 Nov".
export function arrivalText(due, now = new Date()) {
  if (!due) return "";
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86400000);
  if (days <= 0) return `Arriving today by ${timeOf(due)}`;
  if (days === 1) return `Arriving tomorrow, ${new Date(due).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
  return `Arriving ${dateOf(due)}`;
}

// What is happening now for one status ("Your order is being packed").
export const stageText = (status) => STAGE[status] || orderStatusInfo(status).label;

// The full line for an open order: the stage, then when it arrives.
export function orderProgressText(order) {
  const stage = stageText(order?.status);
  const when = arrivalText(order?.delivery?.expectedBy);
  return when ? `${stage} · ${when}` : stage;
}

// The order's progress as a few shopper-sized steps, from its status history
// (the same stages as the order page). Each step: { key, label, short, at, state }
// with state "done", "active" or "pending"; a delivered order's steps it never
// passed through (e.g. "Executive arrived") are left out.
const PROGRESS_STAGES = [
  { label: "Order placed", short: "Ordered", statuses: ["ORDER_PLACED", "PAYMENT_PENDING", "PAYMENT_CONFIRMED"] },
  { label: "Order confirmed", short: "Confirmed", statuses: ["ORDER_CONFIRMED"] },
  { label: "Preparing your order", short: "Preparing", statuses: ["ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP", "ASSIGNED_TO_DELIVERY", "PICKED_UP"] },
  { label: "Out for delivery", short: "On the way", statuses: ["OUT_FOR_DELIVERY"] },
  { label: "Delivery partner arrived", short: "Arrived", statuses: ["ARRIVED"] },
  { label: "Delivered", short: "Delivered", statuses: ["DELIVERED"] },
];

export function progressSteps(order) {
  const history = order?.statusHistory || [];
  const atOf = (stage) => [...history].reverse().find((h) => stage.statuses.includes(h.status))?.at || null;
  const delivered = order?.status === "DELIVERED";
  const current = PROGRESS_STAGES.findIndex((stage) => stage.statuses.includes(order?.status));
  return PROGRESS_STAGES.map((stage, index) => {
    const at = index === 0 ? atOf(stage) || order?.placedAt || null : atOf(stage);
    const atDelivered = delivered && index === PROGRESS_STAGES.length - 1 ? order?.delivery?.deliveredAt || at : at;
    let state;
    if (delivered) state = atDelivered || index === 0 || index === PROGRESS_STAGES.length - 1 ? "done" : "skipped";
    else state = current < 0 ? (index === 0 ? "active" : "pending") : index < current ? "done" : index === current ? "active" : "pending";
    return { key: stage.statuses[0], label: stage.label, short: stage.short, at: atDelivered, state };
  }).filter((step) => step.state !== "skipped");
}
