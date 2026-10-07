// The order lifecycle as data, not as if/else chains scattered across
// controllers. Every transition in the system is checked against this table,
// the admin UI builds its action buttons from it, and the customer tracker
// renders `timeline` straight out of it.
//
// Adding a step (a quality-check stage, say) means adding a row here and
// naming it in the `next` list of the step before it.

const STATUSES = {
  ORDER_PLACED: {
    label: "Order placed",
    customerLabel: "Order placed",
    group: "placed",
    timeline: true,
    next: ["PAYMENT_PENDING", "PAYMENT_CONFIRMED", "ORDER_CONFIRMED", "CANCELLED", "REJECTED"],
    actors: ["system"],
  },
  PAYMENT_PENDING: {
    label: "Awaiting payment",
    customerLabel: "Awaiting payment",
    group: "placed",
    timeline: false,
    next: ["PAYMENT_CONFIRMED", "CANCELLED"],
    actors: ["system"],
  },
  PAYMENT_CONFIRMED: {
    label: "Payment confirmed",
    customerLabel: "Payment received",
    group: "placed",
    timeline: true,
    next: ["ORDER_CONFIRMED", "CANCELLED", "REJECTED"],
    actors: ["system"],
  },
  ORDER_CONFIRMED: {
    label: "Order confirmed",
    customerLabel: "Order confirmed",
    group: "processing",
    timeline: true,
    next: ["ORDER_ACCEPTED", "CANCELLED", "REJECTED"],
    actors: ["system", "store_manager", "admin"],
  },
  ORDER_ACCEPTED: {
    label: "Accepted by store",
    customerLabel: "Store is preparing your order",
    group: "processing",
    timeline: true,
    // Stock leaves the shelf here, so cancelling past this point has to put it
    // back — see order.service.cancel.
    next: ["PICKING", "CANCELLED", "REJECTED"],
    actors: ["store_manager", "admin", "picker"],
  },
  PICKING: {
    label: "Picking",
    customerLabel: "Collecting your items",
    group: "processing",
    timeline: true,
    next: ["PACKING", "CANCELLED"],
    actors: ["picker", "store_manager", "admin"],
  },
  PACKING: {
    label: "Packing",
    customerLabel: "Packing your order",
    group: "processing",
    timeline: true,
    next: ["READY_FOR_PICKUP", "CANCELLED"],
    actors: ["picker", "store_manager", "admin"],
  },
  READY_FOR_PICKUP: {
    label: "Ready for pickup",
    customerLabel: "Ready — waiting for a delivery partner",
    group: "processing",
    timeline: true,
    next: ["ASSIGNED_TO_DELIVERY", "DELIVERED", "CANCELLED"],
    actors: ["store_manager", "admin"],
  },
  ASSIGNED_TO_DELIVERY: {
    label: "Assigned to delivery partner",
    customerLabel: "Delivery partner assigned",
    group: "delivery",
    timeline: true,
    next: ["PICKED_UP", "READY_FOR_PICKUP", "CANCELLED"],
    actors: ["store_manager", "admin", "system"],
  },
  PICKED_UP: {
    label: "Picked up",
    customerLabel: "Picked up from store",
    group: "delivery",
    timeline: true,
    next: ["OUT_FOR_DELIVERY", "CANCELLED"],
    actors: ["delivery_partner", "store_manager", "admin"],
  },
  OUT_FOR_DELIVERY: {
    label: "Out for delivery",
    customerLabel: "On the way to you",
    group: "delivery",
    timeline: true,
    next: ["ARRIVED", "DELIVERED", "CANCELLED"],
    actors: ["delivery_partner", "store_manager", "admin"],
  },
  ARRIVED: {
    label: "Arrived at address",
    customerLabel: "Your delivery partner has arrived",
    group: "delivery",
    timeline: true,
    next: ["DELIVERED", "CANCELLED"],
    actors: ["delivery_partner"],
  },
  DELIVERED: {
    label: "Delivered",
    customerLabel: "Delivered",
    group: "closed",
    timeline: true,
    terminal: true,
    next: ["RETURN_REQUESTED"],
    actors: ["delivery_partner", "store_manager", "admin"],
  },

  // --- Off-ramps ---
  CANCELLED: {
    label: "Cancelled",
    customerLabel: "Cancelled",
    group: "closed",
    timeline: false,
    terminal: true,
    next: ["REFUNDED"],
    actors: ["customer", "store_manager", "admin", "system"],
  },
  REJECTED: {
    label: "Rejected by store",
    customerLabel: "Could not be fulfilled",
    group: "closed",
    timeline: false,
    terminal: true,
    next: ["REFUNDED"],
    actors: ["store_manager", "admin"],
  },

  // --- Returns ---
  RETURN_REQUESTED: {
    label: "Return requested",
    customerLabel: "Return requested",
    group: "returns",
    timeline: false,
    next: ["RETURN_APPROVED", "DELIVERED"], // back to DELIVERED if declined
    actors: ["customer", "support", "admin"],
  },
  RETURN_APPROVED: {
    label: "Return approved",
    customerLabel: "Return approved",
    group: "returns",
    timeline: false,
    next: ["RETURN_PICKED"],
    actors: ["support", "store_manager", "admin"],
  },
  RETURN_PICKED: {
    label: "Return collected",
    customerLabel: "Return collected",
    group: "returns",
    timeline: false,
    next: ["REFUNDED"],
    actors: ["delivery_partner", "store_manager", "admin"],
  },
  REFUNDED: {
    label: "Refunded",
    customerLabel: "Refunded",
    group: "returns",
    timeline: false,
    terminal: true,
    next: [],
    actors: ["support", "admin", "system"],
  },
};

// What the button that moves an order *into* a status says. A status is named
// for the state ("Picking"); the button that starts it is named for the act
// ("Start picking") — staff read the button, not the state it leads to.
const ACTION_LABELS = {
  PAYMENT_PENDING: "Await payment",
  PAYMENT_CONFIRMED: "Mark payment received",
  ORDER_CONFIRMED: "Confirm order",
  ORDER_ACCEPTED: "Accept & start preparing",
  PICKING: "Start picking items",
  PACKING: "Start packing",
  READY_FOR_PICKUP: "Mark ready for pickup",
  ASSIGNED_TO_DELIVERY: "Assign delivery partner",
  PICKED_UP: "Mark picked up",
  OUT_FOR_DELIVERY: "Mark out for delivery",
  ARRIVED: "Mark arrived",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel order",
  REJECTED: "Reject order",
  RETURN_REQUESTED: "Raise a return",
  RETURN_APPROVED: "Approve return",
  RETURN_PICKED: "Mark return collected",
  REFUNDED: "Issue refund",
};

const actionLabel = (status) => ACTION_LABELS[status] || STATUSES[status]?.label || status;

// An action as the admin and delivery apps receive it: where it goes, what the
// button says, and whether it is the way forward or a way out.
const describeAction = (to) => ({
  status: to,
  label: actionLabel(to),
  stage: STATUSES[to]?.label || to,
  kind: to === "CANCELLED" || to === "REJECTED" ? "danger" : "forward",
});

const STATUS_KEYS = Object.keys(STATUSES);

// The happy path, in order — what the customer's tracker draws as a stepper.
// Statuses off this path (cancelled, returns) are shown as their own state
// rather than as a step in the line.
const TIMELINE = STATUS_KEYS.filter((key) => STATUSES[key].timeline);

const isTerminal = (status) => Boolean(STATUSES[status]?.terminal);

function canTransition(from, to) {
  const node = STATUSES[from];
  if (!node) return false;
  return node.next.includes(to);
}

// Which transitions this actor may make from here — the admin's action bar and
// the delivery app's primary button are both built from this.
function allowedTransitions(from, role) {
  const node = STATUSES[from];
  if (!node) return [];
  return node.next.filter((to) => {
    const target = STATUSES[to];
    if (!target) return false;
    if (!role || role === "admin" || role === "super_admin") return true;
    return target.actors.includes(role);
  });
}

// Renders the stepper. A step counts as done only if the order actually
// reached it — an earlier step the order never passed through is "skipped",
// not done. That distinction matters: a cash-on-delivery order goes straight
// from ORDER_PLACED to ORDER_CONFIRMED, and marking the PAYMENT_CONFIRMED step
// done because it sits earlier in the list would tell the customer they had
// paid when they had not.
//
// Callers render `skipped` steps as absent rather than as history.
function buildTimeline(currentStatus, history = []) {
  const reached = new Map(history.map((h) => [h.status, h.at]));
  const currentIndex = TIMELINE.indexOf(currentStatus);

  return TIMELINE.map((status, index) => {
    let state = "pending";
    if (reached.has(status)) state = "done";
    else if (status === currentStatus) state = "active";
    else if (currentIndex >= 0 && index < currentIndex) state = "skipped";

    // The current status is "active" even when it is in the history, so the
    // stepper has a head rather than being entirely green.
    if (status === currentStatus) state = "active";

    return {
      status,
      label: STATUSES[status].customerLabel,
      state,
      at: reached.get(status) || null,
    };
  });
}

// Stock is committed to the order from ORDER_ACCEPTED onward; before that a
// cancellation only needs to release the reservation.
const STOCK_COMMITTED_FROM = "ORDER_ACCEPTED";
const stockIsCommitted = (status) =>
  TIMELINE.indexOf(status) >= TIMELINE.indexOf(STOCK_COMMITTED_FROM);

module.exports = {
  STATUSES,
  STATUS_KEYS,
  TIMELINE,
  isTerminal,
  canTransition,
  allowedTransitions,
  buildTimeline,
  stockIsCommitted,
  actionLabel,
  describeAction,
};
