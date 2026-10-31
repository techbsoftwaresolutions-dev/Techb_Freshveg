import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import NotificationBell from "./NotificationBell";
import {
  IconDashboard,
  IconCalendar,
  IconCategories,
  IconProducts,
  IconBrands,
  IconReviews,
  IconOrders,
  IconReturns,
  IconPayments,
  IconInventory,
  IconDelivery,
  IconSupport,
  IconMaintenance,
  IconCustomers,
  IconOffers,
  IconBanners,
  IconBell,
  IconReports,
  IconStores,
  IconShield,
  IconSettings,
  IconAudit,
  IconSearch,
  IconChevronDown,
} from "./Icons";

// The nav is declared as data and filtered by permission, so a role that
// cannot touch inventory simply never sees the section — no route-level
// surprises after a click.
const NAV = [
  {
    group: null,
    items: [
      {
        to: "/",
        label: "Dashboard",
        end: true,
        permission: null,
        icon: IconDashboard,
      },
    ],
  },
  {
    group: "Catalog",
    items: [
      {
        to: "/catalog/categories",
        label: "Categories",
        permission: "catalog.view",
        icon: IconCategories,
      },
      {
        to: "/catalog/products",
        label: "Products",
        permission: "catalog.view",
        icon: IconProducts,
      },
      {
        to: "/catalog/brands",
        label: "Brands",
        permission: "catalog.view",
        icon: IconBrands,
      },
      {
        to: "/catalog/reviews",
        label: "Reviews",
        permission: "catalog.view",
        icon: IconReviews,
      },
    ],
  },
  {
    group: "Orders",
    items: [
      {
        to: "/orders",
        label: "All Orders",
        badge: "pending",
        permission: "orders.view",
        icon: IconOrders,
      },
      {
        to: "/returns",
        label: "Returns",
        permission: "orders.view",
        icon: IconReturns,
      },
      {
        to: "/payments",
        label: "Payments",
        permission: "orders.view",
        icon: IconPayments,
      },
    ],
  },
  {
    group: "Operations",
    items: [
      {
        to: "/inventory",
        label: "Inventory",
        badge: "lowStock",
        permission: "inventory.view",
        icon: IconInventory,
      },
      {
        to: "/delivery",
        label: "Delivery",
        permission: "delivery.view",
        icon: IconDelivery,
      },
      {
        to: "/support",
        label: "Support",
        badge: "tickets",
        permission: "customers.view",
        icon: IconSupport,
      },
      {
        to: "/maintenance",
        label: "Maintenance",
        permission: "settings.manage",
        icon: IconMaintenance,
      },
    ],
  },
  {
    group: "Customers",
    items: [
      {
        to: "/customers",
        label: "Customers",
        permission: "customers.view",
        icon: IconCustomers,
      },
    ],
  },
  {
    group: "Growth",
    items: [
      {
        to: "/marketing/offers",
        label: "Offers & Coupons",
        permission: "marketing.view",
        icon: IconOffers,
      },
      {
        to: "/marketing/banners",
        label: "Banners",
        permission: "marketing.view",
        icon: IconBanners,
      },
      {
        to: "/marketing/notifications",
        label: "Notifications",
        permission: "marketing.view",
        icon: IconBell,
      },
    ],
  },
  {
    group: "Reports",
    items: [
      {
        to: "/reports",
        label: "Reports",
        permission: "reports.view",
        icon: IconReports,
      },
    ],
  },
  {
    group: "Settings",
    items: [
      {
        to: "/settings/stores",
        label: "Stores",
        permission: "settings.manage",
        icon: IconStores,
      },
      {
        to: "/settings/general",
        label: "General",
        permission: "settings.manage",
        icon: IconSettings,
      },
      {
        to: "/settings/users",
        label: "Users",
        permission: "users.manage",
        icon: IconShield,
      },
      {
        to: "/settings/audit",
        label: "Audit Log",
        permission: "reports.view",
        icon: IconAudit,
      },
    ],
  },
];

// Icon shown on each expandable group header.
const GROUP_ICONS = {
  Catalog: IconCategories,
  Orders: IconOrders,
  Operations: IconInventory,
  Customers: IconCustomers,
  Growth: IconOffers,
  Reports: IconReports,
  Settings: IconSettings,
};

function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("commerce.admin.theme") || "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("commerce.admin.theme", theme);
    } catch {
      // A private window can refuse storage; the theme still applies for this session.
    }
  }, [theme]);

  return [theme, setTheme];
}

// Which nav groups are collapsed, remembered across visits. The sidebar works
// like an accordion: opening a group closes the others, so the menu never
// grows taller than the screen. Until someone picks, only the group holding
// the current page is open (the layout effect below opens it).
const GROUP_NAMES = NAV.map((g) => g.group).filter(Boolean);
const NAV_KEY = "commerce.admin.navCollapsed";

function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NAV_KEY) || "null");
      if (Array.isArray(saved)) return new Set(saved);
    } catch {
      // fall through to the default
    }
    return new Set(GROUP_NAMES);
  });

  const save = (next) => {
    try {
      localStorage.setItem(NAV_KEY, JSON.stringify([...next]));
    } catch {
      // Private window or storage disabled — it still works for this session.
    }
  };

  const onlyOpen = (group) => {
    const next = new Set(GROUP_NAMES.filter((name) => name !== group));
    save(next);
    return next;
  };

  const toggle = (group) => {
    setCollapsed((prev) => {
      if (prev.has(group)) return onlyOpen(group);
      const next = new Set(prev);
      next.add(group);
      save(next);
      return next;
    });
  };

  // Open a group without flipping it (used to reveal the page you are on).
  const expand = (group) => {
    setCollapsed((prev) => (prev.has(group) ? onlyOpen(group) : prev));
  };

  return [collapsed, toggle, expand];
}

// Live numbers shown beside Orders, Inventory and Support, refreshed every
// minute: what needs attention, not how many pages a menu holds.
function useNavBadges(can) {
  const [badges, setBadges] = useState({});
  useEffect(() => {
    let alive = true;
    const load = () => {
      Promise.all([
        can("reports.view") ? api.get("/reports/dashboard").catch(() => null) : null,
        can("customers.view") ? api.get("/support", { open: "true", limit: 1 }).catch(() => null) : null,
      ]).then(([dash, tix]) => {
        if (!alive) return;
        setBadges({
          pending: dash?.lifetime?.pendingOrders || 0,
          lowStock: dash?.lowStockCount || 0,
          tickets: tix?.meta?.total || 0,
        });
      });
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [can]);
  return badges;
}

// A real, ticking clock for the topbar — not a screenshot-time string.
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Layout() {
  const { user, signOut, can } = useAuth();
  const [theme, setTheme] = useTheme();
  const [collapsedGroups, toggleGroup, expandGroup] = useCollapsedGroups();
  const location = useLocation();
  const navigate = useNavigate();
  const now = useClock();
  const badges = useNavBadges(can);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  // The hamburger: hides the sidebar on a desktop, opens it as a drawer on a phone.
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [navDrawer, setNavDrawer] = useState(false);
  const toggleNav = () => {
    if (window.matchMedia("(max-width: 720px)").matches) setNavDrawer((open) => !open);
    else setNavCollapsed((hidden) => !hidden);
  };
  // Going to a page closes the phone drawer.
  useEffect(() => setNavDrawer(false), [location.pathname]);

  // Closes the profile dropdown on an outside click or Escape, same as any
  // native menu would, rather than leaving it open until the next reload.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const submitSearch = (event) => {
    event.preventDefault();
    const q = search.trim();
    if (q) navigate(`/catalog/products?search=${encodeURIComponent(q)}`);
  };

  const initials = (user?.name || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || can(item.permission),
    ),
  })).filter((group) => group.items.length);

  // Reveal the group that contains the page you are on.
  useEffect(() => {
    const here = groups.find(
      (g) =>
        g.group &&
        g.items.length > 1 &&
        g.items.some((item) =>
          item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to),
        ),
    );
    if (here) expandGroup(here.group);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className={`shell${navCollapsed ? " nav-collapsed" : ""}${navDrawer ? " nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="mark-img" src={`${import.meta.env.BASE_URL}logo-mark.png`} alt="" width="46" height="38" />
          <div className="brand-text">
            <strong>
              Hosur<span>Basket</span>
            </strong>
            <small>Your everyday supermarket</small>
          </div>
        </div>
        <nav>
          {groups.map((group, index) => {
            const isCollapsed = !!group.group && collapsedGroups.has(group.group);
            const GroupIcon = GROUP_ICONS[group.group];
            const groupAlert = group.items.reduce((n, item) => n + (item.badge ? badges[item.badge] || 0 : 0), 0);
            const renderItem = (item) => {
              const ItemIcon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  tabIndex={isCollapsed ? -1 : undefined}
                  className={({ isActive }) =>
                    `nav-item${isActive ? " active" : ""}`
                  }
                >
                  {ItemIcon ? <ItemIcon className="nav-item-icon" /> : null}
                  <span className="nav-item-label">{item.label}</span>
                  {item.badge && badges[item.badge] > 0 ? (
                    <span className={`nav-badge ${item.badge === "pending" ? "amber" : item.badge === "lowStock" ? "red" : "blue"}`}>
                      {badges[item.badge] > 99 ? "99+" : badges[item.badge]}
                    </span>
                  ) : null}
                </NavLink>
              );
            };

            // A group with a single page is just a link; a folder holding one
            // item with the same name only adds a click.
            if (!group.group || group.items.length === 1) {
              return (
                <div className="nav-top" key={index}>
                  {group.items.map(renderItem)}
                </div>
              );
            }

            return (
              <div
                key={group.group}
                className={`nav-group${isCollapsed ? "" : " open"}`}
              >
                <button
                  type="button"
                  className="nav-group-label"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleGroup(group.group)}
                >
                  {GroupIcon ? <GroupIcon className="nav-group-icon" /> : null}
                  <span className="nav-group-title">{group.group}</span>
                  {groupAlert > 0 ? (
                    <span className="nav-group-count alert">{groupAlert > 99 ? "99+" : groupAlert}</span>
                  ) : null}
                  <svg
                    className="nav-group-chevron"
                    width="12"
                    height="12"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 3.5L5 6.5L8 3.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div className="nav-group-body" aria-hidden={isCollapsed}>
                  <div className="nav-group-inner">
                    {group.items.map(renderItem)}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initials}</div>
          <div className="sidebar-user-text">
            <strong>{user?.name}</strong>
            <small>{user?.role?.replace(/_/g, " ")}</small>
          </div>
          <button type="button" className="sidebar-signout" onClick={signOut} title="Sign out" aria-label="Sign out">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
          </button>
        </div>

        <div className="sidebar-art" aria-hidden="true">
          <svg viewBox="0 0 220 150" width="100%" height="150" fill="none">
            <path d="M34 150C14 142 6 118 18 92c18 8 28 26 26 46-1 4-3 8-4 12Z" fill="#3fae5a" opacity=".9" />
            <path d="M44 150c-2-24 8-52 34-66 4 34-8 56-30 66h-4Z" fill="#2e8f47" />
            <path d="M18 150c-8-18-6-40 6-58 10 18 10 40 0 58h-6Z" fill="#6fcf7c" opacity=".85" />
            <path d="M70 150c6-14 18-24 34-26-2 14-14 24-30 26h-4Z" fill="#59c06c" opacity=".8" />
            <circle cx="62" cy="138" r="11" fill="#e0382f" />
            <path d="M56 130c3-3 8-3 12 0-3 1-5 3-6 5-2-2-4-4-6-5Z" fill="#2e8f47" />
          </svg>
          <p>
            Fresh Products
            <br />
            Healthy Life
          </p>
        </div>
      </aside>

      <div className="nav-backdrop" onClick={() => setNavDrawer(false)} />

      <div className="main">
        <header className="topbar">
          <div className="inline" style={{ flex: 1, minWidth: 0 }}>
            <button type="button" className="topbar-burger" onClick={toggleNav} aria-label="Toggle menu">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </button>
            <form
              className="topbar-search"
              onSubmit={submitSearch}
              role="search"
            >
              <input
                type="search"
                placeholder="Search for products, orders, customers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="topbar-search-submit" aria-label="Search">
                <IconSearch width="15" height="15" />
              </button>
            </form>
          </div>
          <div className="topbar-right">
            <div className="clock" title={now.toLocaleString("en-IN")}>
              <IconCalendar width="14" height="14" />
              <span>
                {now.toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
                {" · "}
                {now.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <button
              type="button"
              className="btn ghost sm icon-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <NotificationBell />
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-menu-trigger"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <div className="stack" style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 550, fontSize: 13 }}>
                    {user?.name}
                  </span>
                  <span className="faint" style={{ fontSize: 11 }}>
                    {user?.role?.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="avatar">{initials}</div>
                <IconChevronDown
                  width="13"
                  height="13"
                  className={`user-menu-chevron${menuOpen ? " open" : ""}`}
                  style={{ color: "var(--text-faint)" }}
                />
              </button>
              {menuOpen ? (
                <div className="user-menu-panel" role="menu">
                  <button
                    type="button"
                    className="user-menu-item"
                    role="menuitem"
                    onClick={signOut}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}

function titleFor(pathname) {
  if (pathname === "/") return "Dashboard";
  const map = {
    "/catalog/categories": "Categories",
    "/catalog/attributes": "Attributes",
    "/catalog/products": "Products",
    "/catalog/brands": "Brands",
    "/catalog/reviews": "Product Reviews",
    "/orders": "Orders",
    "/returns": "Returns",
    "/payments": "Payments",
    "/inventory": "Inventory",
    "/delivery": "Delivery",
    "/support": "Support",
    "/maintenance": "Maintenance",
    "/customers": "Customers",
    "/marketing/offers": "Offers & Coupons",
    "/marketing/banners": "Banners",
    "/marketing/notifications": "Notifications",
    "/reports": "Reports",
    "/settings/stores": "Stores",
    "/settings/general": "General Settings",
    "/settings/users": "Users",
    "/settings/audit": "Audit Log",
  };
  const match = Object.keys(map)
    .filter((key) => pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return map[match] || "Hosur Basket Admin";
}
