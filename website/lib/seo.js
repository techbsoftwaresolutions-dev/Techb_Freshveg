// Search-engine wording and business facts, kept in one place so the page
// titles, descriptions and structured data all say the same thing. Edit here
// when the business details change.

export const SITE_NAME = "The Farmers Basket";
export const CITY = "Bangalore";

export const HOME_TITLE = "Fresh Vegetables Online in Bangalore | Free Delivery, Direct from Farmers";
export const HOME_DESCRIPTION =
  "Buy farm-fresh vegetables, fruits and milk online in Bangalore, sourced directly from local farmers. " +
  "No middlemen, fair prices, same-day home delivery and free delivery on qualifying orders. Order now at The Farmers Basket.";

export const KEYWORDS = [
  "fresh vegetables online Bangalore",
  "buy vegetables online Bangalore",
  "online vegetable delivery Bangalore",
  "free vegetable delivery Bangalore",
  "farm fresh vegetables Bangalore",
  "direct from farmers Bangalore",
  "farmers market online Bangalore",
  "organic vegetables Bangalore",
  "fresh fruits online Bangalore",
  "fresh milk delivery Bangalore",
  "same day vegetable delivery",
  "vegetable home delivery near me",
  "Sarjapura vegetable delivery",
  "Dommasandra vegetable delivery",
  "The Farmers Basket",
];

// Shown when a link is shared (WhatsApp, Facebook, Google Discover).
export const SHARE_IMAGE = { url: "/og-image.jpg", width: 1200, height: 630, alt: "The Farmers Basket — farm-fresh vegetables delivered in Bangalore" };

export const BUSINESS = {
  phones: ["+91-8072605216", "+91-6374047119"],
  email: "support@thefarmersbasket.in",
  city: "Bengaluru",
  region: "Karnataka",
  regionCode: "IN-KA",
  country: "IN",
  social: [
    "https://www.facebook.com/thefarmersbasket",
    "https://www.instagram.com/thefarmersbasket",
    "https://www.youtube.com/@thefarmersbasket",
  ],
};

// schema.org data for every page: the shop as a local grocery business that
// delivers to the admin's named areas, and the site with its search box (so
// Google can offer "search this site" from the result).
export function siteJsonLd(siteUrl, areas = []) {
  const places = [...new Set(areas.map((a) => a.name).filter(Boolean))];
  return [
    {
      "@context": "https://schema.org",
      "@type": "GroceryStore",
      "@id": `${siteUrl}/#store`,
      name: SITE_NAME,
      description: HOME_DESCRIPTION,
      url: siteUrl,
      logo: `${siteUrl}/icons/icon-512.png`,
      image: `${siteUrl}${SHARE_IMAGE.url}`,
      telephone: BUSINESS.phones[0],
      email: BUSINESS.email,
      priceRange: "₹",
      currenciesAccepted: "INR",
      paymentAccepted: "Cash, UPI",
      address: {
        "@type": "PostalAddress",
        addressLocality: BUSINESS.city,
        addressRegion: BUSINESS.region,
        addressCountry: BUSINESS.country,
      },
      areaServed: [
        { "@type": "City", name: BUSINESS.city },
        ...places.map((name) => ({ "@type": "Place", name: `${name}, ${BUSINESS.city}` })),
      ],
      contactPoint: BUSINESS.phones.map((telephone) => ({
        "@type": "ContactPoint",
        telephone,
        contactType: "customer service",
        areaServed: "IN",
        availableLanguage: ["en", "kn", "ta", "hi"],
      })),
      sameAs: BUSINESS.social,
      slogan: "Fresh Food, Better Life — direct from farmers",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: SITE_NAME,
      url: siteUrl,
      inLanguage: "en-IN",
      publisher: { "@id": `${siteUrl}/#store` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

// A product photo's alt text — what Google Images ranks on and a screen
// reader says. The admin's own wording wins; a blank one, or one that only
// repeats the product name, gets a descriptive default.
export function imageAlt(name, media, index = 0) {
  const own = (media?.alt || "").trim();
  if (own && own.toLowerCase() !== String(name || "").trim().toLowerCase()) return own;
  if (!name) return "";
  return `${name}${index ? ` — photo ${index + 1}` : ""} — farm fresh, The Farmers Basket Bangalore`;
}

// For <script type="application/ld+json">: "<" escaped so a product or area
// name can never close the script tag.
export const jsonLdHtml = (data) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });
