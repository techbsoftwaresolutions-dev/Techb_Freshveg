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

// Full-colour icons that look like the real thing: a red apple, a delivery
// van, a bank card and a cardboard parcel.
const iconProps = { viewBox: "0 0 32 32", width: 28, height: 28, "aria-hidden": true };

function IconLeaf() {
  // A red apple with a green leaf and brown stem.
  return (
    <svg {...iconProps}>
      <path d="M16 10.5c-2.2-1.6-7-1.6-8.6 2.3-1.7 4.3.9 12.400 5 13.100 1.300.2 2.100-.7 3.600-.7s2.300.9 3.600.7c4.100-.7 6.700-8.800 5-13.100-1.600-3.900-6.400-3.900-8.600-2.300z" fill="#e53935" />
      <path d="M10.200 13.400c-.9 1.600-.8 3.700-.2 5.300" stroke="#ff8a80" strokeWidth="1.400" strokeLinecap="round" fill="none" />
      <path d="M16 10.600c0-2 .4-3.500 1.300-4.800" stroke="#6d4c41" strokeWidth="1.600" strokeLinecap="round" fill="none" />
      <path d="M17 7.600c.6-2.400 2.800-3.600 5.400-3.300-.5 2.500-2.700 3.700-5.400 3.300z" fill="#43a047" />
    </svg>
  );
}
function IconTruck() {
  // An orange delivery van with a blue window.
  return (
    <svg {...iconProps}>
      <path d="M2 12h4M1 15.500h5M3 19h3" stroke="#90a4ae" strokeWidth="1.400" strokeLinecap="round" />
      <rect x="7" y="8" width="13.500" height="13" rx="1.500" fill="#fb8c00" />
      <path d="M20.500 12h4.300l4.200 4.600V21h-8.500z" fill="#ef6c00" />
      <path d="M22 13.300h2.300l2.800 3H22z" fill="#81d4fa" />
      <rect x="9" y="11" width="9" height="2.200" rx="1" fill="#fff" fillOpacity=".85" />
      <circle cx="11.500" cy="22.500" r="2.800" fill="#37474f" />
      <circle cx="11.500" cy="22.500" r="1.100" fill="#cfd8dc" />
      <circle cx="24" cy="22.500" r="2.800" fill="#37474f" />
      <circle cx="24" cy="22.500" r="1.100" fill="#cfd8dc" />
    </svg>
  );
}
function IconShield() {
  // A blue bank card with a gold chip and a green tick.
  return (
    <svg {...iconProps}>
      <rect x="3" y="7" width="26" height="18" rx="3" fill="#1e88e5" />
      <rect x="3" y="11" width="26" height="3.200" fill="#0d47a1" />
      <rect x="6.500" y="17" width="5" height="4" rx="1" fill="#ffca28" />
      <circle cx="23.500" cy="19.500" r="4.300" fill="#43a047" stroke="#fff" strokeWidth="1.200" />
      <path d="m21.600 19.600 1.400 1.400 2.600-2.800" stroke="#fff" strokeWidth="1.500" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function IconReturn() {
  // A cardboard parcel with tape and a green return arrow.
  return (
    <svg {...iconProps}>
      <path d="M15 4 26 9v12.500L15 27 4 21.500V9z" fill="#c8915a" />
      <path d="M15 14v13L4 21.500V9z" fill="#a8743f" />
      <path d="M4 9l11 5 11-5" stroke="#8d5e2f" strokeWidth="1" fill="none" />
      <path d="M9.500 6.500 20.500 11.600v3.400l-2 .9v-3.300L7.400 7.500z" fill="#f3d9a4" />
      <circle cx="24" cy="23" r="5.500" fill="#2e7d32" stroke="#fff" strokeWidth="1.200" />
      <path d="M26.200 23a2.200 2.200 0 1 1-.9-1.800" stroke="#fff" strokeWidth="1.400" strokeLinecap="round" fill="none" />
      <path d="M25.800 19.900v1.700h-1.700" stroke="#fff" strokeWidth="1.400" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
