import Link from "next/link";
import FooterInstall from "@/components/FooterInstall";
import logoIcon from "@/assets/logo-icon.png";

// Only pages that exist are linked. About, careers and FAQs have no route
// yet — they join these lists when they do, rather than sitting here as
// links that go nowhere.
export default function Footer({ categories = [] }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="footer-logo">
              <img src={logoIcon.src} alt="" width="48" height="48" className="footer-mark" />
              <span>
                <span className="footer-logo-name">The Farmers Basket</span>
                <span className="footer-logo-tag">Fresh Food • Better Life</span>
              </span>
            </Link>
            <FooterInstall />
          </div>

          <div className="footer-col footer-col-shop">
            <h4>Shop</h4>
            <ul>
              {categories.slice(0, 6).map((category) => (
                <li key={category.id}>
                  <Link href={`/c/${category.slug}`}>{category.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col footer-col-care">
            <h4>Customer Care</h4>
            <ul>
              <li><Link href="/help">Help Center</Link></li>
              <li><Link href="/orders">Track Order</Link></li>
              <li><Link href="/orders">Returns &amp; Refunds</Link></li>
              <li><a href="tel:+918072605216">Contact Us</a></li>
              <li><Link href="/terms">Terms &amp; Conditions</Link></li>
            </ul>
          </div>

          <div className="footer-col footer-col-account">
            <h4>My Account</h4>
            <ul>
              <li><Link href="/account">Account</Link></li>
              <li><Link href="/orders">My Orders</Link></li>
              <li><Link href="/cart">Cart</Link></li>
              <li><Link href="/login">Sign In</Link></li>
            </ul>
          </div>

          <div className="footer-col footer-col-contact">
            <h4>Get in Touch</h4>
            <ul className="footer-contact">
              <li>
                <a href="tel:+918072605216">+91 80726 05216</a>
              </li>
              <li>
                <a href="tel:+916374047119">+91 63740 47119</a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </li>
              <li>Bangalore, Karnataka</li>
            </ul>
            <ul className="footer-social" aria-label="Follow us">
              {SOCIAL.map((network) => (
                <li key={network.name}>
                  <a href={network.href} target="_blank" rel="noopener noreferrer" aria-label={network.name}>
                    {network.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-base">
          <span>© {new Date().getFullYear()} The Farmers Basket. All rights reserved.</span>
          <span>Prices include all taxes</span>
        </div>
      </div>
    </footer>
  );
}

const SUPPORT_EMAIL = "support@thefarmersbasket.in";

// The shop's social pages. Update a link here when its page changes.
const SOCIAL = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/thefarmersbasket",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/thefarmersbasket",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@thefarmersbasket",
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.6 2.6 0 0 0-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8a2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
      </svg>
    ),
  },
];

