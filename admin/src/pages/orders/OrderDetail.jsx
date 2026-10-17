import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Loading, Modal, Pill, rupees, when } from "../../components/ui";
import { statusTone } from "./Orders";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();

  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  // `actions` is what the API says this user may do from here — the buttons
  // are not a frontend guess at the state machine, they are the state machine.
  const [actions, setActions] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    const data = await api.get(`/orders/${id}`);
    setOrder(data.order);
    setTimeline(data.timeline);
    setActions(data.actions);
  }, [id]);

  useEffect(() => {
    Promise.all([load(), api.get("/orders/statuses")])
      .then(([, s]) => setStatuses(Object.fromEntries(s.statuses.map((x) => [x.key, x]))))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [load]);

  async function advance(status) {
    setBusy(true);
    setError("");
    try {
      await api.post(`/orders/${id}/status`, { status });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openAssign() {
    setAssigning(true);
    setError("");
    try {
      // Read the roster live, with today's load, rather than caching a list
      // that goes stale between dispatches.
      const data = await api.get("/orders/delivery/partners", { store: order.store });
      setPartners(data.partners);
    } catch (err) {
      setError(err.message);
      setPartners([]);
    }
  }

  async function assign(partnerId) {
    setBusy(true);
    try {
      await api.post(`/orders/${id}/assign`, { partner: partnerId });
      setAssigning(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page"><Loading /></div>;
  if (!order) return <div className="page"><Banner tone="error">{error || "Order not found"}</Banner></div>;

  // The way forward, and the ways out, kept apart so "Cancel order" is never
  // the button sitting where "Start packing" was a second ago. Assigning a
  // partner needs orders.assign as well as orders.manage.
  const forward = actions.filter(
    (a) => a.kind !== "danger" && (a.status !== "ASSIGNED_TO_DELIVERY" || can("orders.assign"))
  );
  const exits = actions.filter((a) => a.kind === "danger");

  const address = order.delivery?.address || {};
  // weightGrams is per the same reference unit unitPrice is quoted against,
  // so it multiplies by quantity exactly like unitPrice does. Lines whose
  // variant never had a weight set contribute 0, same as an unset price would.
  const totalWeightGrams = order.items.reduce((sum, item) => sum + (item.weightGrams || 0) * item.quantity, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="mono">{order.code}</h1>
          <p>
            Placed {when(order.placedAt)} · {order.source} ·{" "}
            <Pill tone={statusTone(order.status, statuses)}>
              {statuses[order.status]?.label || order.status}
            </Pill>
          </p>
        </div>
        <div className="inline">
          <button className="btn" onClick={() => navigate("/orders")}>
            All orders
          </button>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

      {/* Where the order is on its way from "placed" to "delivered", at a
          glance — the same steps the customer sees on their tracker. */}
      <StageTracker timeline={timeline} status={order.status} statuses={statuses} />

      {can("orders.manage") && (forward.length || exits.length) ? (
        <div className="next-step">
          <div className="next-step-copy">
            <span className="section-label">Next step</span>
            <strong>{nextStepHint(order)}</strong>
          </div>
          <div className="next-step-actions">
            {forward.map((action) => (
              <button
                key={action.status}
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  // Assigning is not a bare status change: a partner has to be
                  // chosen, so this opens the picker instead.
                  action.status === "ASSIGNED_TO_DELIVERY" ? openAssign() : advance(action.status)
                }
              >
                {action.label}
              </button>
            ))}
            {exits.map((action) => (
              <button
                key={action.status}
                className="btn danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`${action.label} ${order.code}? The customer will be told.`)) advance(action.status);
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid split">
        <div style={{ display: "grid", gap: 14 }}>
          <Card
            title={
              <h2 className="inline" style={{ gap: 8 }}>
                <IconItemsHero /> Items ({order.items.length})
              </h2>
            }
            tight
            actions={
              <>
                <Pill>
                  <IconBoxSm /> {order.items.length} item{order.items.length === 1 ? "" : "s"}
                </Pill>
                {/* Only shown when at least one line actually has a weight
                    recorded on its variant — otherwise this would read as a
                    real figure ("0 kg") when it's really just unset data. */}
                {totalWeightGrams > 0 && (
                  <Pill>
                    <IconScaleSm /> {(totalWeightGrams / 1000).toFixed(2)} kg
                  </Pill>
                )}
                <Pill tone="accent">
                  <IconRupeeSm /> {rupees(order.pricing.total)}
                </Pill>
              </>
            }
          >
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit</th>
                    <th className="num">Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, itemIndex) => (
                    <tr key={item.id || item.sku}>
                      <td className="muted">{itemIndex + 1}</td>
                      <td>
                        <div className="row-with-media">
                          {item.image ? (
                            <img className="row-media" src={item.image} alt="" />
                          ) : (
                            <span className="row-media row-media-empty" aria-hidden="true">
                              <IconImagePlaceholder />
                            </span>
                          )}
                          <div className="stack">
                            <span className="row-title">
                              {item.name}
                              {item.variantName ? ` · ${item.variantName}` : ""}
                            </span>
                            <span className="tag tag-plain">{item.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="num">
                        {item.quantity} {item.unit}
                        {item.pickedQuantity !== null && item.pickedQuantity !== undefined && (
                          <div className="row-sub">picked {item.pickedQuantity}</div>
                        )}
                      </td>
                      <td className="num">{rupees(item.unitPrice, { decimals: true })}</td>
                      <td className="num">
                        <strong>{rupees(item.payable)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Payment summary">
            <table className="data">
              <tbody>
                <Row label="Subtotal" value={rupees(order.pricing.subtotal)} />
                {order.pricing.catalogueSavings > 0 && (
                  <Row label="Catalogue savings" value={`− ${rupees(order.pricing.catalogueSavings)}`} tone="ok" />
                )}
                {order.pricing.offerDiscount - (order.pricing.rewardDiscount || 0) > 0 && (
                  <Row label="Offer discount" value={`− ${rupees(order.pricing.offerDiscount - (order.pricing.rewardDiscount || 0))}`} tone="ok" />
                )}
                {order.pricing.rewardDiscount > 0 && (
                  <Row label={`Reward coupon ${order.rewardCoupon?.code || ""}`} value={`− ${rupees(order.pricing.rewardDiscount)}`} tone="ok" />
                )}
                <Row
                  label="Delivery"
                  value={order.pricing.deliveryFree ? "Free" : rupees(order.pricing.deliveryCharge)}
                />
                {order.pricing.packagingCharge > 0 && (
                  <Row label="Packaging" value={rupees(order.pricing.packagingCharge)} />
                )}
                {order.pricing.walletApplied > 0 && (
                  <Row label="Wallet" value={`− ${rupees(order.pricing.walletApplied)}`} tone="ok" />
                )}
                {order.pricing.loyaltyApplied > 0 && (
                  <Row
                    label={`Loyalty (${order.pricing.loyaltyPointsUsed} pts)`}
                    value={`− ${rupees(order.pricing.loyaltyApplied)}`}
                    tone="ok"
                  />
                )}
                {order.pricing.roundOff !== 0 && (
                  <Row label="Round off" value={rupees(order.pricing.roundOff, { decimals: true })} />
                )}
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td className="num">
                    <strong style={{ fontSize: 15 }}>{rupees(order.pricing.total)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <Card title="Tracking">
            <ul className="timeline">
              {/* Steps this order skipped (a COD order never passes through
                  "payment received") are left out rather than shown as done. */}
              {timeline
                .filter((step) => step.state !== "skipped")
                .map((step) => (
                  <li key={step.status} className={step.state}>
                    <span className="dot">✓</span>
                    <div className="stack">
                      <span className="label">{step.label}</span>
                      <span className="when">{step.at ? when(step.at) : "—"}</span>
                    </div>
                  </li>
                ))}
            </ul>
          </Card>

          <Card title="Customer">
            <div className="stack">
              <strong>{order.customerSnapshot?.name || "—"}</strong>
              <span className="muted">{order.customerSnapshot?.phone}</span>
            </div>
            <div className="divider" />
            <div className="section-label">Delivery address</div>
            <div className="stack muted" style={{ fontSize: 13 }}>
              <span>{address.line1}</span>
              {address.line2 && <span>{address.line2}</span>}
              {address.landmark && <span className="faint">Near {address.landmark}</span>}
              <span>
                {address.city} {address.pincode}
              </span>
            </div>
            {order.delivery?.instructions && (
              <p className="faint" style={{ fontSize: 12.5, marginBottom: 0 }}>
                “{order.delivery.instructions}”
              </p>
            )}
          </Card>

          <Card title="Delivery">
            {order.delivery?.partnerName ? (
              <div className="stack">
                <strong>{order.delivery.partnerName}</strong>
                <span className="muted">{order.delivery.partnerPhone}</span>
                <span className="faint" style={{ fontSize: 12 }}>
                  Assigned {when(order.delivery.assignedAt)}
                </span>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                No delivery boy assigned yet.
              </p>
            )}
            {order.delivery?.otp && order.status !== "DELIVERED" && (
              <>
                <div className="divider" />
                <div className="section-label">Handover OTP</div>
                <span className="mono" style={{ fontSize: 20, letterSpacing: "0.2em" }}>
                  {order.delivery.otp}
                </span>
                <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>
                  The customer reads this to the delivery boy at the door.
                </p>
              </>
            )}
          </Card>

          <DeliveryPhotoCard order={order} />
        </div>
      </div>

      {assigning && (
        <AssignModal
          busy={busy}
          partners={partners}
          onClose={() => setAssigning(false)}
          onAssign={assign}
        />
      )}
    </div>
  );
}

// What the store should be doing about this order right now, in words.
function nextStepHint(order) {
  switch (order.status) {
    case "ORDER_PLACED":
    case "PAYMENT_CONFIRMED":
      return "Confirm the order so the store can start on it.";
    case "PAYMENT_PENDING":
      return "Waiting for the customer's payment to clear.";
    case "ORDER_CONFIRMED":
      return "Accept the order to reserve its stock and start preparing it.";
    case "ORDER_ACCEPTED":
      return "Start collecting the items from the shelves.";
    case "PICKING":
      return "When every item is collected, start packing.";
    case "PACKING":
      return "When the bag is sealed, mark it ready for pickup.";
    case "READY_FOR_PICKUP":
      return "Assign a delivery boy to take it out.";
    case "ASSIGNED_TO_DELIVERY":
      return `Waiting for ${order.delivery?.partnerName || "the delivery boy"} to collect it from the counter.`;
    case "PICKED_UP":
    case "OUT_FOR_DELIVERY":
      return `${order.delivery?.partnerName || "The delivery boy"} is taking it to the customer.`;
    case "ARRIVED":
      return "The delivery boy is at the door, waiting for the customer's code.";
    default:
      return "";
  }
}

// The order's journey as a row of numbered steps: done ones ticked, the
// current one highlighted, the rest waiting. Off-path states (cancelled,
// rejected, returns) replace the row with a single line saying so.
function StageTracker({ timeline, status, statuses }) {
  const steps = timeline.filter((step) => step.state !== "skipped");
  const offPath = !steps.some((step) => step.status === status) && status !== "ORDER_PLACED";

  if (offPath && ["CANCELLED", "REJECTED", "REFUNDED"].includes(status)) {
    return (
      <div className="stage-tracker stopped">
        <strong>{statuses[status]?.label || status}</strong>
        <span className="muted">This order is closed.</span>
      </div>
    );
  }

  return (
    <ol className="stage-tracker" aria-label="Order progress">
      {steps.map((step, index) => {
        const state = step.status === status ? "current" : step.state === "done" ? "done" : "pending";
        return (
          <li key={step.status} className={`stage ${state}`}>
            <span className="stage-dot" aria-hidden="true">
              {state === "done" ? "✓" : index + 1}
            </span>
            <span className="stage-label">{statuses[step.status]?.label || step.label}</span>
            {step.at ? <span className="stage-time">{when(step.at)}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

// Plain gray placeholder for order lines whose product has no photo (a
// real data gap, not a bug) — same treatment as the Products list.
function IconItemsHero() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M4 8l8-4 8 4-8 4-8-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M4 8v8l8 4 8-4V8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 12v8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconBoxSm() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
      <path
        d="M4 8l8-4 8 4-8 4-8-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M4 8v8l8 4 8-4V8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconScaleSm() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
      <path d="M12 3v18M7 21h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 7h6M13 7h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M5 7l-2.5 5a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 5a2.5 2.5 0 0 0 5 0L19 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRupeeSm() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
      <path
        d="M7 5h10M7 9h10M7 5c4.5 0 7 1.3 7 4s-2.5 4-7 4h-.5L15 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconImagePlaceholder() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" />
      <path
        d="M4 17l5-5 3.5 3.5L16 12l4 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Row({ label, value, tone }) {
  return (
    <tr>
      <td className="muted">{label}</td>
      <td className="num" style={tone ? { color: `var(--${tone})` } : undefined}>
        {value}
      </td>
    </tr>
  );
}

// The delivery boy's photo of the products at the door, before handover. A
// saved photo is not a delivery: only the handover code closes the order.
// The link expires about an hour after the page loaded.
function DeliveryPhotoCard({ order }) {
  const photo = order.delivery?.productPhoto;
  return (
    <Card title="Delivery photo proof">
      {photo ? (
        <div className="stack" style={{ gap: 8 }}>
          {photo.url ? (
            <a href={photo.url} target="_blank" rel="noopener noreferrer" title="Open full size">
              <img
                src={photo.url}
                alt={`Products for ${order.code}, photographed at delivery`}
                style={{ display: "block", width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 8, background: "var(--bg)" }}
              />
            </a>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>Saved, but image storage is not configured on this API.</p>
          )}
          <div>
            <Pill tone={order.status === "DELIVERED" ? "ok" : "warn"}>
              {order.status === "DELIVERED" ? "Delivered" : "Photo saved · not yet delivered"}
            </Pill>
          </div>
          <span className="faint" style={{ fontSize: 12 }}>
            {order.code} · taken by {photo.uploadedByName || "the delivery boy"} · {when(photo.uploadedAt)}
          </span>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Photo not uploaded.
          {["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"].includes(order.status)
            ? ""
            : " The delivery boy takes it at the door, after marking arrived."}
        </p>
      )}
    </Card>
  );
}

function AssignModal({ busy, partners, onClose, onAssign }) {
  const [partnerId, setPartnerId] = useState("");

  return (
    <Modal
      title="Assign delivery boy"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!partnerId || busy} onClick={() => onAssign(partnerId)}>
            {busy ? "Assigning…" : "Assign"}
          </button>
        </>
      }
    >
      {partners.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No active delivery boys for this store. Add one under Delivery Boys first.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Delivery boy</th>
                <th className="num">Open now</th>
                <th className="num">Delivered today</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id} onClick={() => setPartnerId(partner.id)} style={{ cursor: "pointer" }}>
                  <td>
                    <input
                      type="radio"
                      name="partner"
                      checked={partnerId === partner.id}
                      onChange={() => setPartnerId(partner.id)}
                    />
                  </td>
                  <td>
                    <div className="stack">
                      <span className="row-title">{partner.name}</span>
                      <span className="row-sub">{partner.phone}</span>
                    </div>
                  </td>
                  <td className="num">
                    {/* The least busy partner is usually the right one, so the
                        current load is what the dispatcher sees first. */}
                    <Pill tone={partner.openNow > 3 ? "warn" : undefined}>{partner.openNow}</Pill>
                  </td>
                  <td className="num muted">{partner.deliveredToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
