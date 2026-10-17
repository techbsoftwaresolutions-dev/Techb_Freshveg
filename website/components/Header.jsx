"use client";

import Link from "next/link";
import Icon from "./Icon";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useBranding, useCart, useStore } from "./Providers";
import { rupees } from "@/lib/format";
import { api } from "@/lib/client-api";


export default function Header({ categories = [] }) {
  const brand = useBranding();
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const cart = useCart();
  const { user, signedIn } = useAuth();
  const { store, pincode, area, setPincode, locationNotice, ready: storeReady } = useStore();

  const [term, setTerm] = useState(params.get("q") || "");
  const [searchFocused, setSearchFocused] = useState(false);
  const typedPlaceholder = useTypedPlaceholder(!term && !searchFocused);
  const [pinOpen, setPinOpen] = useState(false);
  const closePin = useCallback(() => setPinOpen(false), []);
  // No delivery location yet (or the saved one stopped being served): open
  // the picker once per visit rather than on every page.
  useEffect(() => {
    if (!storeReady || pincode) return;
    // A saved area that has been switched off always says so.
    if (locationNotice) {
      setPinOpen(true);
      return;
    }
    try {
      if (sessionStorage.getItem("commerce.web.locationPrompted")) return;
      sessionStorage.setItem("commerce.web.locationPrompted", "1");
    } catch {
      return; // no storage: don't risk prompting on every page
    }
    setPinOpen(true);
  }, [storeReady, pincode, locationNotice]);
  const [openCategory, setOpenCategory] = useState(null);
  // Hover opens and closes a dropdown as the pointer moves through it, which
  // breaks the instant the pointer leaves the page to do anything else — to
  // screenshot it, say. A click on the arrow "pins" it open instead: it
  // ignores mouseleave and stays up until clicked again, something else is
  // clicked, or the route changes.
  const [pinnedCategory, setPinnedCategory] = useState(null);
  const catbarRef = useRef(null);

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
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, []);

  // Keep the box in step when the user lands on /search?q= from elsewhere.
  useEffect(() => {
    setTerm(params.get("q") || "");
  }, [params, pathname]);

  // On "All products" and category pages the search box filters the listing
  // in place (see ListingSearch) instead of opening the /search page.
  const onListing = pathname === "/c" || pathname.startsWith("/c/");
  const showCatbar = showsCategoryBar(pathname);
  const tellListing = (value) => window.dispatchEvent(new CustomEvent("listing-search", { detail: value }));

  const submit = (event) => {
    event.preventDefault();
    const q = term.trim();
    if (onListing) tellListing(q);
    else if (q.length >= 2) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className={showCatbar ? "header" : "header no-catbar"}>
      <div className="wrap header-main">
        {/* Phone, on the cart page only (see globals.css): all categories. */}
        <Link href="/c" className="header-burger" aria-label="All categories">
          <IconMenu className="header-burger-icon" />
        </Link>
        <Link href="/" className="logo">
          {/* The artwork carries a wide white margin; .logo crops it so the
              basket and wordmark fill the header row. */}
          {/* The logo uploaded in Admin → Settings → Branding, else the bundled one. */}
          <img src={brand.logo} alt="The Farmers Basket" className="logo-img" />
        </Link>

        {/* Account, help and policy pages are for reading, not shopping: no search box. */}
        {NO_SEARCH.test(pathname || "/") ? null : (
        <form className="search-form" onSubmit={submit} role="search">
          <input
            type="search"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              if (onListing) tellListing(e.target.value);
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={typedPlaceholder}
            aria-label="Search products"
          />
          <button type="submit" aria-label="Search">
            <IconSearch className="search-form-submit-icon" />
          </button>
        </form>
        )}

        <div className="header-actions">
          <div className="pin-anchor">
            <button
              className="header-btn"
              onClick={() => setPinOpen((v) => !v)}
              aria-expanded={pinOpen}
              aria-haspopup="dialog"
            >
              <IconPin className="header-btn-icon" />
              <span>
                <span className="sub">Deliver to</span>
                {/* Read from localStorage, so the server cannot know it and the
                    two renders legitimately differ. suppressHydrationWarning is
                    exactly for this — the alternative is rendering a placeholder
                    and flashing, which is worse for the one thing a shopper
                    checks first. */}
                <span className="main" suppressHydrationWarning>
                  {area || pincode || store?.address?.city || store?.address?.pincode || "Set location"}
                  <IconCaret className="header-caret" aria-hidden="true" />
                </span>
              </span>
            </button>
            {pinOpen ? (
              <PincodePopover onDone={closePin} setPincode={setPincode} store={store} notice={locationNotice} />
            ) : null}
          </div>

          <span className="header-divider" aria-hidden="true" />

          {/* Phone: these two live in the bottom tab bar instead (globals.css). */}
          <Link href="/orders" className="header-btn header-extra">
            <Icon name="orders" className="header-btn-icon" />
            <span>
              <span className="sub">Returns &amp;</span>
              <span className="main">Orders</span>
            </span>
          </Link>

          {/* Always /account, even signed out: the destination must not depend
              on client-only state, or the server and client render different
              hrefs and hydration fails. /account redirects to /login by
              itself, so the behaviour is identical either way. */}
          <Link href="/account" className="header-btn header-extra">
            <Icon name="account" className="header-btn-icon" />
            {/* The label depends on the stored session, which the server
                render cannot see — suppressHydrationWarning sits on the
                element whose own text varies. */}
            <span>
              <span className="sub" suppressHydrationWarning>
                {signedIn ? `Hello, ${user.name?.split(" ")[0] || "there"}` : "Hello, sign in"}
              </span>
              <span className="main">
                Account
                <IconCaret className="header-caret" aria-hidden="true" />
              </span>
            </span>
          </Link>

          <span className="header-divider" aria-hidden="true" />

          <Link href="/cart" className="header-btn cart-btn">
            <span className="cart-btn-icon">
              <Icon name="cart" className="header-btn-icon" />
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
          </Link>
        </div>
      </div>

      {showCatbar ? (
      <nav className="catbar" aria-label="Categories" ref={catbarRef}>
        <div className="wrap catbar-inner">
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
          <span className="catbar-spacer" />
          <Link href="/c?sort=discount" className="catbar-offers">
            Offers
          </Link>
        </div>
      </nav>
      ) : null}
    </header>
  );
}

// The category bar is for browsing: Home and the category listings only —
// /c and /c/<slug> (departments and their aisles share that one route).
// Everywhere else (cart, account, policies, product pages, 404s…) it is left
// out. The query string never counts: usePathname doesn't include it.
const NO_SEARCH =
  /^\/(account|help|terms|privacy-policy|terms-and-conditions|refund-cancellation-policy|shipping-delivery-policy|referral-terms|account-deletion|cookies-storage|delivery-app-privacy|delivery-app-terms)(\/|$)/;

export function showsCategoryBar(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  return path === "/" || path === "/c" || /^\/c\/[^/]+$/.test(path);
}

// What layout.jsx shows while the header streams in: the header's height, with
// or without the bar, so the page doesn't jump when it arrives.
export function HeaderPlaceholder() {
  const pathname = usePathname();
  return <div className={showsCategoryBar(pathname) ? undefined : "no-catbar"} style={{ height: "var(--header-total)" }} />;
}

// The search box's placeholder types itself out, one product at a time
// ("Search for "Tomatoes"", erased, then "Search for "Fresh milk""…), while the
// box is empty and not in use. Focused, or for anyone who prefers reduced
// motion, it is a plain static hint.
const SEARCH_PREFIX = "Search for ";
const SEARCH_WORDS = [
  "“Tomatoes”",
  "“Fresh milk”",
  "“Spinach”",
  "“Organic vegetables”",
  "“Carrots”",
  "“Bananas”",
  "“Coriander”",
  "“Paneer”",
];
const SEARCH_STATIC = "Search vegetables, fruits, milk and more…";

function useTypedPlaceholder(active) {
  const [text, setText] = useState(SEARCH_STATIC);

  useEffect(() => {
    if (!active) {
      setText(SEARCH_STATIC);
      return undefined;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let word = 0;
    let chars = 0;
    let deleting = false;
    let timer;
    const tick = () => {
      const full = SEARCH_WORDS[word];
      if (!deleting) {
        chars += 1;
        setText(SEARCH_PREFIX + full.slice(0, chars));
        if (chars === full.length) {
          deleting = true;
          timer = setTimeout(tick, 1600); // hold the finished word
          return;
        }
        timer = setTimeout(tick, 85);
      } else {
        chars -= 1;
        setText(SEARCH_PREFIX + full.slice(0, chars));
        if (chars === 0) {
          deleting = false;
          word = (word + 1) % SEARCH_WORDS.length;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 40);
      }
    };
    setText(SEARCH_PREFIX);
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [active]);

  return text;
}

// The delivery check: a small pop-up under "Deliver to". The shopper types an
// area, city or pincode and picks from the areas the shop delivers to (Admin →
// Delivery Areas, fetched fresh each time it opens), or checks a 6-digit
// pincode directly. Closes on a click outside, on Escape, or shortly after a
// served area is confirmed.
function PincodePopover({ onDone, setPincode, store, notice }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [areas, setAreas] = useState([]);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let live = true;
    api
      .get("/stores/service-areas")
      .then((data) => live && setAreas(data.areas || []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const query = value.trim().toLowerCase();
  const matches = areas
    .filter(
      (a) =>
        !query ||
        a.pincode.startsWith(query) ||
        [a.name, a.city, a.state].some((field) => (field || "").toLowerCase().includes(query))
    )
    .slice(0, 8);
  const isPincode = /^\d{6}$/.test(value.trim());

  useEffect(() => {
    inputRef.current?.focus();
    const onPointerDown = (event) => {
      // Clicks on the "Deliver to" button itself toggle it; leave those alone.
      if (boxRef.current && !boxRef.current.parentElement.contains(event.target)) onDone();
    };
    const onKey = (event) => {
      if (event.key === "Escape") onDone();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onDone]);

  const choose = async (code, name, id) => {
    setBusy(true);
    try {
      const data = await setPincode(code, name, id);
      setResult({ ...data, picked: name || data.areas?.[0] || "", pincode: code });
      if (data.serviceable) setTimeout(onDone, 900);
    } catch {
      setResult({ serviceable: false, message: "Could not check that pincode." });
    } finally {
      setBusy(false);
    }
  };

  const check = (event) => {
    event.preventDefault();
    if (isPincode) choose(value.trim());
    else if (matches.length) choose(matches[0].pincode, matches[0].name, matches[0].id);
  };

  return (
    <div className="pin-pop" role="dialog" aria-label="Check delivery" ref={boxRef}>
      <div className="pin-pop-head">
        <strong>Check delivery</strong>
        <button type="button" className="pin-pop-close" onClick={onDone} aria-label="Close">
          ×
        </button>
      </div>
      <form onSubmit={check} className="pin-pop-form">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.slice(0, 40));
            setResult(null);
          }}
          placeholder="Area, city or pincode"
          aria-label="Area, city or pincode"
          autoComplete="off"
        />
        <button className="btn primary" disabled={(!isPincode && !(query && matches.length)) || busy}>
          {busy ? "Checking…" : "Check"}
        </button>
      </form>

      {notice && !result ? <p className="pin-pop-result no">{notice}</p> : null}

      {!result && matches.length ? (
        <ul className="pin-pop-areas" aria-label="Areas we deliver to">
          {matches.map((a) => (
            <li key={a.id || `${a.pincode}-${a.name}`}>
              <button type="button" onClick={() => choose(a.pincode, a.name, a.id)} disabled={busy}>
                <IconPin className="pin-pop-area-icon" />
                <span className="pin-pop-area-name">
                  {a.name || `Pincode ${a.pincode}`}
                  {a.city && a.city !== a.name ? <span className="pin-pop-area-city">, {a.city}</span> : null}
                </span>
                <span className="pin-pop-area-code">{a.pincode}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!result && query && !matches.length && !isPincode ? (
        <p className="pin-pop-result no">No delivery area matches “{value.trim()}”. Try your pincode.</p>
      ) : null}

      {result ? (
        <p className={`pin-pop-result ${result.serviceable ? "ok" : "no"}`}>
          {result.serviceable
            ? `We deliver to ${result.picked ? `${result.picked} (${result.pincode})` : result.pincode} — about ${result.prepTimeMinutes} minutes.`
            : result.message || "We don't deliver to this pincode yet."}
        </p>
      ) : !matches.length && store ? (
        <p className="pin-pop-note">
          Currently serving from <strong>{store.name}</strong>
        </p>
      ) : null}
    </div>
  );
}

// Small inline glyphs for the chrome; the brand icons (cart, account,
// orders) come from ./Icon.
function IconPin(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 21s-6.6-5.6-6.6-11A6.6 6.6 0 1 1 18.6 10c0 5.4-6.6 11-6.6 11Z" />
      <circle cx="12" cy="10" r="2.3" />
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
function IconMenu(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}
