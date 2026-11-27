import Link from "next/link";
import { getCategories, getStores, SITE_URL } from "@/lib/api";
import { withRetry } from "@/lib/seo";

// A crawlable page for local searches ("grocery delivery in Hosur", "vegetables near Avalapalli"):
// which areas and pincodes Hosur Basket delivers to, with links into the shop. Built from the
// stores' real service areas (Admin -> Settings -> Stores), so it is never out of date.
export const revalidate = 300;

export const metadata = {
  title: "Online grocery delivery in Hosur - areas we serve",
  description:
    "Hosur Basket delivers fresh fruit, vegetables and groceries across Hosur. See the areas and pincodes we serve and order online for same-day delivery.",
  alternates: { canonical: "/delivery-areas" },
};

export default async function DeliveryAreasPage() {
  const [storeData, categoryData] = await Promise.all([
    withRetry(getStores, (r) => r?.stores?.length),
    withRetry(getCategories, (r) => r?.categories?.length),
  ]);
  const stores = storeData?.stores || [];
  const departments = (categoryData?.categories || []).slice(0, 10);

  // Area names grouped under their pincode, de-duplicated across stores.
  const byPincode = new Map();
  const add = (pincode, area) => {
    if (!pincode) return;
    if (!byPincode.has(pincode)) byPincode.set(pincode, new Set());
    if (area) byPincode.get(pincode).add(area);
  };
  for (const store of stores) {
    (store.servicePincodes || []).forEach((pin) => add(pin));
    (store.pincodeAreas || []).forEach((a) => add(a.pincode, a.area));
  }
  const rows = [...byPincode.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pincode, areas]) => ({ pincode, areas: [...areas] }));

  // Answers use the store's own settings, so they stay true when the charges change in the admin.
  const rupees = (paise) => `₹${Math.round(paise / 100)}`;
  const settings = stores[0]?.settings || {};
  const charge = settings.deliveryCharge || 0;
  const freeAbove = settings.freeDeliveryEnabled !== false ? settings.freeDeliveryAbove || 0 : 0;
  const deliveryAnswer = [
    freeAbove ? `Delivery is free on orders above ${rupees(freeAbove)}.` : charge ? "" : "Delivery is free.",
    charge ? `${freeAbove ? "Below that, delivery" : "Delivery"} costs ${rupees(charge)}.` : "",
    settings.minOrderValue ? `The minimum order is ${rupees(settings.minOrderValue)}.` : "",
    "The exact charge for your address is shown at checkout.",
  ].filter(Boolean).join(" ");
  const areaList = rows.map((row) => (row.areas.length ? `${row.areas.join(", ")} (${row.pincode})` : row.pincode)).join("; ");
  const faq = [
    {
      q: "Does Hosur Basket deliver to my area in Hosur?",
      a: rows.length
        ? `We deliver to: ${areaList}. Enter your pincode on the home page to check your address.`
        : "Enter your pincode on the home page to check whether we deliver to your address.",
    },
    {
      q: "Can I order vegetables and fruits online in Hosur?",
      a: "Yes. Order fresh vegetables, fruits and everyday groceries online at Hosur Basket and get same-day delivery in Hosur.",
    },
    { q: "What are the delivery charges?", a: deliveryAnswer },
    departments.length
      ? { q: "What can I buy at Hosur Basket?", a: `Shop ${departments.map((d) => d.name).join(", ")} and more.` }
      : null,
  ].filter(Boolean);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GroceryStore",
    name: "Hosur Basket",
    url: SITE_URL,
    areaServed: rows.length
      ? rows.map((row) => ({
          "@type": "Place",
          name: row.areas.length ? row.areas.join(", ") : `Hosur ${row.pincode}`,
          address: { "@type": "PostalAddress", postalCode: row.pincode, addressLocality: "Hosur", addressRegion: "Tamil Nadu", addressCountry: "IN" },
        }))
      : "Hosur",
  };

  return (
    <div className="wrap" style={{ maxWidth: 860, paddingBottom: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {" › "}Delivery areas
      </nav>

      <h1>Online grocery delivery in Hosur</h1>
      <p>
        Hosur Basket brings fresh fruit, vegetables, groceries, personal care and household essentials to your door in
        Hosur, with same-day delivery from our store at GKD Nagar, Avalapalli Road, Hosur 635109. Choose your area at
        checkout and we show the delivery time and charge for it.
      </p>

      <h2>Areas and pincodes we deliver to</h2>
      {rows.length ? (
        <ul style={{ lineHeight: 1.8, paddingLeft: 20 }}>
          {rows.map((row) => (
            <li key={row.pincode}>
              <strong>{row.pincode}</strong>
              {row.areas.length ? ` — ${row.areas.join(", ")}` : " — Hosur"}
            </li>
          ))}
        </ul>
      ) : (
        <p>Enter your pincode on the home page to check whether we deliver to you.</p>
      )}

      {departments.length ? (
        <>
          <h2>Shop by department</h2>
          <ul style={{ display: "flex", flexWrap: "wrap", gap: 10, listStyle: "none", padding: 0 }}>
            {departments.map((department) => (
              <li key={department.id}>
                <Link href={`/c/${department.slug}`}>{department.name}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>Frequently asked questions</h2>
      {faq.map(({ q, a }) => (
        <div key={q}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>{q}</h3>
          <p style={{ marginTop: 0 }}>{a}</p>
        </div>
      ))}

      {/* Tamil, for people who search and read in Tamil. Written as real answers, not keyword lists. */}
      <section lang="ta">
        <h2>தமிழில் தகவல்</h2>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>ஹோசூரில் ஆன்லைனில் காய்கறி, பழங்கள் ஆர்டர் செய்யலாமா?</h3>
        <p style={{ marginTop: 0 }}>
          ஆம். Hosur Basket-ல் புதிய காய்கறிகள், பழங்கள், மளிகைப் பொருட்கள் ஆகியவற்றை ஆன்லைனில் ஆர்டர் செய்யலாம். ஹோசூரில்
          அதே நாளில் டெலிவரி கிடைக்கும்.
        </p>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>எந்தெந்த பகுதிகளுக்கு டெலிவரி கிடைக்கும்?</h3>
        <p style={{ marginTop: 0 }}>
          மேலே பட்டியலிடப்பட்டுள்ள பகுதிகளுக்கு டெலிவரி செய்கிறோம். உங்கள் பின்கோடை உள்ளிட்டால் உங்கள் முகவரிக்கு டெலிவரி
          கிடைக்குமா என்பதை உடனே தெரிந்துகொள்ளலாம்.
        </p>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>எப்படி ஆர்டர் செய்வது?</h3>
        <p style={{ marginTop: 0 }}>
          பொருட்களை கூடையில் சேர்த்து, உங்கள் முகவரியைத் தேர்ந்தெடுத்து, ஆர்டரை உறுதிசெய்யுங்கள். ஆர்டர் நிலையை "Track Order"
          பகுதியில் பார்க்கலாம்.
        </p>
      </section>

      <p>
        Not sure whether we deliver to you? Call us on <a href="tel:+919003597158">+91 90035 97158</a> or visit the{" "}
        <Link href="/help">Help Center</Link>.
      </p>
    </div>
  );
}
