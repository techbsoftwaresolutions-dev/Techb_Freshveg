import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
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

// Which nav groups are collapsed, remembered across visits the same way the
// theme is. Every group starts expanded (today's behaviour) until someone
// collapses one.
function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("commerce.admin.navCollapsed") || "[]",
      );
      return new Set(Array.isArray(saved) ? saved : []);
    } catch {
      return new Set();
    }
  });

  const toggle = (group) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      try {
        localStorage.setItem(
          "commerce.admin.navCollapsed",
          JSON.stringify([...next]),
        );
      } catch {
        // Private window or storage disabled — collapsing still works for this session.
      }
      return next;
    });
  };

  // Open a group without flipping it (used to reveal the page you are on).
  const expand = (group) => {
    setCollapsed((prev) => {
      if (!prev.has(group)) return prev;
      const next = new Set(prev);
      next.delete(group);
      try {
        localStorage.setItem(
          "commerce.admin.navCollapsed",
          JSON.stringify([...next]),
        );
      } catch {
        // storage disabled — still opens for this session
      }
      return next;
    });
  };

  return [collapsed, toggle, expand];
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
  const [search, setSearch] = useState("");
  const [openTickets, setOpenTickets] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  // The bell's badge is a real count of open support tickets, refreshed
  // whenever the admin changes page — not a fixed placeholder number.
  useEffect(() => {
    if (!can("customers.view")) return;
    api
      .get("/support", { open: "true", limit: 1 })
      .then((res) => setOpenTickets(res.meta?.total || 0))
      .catch(() => {});
  }, [can, location.pathname]);

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
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="mark-img" src={`${import.meta.env.BASE_URL}logo-mark.png`} alt="" width="34" height="28" />
          <span>Hosur Basket</span>
        </div>
        <nav>
          {groups.map((group, index) => {
            const isCollapsed = !!group.group && collapsedGroups.has(group.group);
            const GroupIcon = GROUP_ICONS[group.group];
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
                  <span>{item.label}</span>
                </NavLink>
              );
            };

            if (!group.group) {
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
                  <span className="nav-group-count">{group.items.length}</span>
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
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="inline" style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 14, whiteSpace: "nowrap" }}>
              {titleFor(location.pathname)}
            </strong>
            <form
              className="topbar-search"
              onSubmit={submitSearch}
              role="search"
            >
              <IconSearch width="15" height="15" />
              <input
                type="search"
                placeholder="Search for products, orders, customers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
            <NavLink
              to="/support"
              className="btn ghost sm icon-btn notif-btn"
              title="Open support tickets"
            >
              <IconBell width="17" height="17" />
              {openTickets > 0 ? (
                <span className="notif-badge">
                  {openTickets > 99 ? "99+" : openTickets}
                </span>
              ) : null}
            </NavLink>
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
