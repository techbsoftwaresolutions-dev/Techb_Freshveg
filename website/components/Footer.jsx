import Link from "next/link";
import FooterInstall from "@/components/FooterInstall";
import { brandImages } from "@/lib/brand";
import { LEGAL_PAGES } from "@/lib/legal";

// Only pages that exist are linked. About, careers and FAQs have no route
// yet — they join these lists when they do, rather than sitting here as
// links that go nowhere.
export default function Footer({ categories = [], branding }) {
  const brand = brandImages(branding);
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="footer-logo">
              <img src={brand.symbol} alt="The Farmers Basket logo" width="48" height="48" className="footer-mark" />
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

          {/* On phones these two lists become tiles: icon, label, arrow
              (the icon and arrow are hidden on desktop). */}
          <div className="footer-col footer-col-care">
            <h4>Customer Care</h4>
            <ul>
              <li><Link href="/help"><Tile icon="help">Help Center</Tile></Link></li>
              <li><Link href="/orders"><Tile icon="track">Track Order</Tile></Link></li>
              <li><a href="tel:+918072605216"><Tile icon="chat">Contact Us</Tile></a></li>
            </ul>
          </div>

          <div className="footer-col footer-col-legal">
            <h4>Policies</h4>
            <ul>
              {LEGAL_PAGES.filter((page) => !page.href.startsWith("/delivery-app")).map((page) => (
                <li key={page.href}>
                  <Link href={page.href}><Tile icon={page.href}>{page.label}</Tile></Link>
                </li>
              ))}
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
                <a href="tel:+918072605216"><FooterIcon name="phone" />+91 80726 05216</a>
              </li>
              <li>
                <a href="tel:+916374047119"><FooterIcon name="phone" />+91 63740 47119</a>
              </li>
              <li className="footer-contact-mail">
                <a href={`mailto:${SUPPORT_EMAIL}`}><FooterIcon name="mail" />{SUPPORT_EMAIL}</a>
              </li>
              <li className="footer-contact-place"><FooterIcon name="pin" />Bangalore, Karnataka</li>
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
          <span>Prices include all taxes.</span>
        </div>
      </div>
    </footer>
  );
}

function Tile({ icon, children }) {
  return (
    <>
      <FooterIcon name={icon} />
      <span className="footer-tile-label">{children}</span>
      <svg className="footer-tile-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </>
  );
}

function FooterIcon({ name }) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg className="footer-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

// Line icons for the phone footer's tiles and contact rows; policies are keyed
// by their page's href (lib/legal LEGAL_PAGES).
const ICONS = {
  help: ["M4 14v-2a8 8 0 0 1 16 0v2", "M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2zM20 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z", "M18 18c0 1.7-2 3-5 3"],
  track: ["M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z", "M3.5 7.5 12 12l8.5-4.5M12 12v9", "m7.8 5.3 8.5 4.5"],
  chat: ["M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4A8 8 0 1 1 20 12z", "M8.5 12h.01M12 12h.01M15.5 12h.01"],
  "/privacy-policy": ["M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z", "m9 12 2 2 4-4"],
  "/terms-and-conditions": ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5M9 13h6M9 17h4"],
  "/refund-cancellation-policy": ["M4 12a8 8 0 1 0 2.3-5.7", "M4 4v4h4"],
  "/shipping-delivery-policy": ["M3 6h11v10H3zM14 9h4l3 3v4h-7", "M7.5 18.5a1.5 1.5 0 1 0 0-.01M17.5 18.5a1.5 1.5 0 1 0 0-.01"],
  "/referral-terms": ["M4 10h16v4H4zM5 14h14v7H5zM12 10v11", "M12 10C10 10 7.5 9 7.5 7a2 2 0 0 1 4.5-1c0 1.5 0 4 0 4zM12 10c2 0 4.5-1 4.5-3a2 2 0 0 0-4.5-1"],
  "/account-deletion": ["M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M3 21c0-3.9 3.1-7 7-7 1 0 2 .2 2.8.6", "M18 15.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM18 13.5v2M18 20.5v2M21.5 18h-1M15.5 18h-1"],
  "/cookies-storage": ["M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3.5-3A3 3 0 0 1 14 5.5 3 3 0 0 1 12 3z", "M8.5 10.5h.01M9 15h.01M13.5 14.5h.01"],
  phone: ["M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"],
  mail: ["M3.5 6h17v12h-17z", "m3.5 6 8.5 7 8.5-7"],
  pin: ["M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z", "M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
};

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

