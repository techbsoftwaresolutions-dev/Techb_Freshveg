import Link from "next/link";
import ContactUs from "./ContactUs";
import CallButton from "./CallButton";

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
              <img src="/logo-horizontal.png" alt="Hosur Basket — your everyday supermarket" className="footer-logo-img" width="216" height="60" />
            </Link>
            <p>
              Fresh fruit, vegetables, groceries and household essentials, delivered from your
              neighbourhood store.
            </p>
          </div>

          <div>
            <h4>Shop</h4>
            <ul>
              {categories.slice(0, 6).map((category) => (
                <li key={category.id}>
                  <Link href={`/c/${category.slug}`}>{category.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Customer Care</h4>
            <ul>
              <li><Link href="/help">Help Center</Link></li>
              <li><Link href="/orders">Track Order</Link></li>
              <li><Link href="/orders">Returns &amp; Refunds</Link></li>
              <li><ContactUs /></li>
              <li><Link href="/terms">Terms &amp; Conditions</Link></li>
            </ul>
          </div>

          <div>
            <h4>My Account</h4>
            <ul>
              <li><Link href="/account">Account</Link></li>
              <li><Link href="/orders">My Orders</Link></li>
              <li><Link href="/cart">Cart</Link></li>
              <li><Link href="/login">Sign In</Link></li>
            </ul>
          </div>

          <div>
            <h4>Get in Touch</h4>
            <ul className="footer-contact">
              <li>
                <CallButton phone="+919003597158" label="+91 90035 97158" title="Call Hosur Basket" className="footer-link-btn">
                  +91 90035 97158
                </CallButton>
              </li>
              <li>
                <a href="https://hosurbasket.com">hosurbasket.com</a>
              </li>
              <li>
                <address>#74/22, GKD Nagar, Avalapalli Road, Hosur 635109</address>
              </li>
            </ul>
            {/* Display only for now — no links until the pages exist. */}
            <div className="footer-social" role="group" aria-label="Social media">
              <span className="footer-social-icon" role="img" aria-label="Facebook">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.1H7.6v3h2.7V21h3.2z" />
                </svg>
              </span>
              <span className="footer-social-icon" role="img" aria-label="Instagram">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="footer-social-icon" role="img" aria-label="YouTube">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
                  <path d="m10 9.2 5 2.8-5 2.8z" fill="currentColor" stroke="none" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        <div className="footer-base">
          <span>© {new Date().getFullYear()} Hosur Basket. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
