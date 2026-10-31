// The four standing promises, as one tinted strip — the same block at the
// foot of the homepage and every category page, so the shop makes the same
// promises wherever a shopper lands.
export default function TrustStrip({ prepTimeMinutes }) {
  return (
    <section className="section">
      <ul className="assurance">
        <li>
          <span className="assurance-icon"><IconLeaf /></span>
          <span>
            <strong>Fresh Produce</strong>
            <span>Sourced daily from the local market</span>
          </span>
        </li>
        <li>
          <span className="assurance-icon"><IconTruck /></span>
          <span>
            <strong>Fast Delivery</strong>
            {/* A number only when the page knows the real one — never a
                guessed "30 minutes" on a page that has no store to ask. */}
            <span>
              {prepTimeMinutes
                ? prepTimeMinutes >= 1440
                  ? "Delivered the next day"
                  : `Out of the store in about ${prepTimeMinutes} minutes`
                : "Straight from your neighbourhood store"}
            </span>
          </span>
        </li>
        <li>
          <span className="assurance-icon"><IconShield /></span>
          <span>
            <strong>Secure Payments</strong>
            <span>UPI, card or cash on delivery</span>
          </span>
        </li>
        <li>
          <span className="assurance-icon"><IconReturn /></span>
          <span>
            <strong>Easy Returns</strong>
            <span>Raise a return from your order</span>
          </span>
        </li>
      </ul>
    </section>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  width: 24,
  height: 24,
  "aria-hidden": true,
};

function IconLeaf() {
  return (
    <svg {...iconProps}>
      <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" />
      <path d="M5 19c3-4 6-7 10-9" />
    </svg>
  );
}
function IconTruck() {
  return (
    <svg {...iconProps}>
      <path d="M2 6.5h11.5v9.5H2z" />
      <path d="M13.5 10h4.2l3.3 3.2V16h-7.5" />
      <circle cx="6.5" cy="17.8" r="1.7" />
      <circle cx="17" cy="17.8" r="1.7" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg {...iconProps}>
      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconReturn() {
  return (
    <svg {...iconProps}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4h4" />
      <path d="M12 8v4l2.5 2" />
    </svg>
  );
}
