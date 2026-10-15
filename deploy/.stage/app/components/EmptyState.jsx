import Link from "next/link";

// One layout for every "nothing here" moment — empty cart, no orders, no
// search results, a missing page — so they read as the same shop: a soft
// icon, a line saying what happened, a line saying what to do, and the way
// out.
export default function EmptyState({ icon = "bag", title, children, actions = [] }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {ICONS[icon] || ICONS.bag}
      </span>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {actions.length ? (
        <div className="empty-state-actions">
          {actions.map((action, index) => (
            <Link key={action.href} href={action.href} className={`btn lg${index === 0 ? " primary" : ""}`}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  width: 34,
  height: 34,
};

const ICONS = {
  bag: (
    <svg {...iconProps}>
      <path d="M6.5 8h11l1 12.2a1.8 1.8 0 0 1-1.8 1.8H7.3a1.8 1.8 0 0 1-1.8-1.8L6.5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  ),
  cart: (
    <svg {...iconProps}>
      <path d="M2.5 3.5h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.2" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  ),
  search: (
    <svg {...iconProps}>
      <circle cx="10.5" cy="10.5" r="6.2" />
      <path d="M20 20l-4.6-4.6" />
    </svg>
  ),
  box: (
    <svg {...iconProps}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  ),
  map: (
    <svg {...iconProps}>
      <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </svg>
  ),
  filter: (
    <svg {...iconProps}>
      <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z" />
    </svg>
  ),
};
