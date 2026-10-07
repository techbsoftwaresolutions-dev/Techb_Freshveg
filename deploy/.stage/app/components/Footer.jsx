import Link from "next/link";

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
              <FooterMark />
              <span>
                <span className="footer-logo-name">Hosur Basket</span>
                <span className="footer-logo-tag">Fresh Food • Better Life</span>
              </span>
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
              <li><a href="tel:+919003597158">Contact Us</a></li>
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
                <a href="tel:+919003597158">+91 90035 97158</a>
              </li>
              <li>
                <a href="https://hosurbasket.com">hosurbasket.com</a>
              </li>
              <li>Hosur, Tamil Nadu</li>
            </ul>
          </div>
        </div>

        <div className="footer-base">
          <span>© {new Date().getFullYear()} Hosur Basket. All rights reserved.</span>
          <span>Prices include all taxes</span>
        </div>
      </div>
    </footer>
  );
}

function FooterMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="footer-mark">
      <path d="M22 44C9 42 2 31 4 14c11 1 19 8 20 20 0 4-1 7-2 10Z" fill="#6cc070" />
      <path d="M24 44c1-14 7-26 20-32 2 17-5 29-18 32h-2Z" fill="#a5d6a7" />
    </svg>
  );
}
