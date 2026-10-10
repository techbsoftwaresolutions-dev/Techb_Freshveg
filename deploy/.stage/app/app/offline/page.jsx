import Link from "next/link";

export const metadata = {
  title: "You're offline",
  robots: { index: false },
};

// Cached by the service worker at install, and shown in place of any page the
// network cannot deliver. Static on purpose — it has to render with nothing
// but what is already on the phone.
export default function OfflinePage() {
  return (
    <div className="wrap">
      <div className="offline">
        <span className="offline-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8.8a15 15 0 0 1 4.2-2.6M9.8 5.2A15 15 0 0 1 22 8.8" />
            <path d="M5 12.5a10 10 0 0 1 3.4-2.1M13.3 10A10 10 0 0 1 19 12.5" />
            <path d="M8.5 16a5 5 0 0 1 7 0" />
            <path d="M12 19.5h.01" />
            <path d="M3 3l18 18" />
          </svg>
        </span>
        <h1>You're offline</h1>
        <p>Check your internet connection. Your cart is saved and will be right here when you're back.</p>
        <Link href="/" className="btn primary lg">
          Try again
        </Link>
      </div>
    </div>
  );
}
