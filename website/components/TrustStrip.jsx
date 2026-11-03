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
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  width: 26,
  height: 26,
  "aria-hidden": true,
};

// Soft tint inside each outline, so the icons read as a set.
const tint = { fill: "currentColor", fillOpacity: 0.16 };

function IconLeaf() {
  // An apple with a leaf.
  return (
    <svg {...iconProps}>
      <path {...tint} d="M12 8.2C10.4 6.9 6.9 7 5.8 10c-1.2 3.2.7 9.5 3.8 10 1 .1 1.6-.5 2.4-.5s1.4.6 2.4.5c3.1-.5 5-6.8 3.8-10-1.100-3-4.600-3.100-6.200-1.800z" />
      <path d="M12 8.2V5.6" />
      <path {...tint} d="M12 5.6c0-1.800 1.300-2.900 3.200-2.900 0 1.900-1.200 2.900-3.200 2.900z" />
    </svg>
  );
}
function IconTruck() {
  // A delivery van with speed lines.
  return (
    <svg {...iconProps}>
      <path d="M1.500 9.500h3M0.500 12.500h4M2.500 15.500h2" />
      <path {...tint} d="M7 7h9.500v10H7z" />
      <path {...tint} d="M16.500 10.500h3l2.500 2.800V17h-5.500" />
      <circle cx="10" cy="18" r="1.800" fill="#fff" />
      <circle cx="18.500" cy="18" r="1.800" fill="#fff" />
    </svg>
  );
}
function IconShield() {
  // A card with a tick: secure payment.
  return (
    <svg {...iconProps}>
      <path {...tint} d="M5.500 4.500h13A2.500 2.500 0 0 1 21 7v9.500a2.500 2.500 0 0 1-2.500 2.500h-13A2.500 2.500 0 0 1 3 16.500V7a2.500 2.500 0 0 1 2.500-2.500z" />
      <path d="M3 9.500h18" />
      <path d="M6.500 15h3" />
      <path d="m13.500 15 1.600 1.600 3-3.200" />
    </svg>
  );
}
function IconReturn() {
  // A parcel with a return arrow.
  return (
    <svg {...iconProps}>
      <path {...tint} d="M12 2.800 20 7v9.500l-8 4.500-8-4.500V7z" />
      <path d="M4 7l8 4.400L20 7" />
      <path d="M12 11.400V21" />
      <path d="M8.200 4.900 16 9.300" />
    </svg>
  );
}
