// Small, hand-drawn line icons — 24x24 viewBox, stroke-based, sized and
// coloured by the caller via font-size/currentColor. No icon library
// dependency: everything here is plain geometry (rects, circles, paths),
// consistent with how CategoryIcon.jsx does it on the storefront.

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Svg({ children, ...props }) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconDashboard(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function IconCategories(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9.5h17M9.5 9.5v11" />
    </Svg>
  );
}

export function IconAttributes(props) {
  return (
    <Svg {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="14" y2="17" />
    </Svg>
  );
}

export function IconProducts(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5l8.5-4 8.5 4-8.5 4-8.5-4z" />
      <path d="M3.5 7.5v9l8.5 4 8.5-4v-9" />
      <path d="M12 11.5v9" />
    </Svg>
  );
}

export function IconBrands(props) {
  return (
    <Svg {...props}>
      <path d="M11.5 3.5h5a2 2 0 0 1 1.4.6l4 4a2 2 0 0 1 0 2.8l-8 8a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8l4-4a2 2 0 0 1 1.4-.6z" />
      <circle cx="15" cy="9" r="1.4" />
    </Svg>
  );
}

export function IconReviews(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.7l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
    </Svg>
  );
}

export function IconOrders(props) {
  return (
    <Svg {...props}>
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17.5" cy="19.5" r="1.3" />
      <path d="M3 4h2l1.6 10.2a2 2 0 0 0 2 1.7h8.3a2 2 0 0 0 2-1.6L20.5 7.5H6.2" />
    </Svg>
  );
}

export function IconReturns(props) {
  return (
    <Svg {...props}>
      <path d="M4 10a8 8 0 1 1 2.2 5.6" />
      <path d="M4 5v5h5" />
    </Svg>
  );
}

export function IconPayments(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="6" y1="14.5" x2="10" y2="14.5" />
    </Svg>
  );
}

export function IconInventory(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="7.5" width="17" height="13" rx="1.5" />
      <path d="M3.5 7.5l1.8-4h13.4l1.8 4" />
      <line x1="9" y1="11.5" x2="15" y2="11.5" />
    </Svg>
  );
}

export function IconDelivery(props) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="7.5" width="11" height="9" rx="1.2" />
      <path d="M13.5 10.5h3.6l3.4 3.2v2.8h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="16.5" cy="18" r="1.6" />
    </Svg>
  );
}

export function IconSupport(props) {
  return (
    <Svg {...props}>
      <path d="M4 12a8 8 0 1 1 3 6.2L4 19.5l1.1-3.4A7.9 7.9 0 0 1 4 12z" />
    </Svg>
  );
}

export function IconMaintenance(props) {
  return (
    <Svg {...props}>
      <path d="M14.7 6.3a4 4 0 0 1-5.2 5.2L4 17l3 3 5.5-5.5a4 4 0 0 1 5.2-5.2l-2.6 2.6-2-.6-.6-2z" />
    </Svg>
  );
}

export function IconCustomers(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 4.8a3 3 0 0 1 0 5.9" />
      <path d="M18.5 14.2a5.4 5.4 0 0 1 2.5 4.6" />
    </Svg>
  );
}

// Delivery Areas page: a folded map with a pin.
export function IconArea(props) {
  return (
    <Svg {...props}>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14M15 6v6" />
      <path d="M18 14.5c0 1.6-2 3.5-2 3.5s-2-1.9-2-3.5a2 2 0 0 1 4 0Z" />
    </Svg>
  );
}

// Staff accounts (Users page): a person with a shield.
export function IconTeam(props) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="8" r="3.2" />
      <path d="M4 19.5a6 6 0 0 1 9.5-4.9" />
      <path d="M18 13l3 1.2v2.6c0 1.9-1.3 3.4-3 4-1.7-.6-3-2.1-3-4v-2.6z" />
    </Svg>
  );
}

// Delivery Boys page: a rider on a scooter.
export function IconRider(props) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="17.5" r="2.2" />
      <circle cx="18" cy="17.5" r="2.2" />
      <path d="M8.2 17.5h6.4l2-5.5H13l-1.5-3H9" />
      <path d="M16.6 12l1.4 5.5" />
      <circle cx="14.5" cy="5" r="1.6" />
    </Svg>
  );
}

export function IconOffers(props) {
  return (
    <Svg {...props}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <circle cx="7.3" cy="7.3" r="2.1" />
      <circle cx="16.7" cy="16.7" r="2.1" />
    </Svg>
  );
}

export function IconBanners(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.3" cy="10" r="1.6" />
      <path d="M4.5 17l5-5 3.5 3.5 2-2 4.5 4.5" />
    </Svg>
  );
}

export function IconBell(props) {
  return (
    <Svg {...props}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.4 5.6 1.4 5.6H4.6S6 14 6 10z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function IconReports(props) {
  return (
    <Svg {...props}>
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="19" y1="20" x2="19" y2="15" />
    </Svg>
  );
}

export function IconStores(props) {
  return (
    <Svg {...props}>
      <path d="M4 9.5l1-5h14l1 5" />
      <path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      <path d="M5.5 9.8V19.5h13V9.8" />
    </Svg>
  );
}

export function IconSettings(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.2-1.6l2-1.5-1.6-2.8-2.3.9a7 7 0 0 0-2.8-1.6L13.6 3h-3.2l-.5 2.4a7 7 0 0 0-2.8 1.6l-2.3-.9-1.6 2.8 2 1.5A7 7 0 0 0 5 12c0 .5.1 1 .2 1.6l-2 1.5 1.6 2.8 2.3-.9a7 7 0 0 0 2.8 1.6l.5 2.4h3.2l.5-2.4a7 7 0 0 0 2.8-1.6l2.3.9 1.6-2.8-2-1.5c.1-.6.2-1.1.2-1.6z" />
    </Svg>
  );
}

export function IconAudit(props) {
  return (
    <Svg {...props}>
      <path d="M7 3.5h7l4 4v13h-11z" />
      <path d="M14 3.5V7.5h4" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="15.5" x2="15" y2="15.5" />
    </Svg>
  );
}

export function IconWallet(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2z" />
      <path d="M16 12.5a1.4 1.4 0 1 0 0 .1z" />
      <path d="M3.5 8.3l14-2.8" />
    </Svg>
  );
}

export function IconAlertTriangle(props) {
  return (
    <Svg {...props}>
      <path d="M12 4l9 15.5H3z" />
      <line x1="12" y1="10" x2="12" y2="14.5" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconUserPlus(props) {
  return (
    <Svg {...props}>
      <circle cx="9.5" cy="8.5" r="3.2" />
      <path d="M3.5 19.5a6 6 0 0 1 12 0" />
      <line x1="18" y1="8.5" x2="18" y2="14.5" />
      <line x1="15" y1="11.5" x2="21" y2="11.5" />
    </Svg>
  );
}

export function IconCheckCircle(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.5 2.5 5-5.2" />
    </Svg>
  );
}

export function IconChartLine(props) {
  return (
    <Svg {...props}>
      <path d="M4 18V6" />
      <path d="M4 18h16" />
      <path d="M6.5 14.5l3.5-4 3 2.5 4.5-6" />
    </Svg>
  );
}

export function IconSearch(props) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.3" y1="15.3" x2="20.5" y2="20.5" />
    </Svg>
  );
}

export function IconCalendar(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </Svg>
  );
}

export function IconShield(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.5l7 2.8v5.4c0 4.5-3 7.4-7 8.8-4-1.4-7-4.3-7-8.8V6.3z" />
      <path d="M9 12l2 2 4-4.5" />
    </Svg>
  );
}

export function IconChevronDown(props) {
  return (
    <Svg {...props}>
      <path d="M5.5 8.5L12 15l6.5-6.5" />
    </Svg>
  );
}

export function IconDownload(props) {
  return (
    <Svg {...props}>
      <path d="M12 4v10M7.5 10.5L12 15l4.5-4.5M5 19h14" />
    </Svg>
  );
}

// Stacked page blocks — the landing page's sections.
export function IconSections(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="17" height="5" rx="1.5" />
      <rect x="3.5" y="10.5" width="17" height="4" rx="1.5" />
      <rect x="3.5" y="16.5" width="10" height="4" rx="1.5" />
    </Svg>
  );
}

export function IconTrash(props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3V7" />
      <path d="M6.2 7l.9 12.1c.1 1 .9 1.9 2 1.9h5.8c1.1 0 1.9-.8 2-1.9L17.8 7" />
      <path d="M10.3 11v6M13.7 11v6" />
    </Svg>
  );
}
