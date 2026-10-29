"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth, useCart, useStore } from "./Providers";
import { rupees } from "@/lib/format";
import { FreeDeliveryNote } from "./FreeDeliveryProgress";

const SEARCH_HINTS = ["fruits", "vegetables", "milk", "bread", "eggs", "rice", "snacks", "soap", "groceries"];

export default function Header({ categories = [] }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const cart = useCart();
  const { user, signedIn, signOut } = useAuth();
  const { store, pincode, setPincode } = useStore();

  const [term, setTerm] = useState(params.get("q") || "");
  const [pinOpen, setPinOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState(null);
  // Hover opens and closes a dropdown as the pointer moves through it, which
  // breaks the instant the pointer leaves the page to do anything else — to
  // screenshot it, say. A click on the arrow "pins" it open instead: it
  // ignores mouseleave and stays up until clicked again, something else is
  // clicked, or the route changes.
  const [pinnedCategory, setPinnedCategory] = useState(null);
  const catbarRef = useRef(null);
  const catScrollRef = useRef(null);
  const [catEdge, setCatEdge] = useState({ start: true, end: true });

  // The category strip scrolls sideways without a visible scrollbar; the
  // round arrows below it take over, and hide themselves at either end.
  useEffect(() => {
    const el = catScrollRef.current;
    if (!el) return undefined;
    const measure = () =>
      setCatEdge({
        start: el.scrollLeft <= 1,
        end: el.scrollLeft >= el.scrollWidth - el.clientWidth - 1,
      });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [categories]);

  const scrollCats = (direction) => {
    const el = catScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.6, 240), behavior: "smooth" });
  };

  // The "My Account" dropdown in the top strip.
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  useEffect(() => setAccountOpen(false), [pathname]);
  useEffect(() => {
    if (!accountOpen) return undefined;
    const onDown = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setAccountOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  // Commented out for now — the department flyout menus (Fresh Vegetables /
  // Fresh Fruits etc. opening a submenu of their subcategories) are disabled
  // header-wide. Flip this back to true to bring them back; nothing below
  // needed deleting, every category just falls back to the same plain link
  // the childless ones already use.
  const SHOW_CATEGORY_DROPDOWNS = false;

  // A landed navigation (including one from inside the dropdown itself)
  // always closes it, so it never sits open over the new page.
  useEffect(() => {
    setOpenCategory(null);
    setPinnedCategory(null);
  }, [pathname]);

  useEffect(() => {
    const onDocPointerDown = (event) => {
      if (catbarRef.current && !catbarRef.current.contains(event.target)) {
        setPinnedCategory(null);
      }
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
    };
  }, []);

  // Keep the box in step when the user lands on /search?q= from elsewhere.
  useEffect(() => {
    setTerm(params.get("q") || "");
  }, [params, pathname]);

  // On "All products" and category pages the search box filters the listing
  // in place (see ListingSearch) instead of opening the /search page.
  const onListing = pathname === "/c" || pathname.startsWith("/c/");
  const tellListing = (value) => window.dispatchEvent(new CustomEvent("listing-search", { detail: value }));

  const submit = (event) => {
    event.preventDefault();
    const q = term.trim();
    if (onListing) tellListing(q);
    else if (q.length >= 2) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  // The empty search box cycles through suggestions ("milk", "bread"…), sliding
  // up one at a time. Gone as soon as the shopper types.
  const [hint, setHint] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = setInterval(() => setHint((n) => (n + 1) % SEARCH_HINTS.length), 2600);
    return () => clearInterval(timer);
  }, []);

  // Voice search (browser speech recognition). The mic only appears where the
  // browser supports it, so it never sits there doing nothing.
  const [micOk, setMicOk] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef(null);
  useEffect(() => {
    setMicOk(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recognition.current?.abort?.();
  }, []);

  const toggleMic = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (event) => {
      const heard = (event.results?.[0]?.[0]?.transcript || "").replace(/[.?!]+$/, "").trim();
      if (!heard) return;
      setTerm(heard);
      if (onListing) tellListing(heard);
      else if (heard.length >= 2) router.push(`/search?q=${encodeURIComponent(heard)}`);
    };
    recognition.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  // Track Order, Help Center, Terms, Cart, Account and Sign In are reading pages: no category bar
  // under the search box (see CSS).
  const infoPage = ["/orders", "/help", "/terms", "/cart", "/account", "/login"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  return (
    <header className={`header${infoPage ? " header-info" : ""}`}>
      {/* The standing terms, stated once and out of the way. A shopper reads
          this on the first visit and never again, so it gets the smallest
          type on the page rather than a banner that has to be dismissed.

          Everything here is fixed copy on purpose. The store — and so its
          delivery time — is resolved by an effect after mount, and this header
          streams in behind a Suspense boundary; putting that number here means
          the server writes one value and hydration finds another. The live
          delivery time belongs on the page body, which is rendered on the
          server from the real store. */}
      <div className="utility">
        <div className="wrap utility-inner">
          <span className="utility-item utility-wide">Freshness You Can Trust</span>
          <FreeDeliveryNote className="utility-item utility-promo" withSeparator />
          <span className="utility-spacer" />
          <Link href="/help" className="utility-item utility-wide">
            <IconHelp className="utility-icon" />
            Help Center
          </Link>
          {/* The label depends on the stored session, which the server render
              cannot see — suppressHydrationWarning sits on the element whose
              own text varies. The menu itself only renders once opened, which
              is always after hydration, so it can freely depend on signedIn. */}
          <div className="account-menu" ref={accountRef}>
            <button
              type="button"
              className="utility-item account-menu-btn"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <IconUser className="utility-icon" />
              <span suppressHydrationWarning>
                {signedIn ? user.name?.split(" ")[0] || "My Account" : "My Account"}
              </span>
              <IconCaret className={`utility-caret${accountOpen ? " open" : ""}`} aria-hidden="true" />
            </button>

            {accountOpen ? (
              <div className="account-menu-pop" role="menu">
                {signedIn ? (
                  <>
                    <Link href="/account" role="menuitem">My Account</Link>
                    <Link href="/orders" role="menuitem">My Orders</Link>
                    <Link href="/account/edit" role="menuitem">Edit Profile</Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="account-menu-out"
                      onClick={() => {
                        setAccountOpen(false);
                        signOut();
                        router.push("/");
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" role="menuitem" className="account-menu-primary">Sign in / Sign up</Link>
                    <Link href="/orders" role="menuitem">Track Order</Link>
                    <Link href="/help" role="menuitem">Help Center</Link>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="wrap header-main">
        {/* Phone, on the cart page only (see globals.css): all categories. */}
        <Link href="/c" className="header-burger" aria-label="All categories">
          <IconMenu className="header-burger-icon" />
        </Link>
        <Link href="/" className="logo">
          <img src="/logo-horizontal.png" alt="Hosur Basket — your everyday supermarket" className="logo-img" width="202" height="56" />
        </Link>

        <form className="search-form" onSubmit={submit} role="search">
          <IconSearch className="search-form-icon" />
          <input
            type="search"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              if (onListing) tellListing(e.target.value);
            }}
            placeholder=""
            aria-label="Search for fruits, vegetables, groceries and more"
          />
          {term ? null : (
            <span className="search-hint" aria-hidden="true">
              <span key={hint} className="search-hint-text">
                Search for “{SEARCH_HINTS[hint]}”
              </span>
            </span>
          )}
          {micOk ? (
            <button
              type="button"
              className={`search-mic${listening ? " listening" : ""}`}
              onClick={toggleMic}
              aria-label={listening ? "Stop voice search" : "Search by voice"}
              aria-pressed={listening}
            >
              <IconMic className="search-form-submit-icon" />
            </button>
          ) : null}
        </form>

        <div className="header-actions">
          <button className="header-btn" onClick={() => setPinOpen((v) => !v)} aria-expanded={pinOpen}>
            <IconPin className="header-btn-icon" />
            <span>
              <span className="sub">Location</span>
              {/* Read from localStorage, so the server cannot know it and the
                  two renders legitimately differ. suppressHydrationWarning is
                  exactly for this — the alternative is rendering a placeholder
                  and flashing, which is worse for the one thing a shopper
                  checks first. */}
              <span className="main" suppressHydrationWarning>
                {pincode || store?.address?.city || store?.address?.pincode || "Set location"}
                <IconCaret className="header-caret" aria-hidden="true" />
              </span>
            </span>
          </button>

          <span className="header-divider" aria-hidden="true" />

          <button type="button" className="header-btn cart-btn" aria-haspopup="dialog" aria-controls="cart-drawer" onClick={() => window.dispatchEvent(new Event("open-cart"))}>
            <span className="cart-btn-icon">
              <IconCart className="header-btn-icon" />
              <span className="cart-badge" suppressHydrationWarning>
                {cart.lineCount}
              </span>
            </span>
            {/* Same story: the cart belongs to a device-scoped session the
                server render knows nothing about. */}
            <span>
              <span className="sub">Cart</span>
              <span className="main" suppressHydrationWarning>
                {rupees(cart.summary?.total)}
              </span>
            </span>
          </button>
        </div>
      </div>

      {pinOpen ? <PincodeBar onDone={() => setPinOpen(false)} setPincode={setPincode} store={store} /> : null}

      <nav className="catbar" aria-label="Categories" ref={catbarRef}>
        <div className="wrap catbar-layout">
          <div className="catbar-scroll" ref={catScrollRef}>
            <button
              type="button"
              className="catbar-arrow prev"
              onClick={() => scrollCats(-1)}
              hidden={catEdge.start}
              aria-label="Scroll categories left"
            >‹</button>
            <button
              type="button"
              className="catbar-arrow next"
              onClick={() => scrollCats(1)}
              hidden={catEdge.end}
              aria-label="Scroll categories right"
            >›</button>
            <div className="catbar-inner">
          <Link href="/c" className="catbar-all">
            <IconMenu className="catbar-all-icon" />
            All Categories
          </Link>
          {categories.map((category) => {
            // Marks the department a shopper is inside, including when they
            // are on one of its aisles — the aisle's own URL sits under it.
            const href = `/c/${category.slug}`;
            const here = pathname === href || pathname.startsWith(`${href}/`);
            const children = category.children || [];

            if (!children.length || !SHOW_CATEGORY_DROPDOWNS) {
              return (
                <Link
                  key={category.id}
                  href={href}
                  className={here ? "current" : undefined}
                  aria-current={here ? "page" : undefined}
                >
                  {category.name}
                </Link>
              );
            }

            const isOpen = openCategory === category.id || pinnedCategory === category.id;
            return (
              <div
                key={category.id}
                className="catbar-item"
                onMouseEnter={() => setOpenCategory(category.id)}
                onMouseLeave={() =>
                  setOpenCategory((current) => (current === category.id ? null : current))
                }
              >
                <Link
                  href={href}
                  className={`catbar-item-trigger${here ? " current" : ""}`}
                  aria-current={here ? "page" : undefined}
                  onClick={(event) => {
                    // Touch has no hover: the first tap reveals the list
                    // instead of jumping straight past it.
                    if (!isOpen && window.matchMedia("(hover: none)").matches) {
                      event.preventDefault();
                      setOpenCategory(category.id);
                    }
                  }}
                >
                  {category.name}
                </Link>
                <button
                  type="button"
                  className="catbar-caret-btn"
                  aria-label={`Show ${category.name} categories`}
                  aria-expanded={isOpen}
                  onClick={(event) => {
                    // Its own control, separate from the name link — a click
                    // here always toggles the list instead of navigating, and
                    // pins it open so moving the pointer away (to screenshot
                    // it, say) doesn't immediately close it again.
                    event.preventDefault();
                    setPinnedCategory((current) => (current === category.id ? null : category.id));
                  }}
                >
                  <IconCaret className="catbar-caret" aria-hidden="true" />
                </button>
                {isOpen ? <CategorySubmenu items={children} /> : null}
              </div>
            );
          })}
          <Link href="/c?sort=discount" className="catbar-offers">Offers</Link>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

function PincodeBar({ onDone, setPincode, store }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await setPincode(value);
      setResult(data);
      if (data.serviceable) setTimeout(onDone, 900);
    } catch {
      setResult({ serviceable: false, message: "Could not check that pincode." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-alt)" }}>
      <div className="wrap" style={{ padding: "14px 20px" }}>
        <form onSubmit={check} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14 }}>Check delivery:</strong>
          <input
            type="tel"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit pincode"
            style={{ width: 170 }}
            aria-label="Pincode"
          />
          <button className="btn primary" disabled={value.length !== 6 || busy}>
            {busy ? "Checking…" : "Check"}
          </button>
          {store ? (
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Currently serving from <strong>{store.name}</strong>
            </span>
          ) : null}
        </form>

        {result ? (
          <p
            className={`notice ${result.serviceable ? "save" : "error"}`}
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            {result.serviceable
              ? `We deliver here — ${result.store.name}, about ${result.prepTimeMinutes} minutes.`
              : result.message || "We don't deliver to this pincode yet."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Small inline glyphs — no icon package is installed, and these four are all
// the chrome needs.
function IconPin(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 21s-6.6-5.6-6.6-11A6.6 6.6 0 1 1 18.6 10c0 5.4-6.6 11-6.6 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}
function IconMic(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  );
}

function IconSearch(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="10.5" cy="10.5" r="6.2" />
      <path d="M20 20l-4.6-4.6" />
    </svg>
  );
}
function IconUser(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.4 3.1-6 7-6s7 2.6 7 6" />
    </svg>
  );
}
function CategorySubmenu({ items, level = 0 }) {
  const [openChild, setOpenChild] = useState(null);
  // Same click-pins-it-open fix as the top-level bar, one level down: hover
  // alone closes the moment the pointer leaves to do anything else.
  const [pinnedChild, setPinnedChild] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const onDocPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setPinnedChild(null);
      }
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, []);

  return (
    <div className={`catbar-menu${level > 0 ? " catbar-menu-nested" : ""}`} role="menu" ref={menuRef}>
      {items.map((item) => {
        const kids = item.children || [];
        const href = `/c/${item.slug}`;

        if (!kids.length) {
          return (
            <Link key={item.id} href={href} role="menuitem">
              {item.name}
            </Link>
          );
        }

        const isOpen = openChild === item.id || pinnedChild === item.id;
        return (
          <div
            key={item.id}
            className="catbar-submenu-item"
            onMouseEnter={() => setOpenChild(item.id)}
            onMouseLeave={() => setOpenChild((current) => (current === item.id ? null : current))}
          >
            <Link
              href={href}
              role="menuitem"
              className="catbar-submenu-trigger"
              onClick={(event) => {
                if (!isOpen && window.matchMedia("(hover: none)").matches) {
                  event.preventDefault();
                  setOpenChild(item.id);
                }
              }}
            >
              {item.name}
            </Link>
            <button
              type="button"
              className="catbar-caret-btn catbar-caret-btn-side"
              aria-label={`Show ${item.name} categories`}
              aria-expanded={isOpen}
              onClick={(event) => {
                event.preventDefault();
                setPinnedChild((current) => (current === item.id ? null : item.id));
              }}
            >
              <IconCaret className="catbar-caret catbar-caret-side" aria-hidden="true" />
            </button>
            {isOpen ? <CategorySubmenu items={kids} level={level + 1} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function IconCaret(props) {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 3.5L5 6.5L8 3.5" />
    </svg>
  );
}
function IconCart(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2.5 3.5h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.2" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  );
}
function IconMenu(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}
function IconTruck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2 6.5h11.5v9.5H2z" />
      <path d="M13.5 10h4.2l3.3 3.2V16h-7.5" />
      <circle cx="6.5" cy="17.8" r="1.7" />
      <circle cx="17" cy="17.8" r="1.7" />
    </svg>
  );
}
function IconHelp(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" />
      <path d="M12 17h.01" />
    </svg>
  );
}
