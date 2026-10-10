import Link from "next/link";
import { BUSINESS } from "@/lib/seo";

export const metadata = {
  title: "Terms & Conditions",
  description:
    "Terms and conditions for ordering fresh vegetables, fruits and milk from The Farmers Basket, Bangalore — orders, delivery, payments, returns and refunds.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "1 October 2026";

// The short version, shown first: what most shoppers actually want to know.
const AT_A_GLANCE = [
  { icon: "leaf", title: "Farm-fresh produce", text: "Natural produce varies a little in size, colour and weight." },
  { icon: "truck", title: "Delivery in Bangalore", text: "To the areas and slots shown for your pincode at checkout." },
  { icon: "refresh", title: "24-hour quality promise", text: "Damaged or wrong items? Tell us within 24 hours of delivery." },
  { icon: "shield", title: "Safe payments", text: "Cash on delivery or UPI. We never store card or UPI details." },
];

// Each section: an id for the contents links, a title, and its paragraphs.
// Plain strings, so the wording can be edited without touching the layout.
const SECTIONS = [
  {
    id: "about",
    title: "About these terms",
    body: [
      "These terms apply to your use of thefarmersbasket.in, our mobile app and any order you place with The Farmers Basket, Bengaluru, Karnataka (“we”, “us”). By creating an account, browsing or placing an order you agree to them. If you don't agree with any part, please don't use the service.",
    ],
  },
  {
    id: "account",
    title: "Your account",
    body: [
      "You sign in with a one-time code (OTP) sent to your mobile number — there is no password, so please keep your phone and the codes sent to it private. Never share an OTP with anyone, including someone claiming to be from The Farmers Basket.",
      "You're responsible for keeping your name, email and delivery addresses accurate, and for activity on your account.",
    ],
  },
  {
    id: "products",
    title: "Products & freshness",
    body: [
      "We source vegetables, fruits and milk directly from farmers and local suppliers. Being natural produce, items can vary slightly in size, shape, colour and weight from the photos shown; weights are approximate and billed as listed.",
      "Product images are for illustration. Organic and export-quality labels reflect what our suppliers declare for that batch.",
    ],
  },
  {
    id: "orders",
    title: "Orders & pricing",
    body: [
      "Prices shown at checkout include applicable taxes. Placing an order is an offer to buy at that price; it is confirmed once we accept it.",
      "We may decline or cancel an order — for example if an item runs out after you order, if a price was shown in error, or if we suspect misuse. If that happens on a prepaid order, the amount charged is refunded in full.",
    ],
  },
  {
    id: "delivery",
    title: "Delivery",
    body: [
      "We deliver to the areas and time slots shown for your pincode at checkout. Delivery charges and the minimum order for free delivery are shown before you pay.",
      "Delivery times are estimates and can be affected by weather, traffic or events outside our control. Please make sure someone is available to receive the order; perishable orders that cannot be delivered after reasonable attempts may not be refundable.",
    ],
  },
  {
    id: "payments",
    title: "Payments",
    body: [
      "We accept the payment methods shown at checkout, such as cash on delivery and UPI. Online payments are handled by the payment provider you choose; we don't store your card or UPI details.",
    ],
  },
  {
    id: "returns",
    title: "Cancellations, returns & refunds",
    body: [
      "You can cancel an order from the Orders page until it is packed for delivery.",
      "Because fresh produce and dairy are perishable, they can't be returned for change of mind. If an item arrives damaged, spoiled, expired or different from what you ordered, contact us within 24 hours of delivery (a photo helps) and we'll replace it or refund it.",
      "Approved refunds go back to your original payment method or your Farmers Basket wallet, usually within 5–7 working days.",
    ],
  },
  {
    id: "wallet",
    title: "Offers, wallet & loyalty points",
    body: [
      "Coupons and offers apply as described at the time and can't be combined unless stated. Wallet balance and loyalty points have no cash value, can't be transferred, and can only be used for orders on The Farmers Basket.",
      "Referral rewards are credited once the programme's conditions are met; we may change or end any offer or programme at any time.",
    ],
  },
  {
    id: "use",
    title: "Acceptable use",
    body: [
      "Please don't misuse the service — for example by interfering with how it works, creating accounts by automated means, placing fake orders or using it for anything unlawful. We may suspend or close accounts that do.",
    ],
  },
  {
    id: "privacy",
    title: "Your privacy",
    body: [
      "We use your name, phone number, addresses and order history only to run your account, deliver your orders and support you. We share delivery details with our delivery partners for that purpose, and never sell your personal data.",
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: [
      "We work hard to keep listings, prices and stock accurate, but mistakes can happen. To the extent permitted by law, our liability for any issue with an order is limited to the value of that order.",
    ],
  },
  {
    id: "law",
    title: "Governing law",
    body: [
      "These terms are governed by the laws of India. Any dispute is subject to the exclusive jurisdiction of the courts at Bengaluru, Karnataka.",
    ],
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: [
      "We may update these terms as the service changes. The date at the top shows the latest version; continuing to use The Farmers Basket after a change means you accept the updated terms.",
    ],
  },
];

const phoneHref = (p) => `tel:${p.replace(/[^\d+]/g, "")}`;
const phoneLabel = (p) => p.replace("+91-", "+91 ").replace(/(\d{5})(\d{5})$/, "$1 $2");

export default function TermsPage() {
  return (
    <div className="legal">
      <header className="legal-hero">
        <div className="wrap">
          <nav className="legal-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">›</span>
            <span>Terms &amp; Conditions</span>
          </nav>
          <h1>Terms &amp; Conditions</h1>
          <p className="legal-lede">
            The rules for shopping fresh vegetables, fruits and milk with The Farmers Basket — written to be
            clear and fair.
          </p>
          <div className="legal-meta">
            <span>Last updated {UPDATED}</span>
            <span>Applies to all orders in Bengaluru</span>
            <span>About 5 minutes to read</span>
          </div>
        </div>
      </header>

      <div className="wrap legal-body">
        <aside className="legal-toc" aria-label="On this page">
          <div className="legal-toc-inner">
            <strong>On this page</strong>
            <ol>
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
              <li>
                <a href="#contact">Contact &amp; grievances</a>
              </li>
            </ol>
          </div>
        </aside>

        <div className="legal-main">
          <section className="legal-glance" aria-label="At a glance">
            <h2>At a glance</h2>
            <ul>
              {AT_A_GLANCE.map((item) => (
                <li key={item.title}>
                  <span className="legal-glance-icon">
                    <Icon name={item.icon} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {SECTIONS.map((section, index) => (
            <section key={section.id} id={section.id} className="legal-section">
              <h2>
                <span className="legal-num">{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </section>
          ))}

          <section id="contact" className="legal-section legal-contact">
            <h2>
              <span className="legal-num">{String(SECTIONS.length + 1).padStart(2, "0")}</span>
              Contact &amp; grievances
            </h2>
            <p>
              Questions about these terms, an order or a complaint? Our customer care team (also our grievance
              contact) replies within 48 hours and aims to resolve issues within one month.
            </p>
            <div className="legal-contact-grid">
              {BUSINESS.phones.map((phone) => (
                <a key={phone} href={phoneHref(phone)} className="legal-contact-card">
                  <Icon name="phone" />
                  <span>
                    <small>Call us</small>
                    <strong>{phoneLabel(phone)}</strong>
                  </span>
                </a>
              ))}
              <a href={`mailto:${BUSINESS.email}`} className="legal-contact-card">
                <Icon name="mail" />
                <span>
                  <small>Email</small>
                  <strong>{BUSINESS.email}</strong>
                </span>
              </a>
              <div className="legal-contact-card">
                <Icon name="pin" />
                <span>
                  <small>Address</small>
                  <strong>
                    {BUSINESS.city}, {BUSINESS.region}
                  </strong>
                </span>
              </div>
            </div>
          </section>

          <p className="legal-foot">
            See also our <Link href="/help">Help Center</Link> for delivery areas, order tracking and returns.
          </p>
        </div>
      </div>
    </div>
  );
}

function Icon({ name }) {
  const paths = {
    leaf: <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Zm0 0 7-7" />,
    truck: (
      <>
        <path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7" />
        <circle cx="7" cy="17.5" r="1.8" />
        <circle cx="17.5" cy="17.5" r="1.8" />
      </>
    ),
    refresh: <path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4" />,
    shield: <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4" />,
    phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 6.5 8.5 6 8.5-6" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s-6.6-5.6-6.6-11A6.6 6.6 0 1 1 18.6 10c0 5.4-6.6 11-6.6 11Z" />
        <circle cx="12" cy="10" r="2.3" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
