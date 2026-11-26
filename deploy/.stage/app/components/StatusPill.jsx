// An order's status as a coloured pill: green once delivered, red when it
// ended without a delivery, brand green-tint while it is still moving.
export default function StatusPill({ status = "" }) {
  const tone =
    status === "DELIVERED"
      ? "save"
      : ["CANCELLED", "REJECTED", "REFUNDED"].includes(status)
        ? "danger"
        : "brand";
  return <span className={`pill ${tone} status-pill`}>{status.replace(/_/g, " ").toLowerCase()}</span>;
}
