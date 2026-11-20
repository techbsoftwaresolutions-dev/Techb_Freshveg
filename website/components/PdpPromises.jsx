// "Why Choose Hosur Basket?" — three short promises under the buy box.
const ROWS = [
  {
    // leaf + sprout: fresh produce
    icon: (
      <>
        <path d="M12 21v-8" />
        <path d="M12 13c0-4 2.6-7 7-8 .6 4.6-2 8-7 8z" />
        <path d="M12 15c0-3-2-5.4-6-6 0 3.6 2.2 6 6 6z" />
      </>
    ),
    title: "Farm-fresh daily",
    body: "Fresh fruits, vegetables and groceries.",
  },
  {
    // price tag with a heart: quality at best prices
    icon: (
      <>
        <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
        <circle cx="7.5" cy="7.5" r="1.2" />
        <path d="M13.2 14.6c-1.5-1.1-2.4-1.9-2.4-2.9a1.4 1.4 0 0 1 2.4-.9 1.4 1.4 0 0 1 2.4.9c0 1-.9 1.8-2.4 2.9z" />
      </>
    ),
    title: "Best prices",
    body: "Everyday deals and offers.",
  },
  {
    // shopping basket: everything in one place
    icon: (
      <>
        <path d="M3 10h18l-1.8 9a2 2 0 0 1-2 1.6H6.8a2 2 0 0 1-2-1.6L3 10z" />
        <path d="M8 10l3-6M16 10l-3-6" />
        <path d="M9 14v3M12 14v3M15 14v3" />
      </>
    ),
    title: "One basket",
    body: "Everything you need in one place.",
  },
];

export default function PdpPromises() {
  return (
    <section className="pdp-promises" aria-label="Why choose Hosur Basket">
      <h2>Why Hosur Basket?</h2>
      <ul>
        {ROWS.map((r, i) => (
          <li key={r.title}>
            <span className={`pdp-promise-icon tone-${i}`}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {r.icon}
              </svg>
            </span>
            <span><strong>{r.title}</strong><small>{r.body}</small></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
