import { Suspense } from "react";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import ComingSoonModal from "@/components/ComingSoonModal";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FooterGate from "@/components/FooterGate";
import MobileNav from "@/components/MobileNav";
import CartDrawer from "@/components/CartDrawer";
import PwaSupport from "@/components/PwaSupport";
import ReviewPrompt from "@/components/ReviewPrompt";
import WhatsAppChat from "@/components/WhatsAppChat";
import OfferPopup from "@/components/OfferPopup";
import { getCategories, SITE_URL } from "@/lib/api";

// Local-business structured data so Google can show the store's address and
// phone for "grocery delivery in Hosur" searches.
const LOCAL_BUSINESS = {
  "@context": "https://schema.org",
  "@type": "GroceryStore",
  name: "Hosur Basket",
  url: SITE_URL,
  image: `${SITE_URL}/og-image.png`,
  telephone: "+919003597158",
  priceRange: "₹",
  address: {
    "@type": "PostalAddress",
    streetAddress: "#74/22, GKD Nagar, Avalapalli Road",
    addressLocality: "Hosur",
    addressRegion: "Tamil Nadu",
    postalCode: "635109",
    addressCountry: "IN",
  },
  areaServed: "Hosur",
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hosur Basket — fresh fruit, vegetables & groceries delivered",
    // Every page supplies its own name; the brand is appended once, here.
    template: "%s | Hosur Basket",
  },
  description:
    "Order fresh fruit, vegetables, groceries, personal care and household essentials from Hosur Basket, GKD Nagar, Avalapalli Road, Hosur 635109. Same-day delivery, with free delivery above a minimum order.",
  openGraph: {
    type: "website",
    siteName: "Hosur Basket",
    locale: "en_IN",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Hosur Basket — your everyday supermarket" }],
  },
  
keywords: [
  // =====================================
  // 1. BRAND KEYWORDS
  // =====================================
  "Hosur Basket",
  "HosurBasket",
  "Hosur Basket online",
  "Hosur Basket supermarket",
  "Hosur Basket grocery delivery",
  "Hosur Basket online grocery",
  "Hosur Basket shopping",
  "Hosur Basket Hosur",
  "HosurBasket online shopping",
  "HosurBasket grocery store",
  "HosurBasket fruits and vegetables",

  // =====================================
  // 2. ONLINE GROCERY SHOPPING
  // =====================================
  "grocery delivery Hosur",
  "online grocery shopping Hosur",
  "online supermarket Hosur",
  "grocery store in Hosur",
  "best grocery delivery Hosur",
  "grocery home delivery Hosur",
  "buy groceries online Hosur",
  "daily grocery delivery Hosur",
  "online grocery store Hosur",
  "supermarket Hosur 635109",
  "groceries online Hosur",
  "online grocery ordering Hosur",
  "grocery shopping online Hosur",
  "grocery delivery service Hosur",
  "local grocery delivery Hosur",
  "home grocery delivery Hosur",
  "grocery shopping app Hosur",
  "online shopping supermarket Hosur",
  "grocery products online Hosur",
  "order daily groceries Hosur",

  // =====================================
  // 3. FRUITS
  // =====================================
  "fresh fruits Hosur",
  "online fruits delivery Hosur",
  "fruit delivery Hosur",
  "buy fruits online Hosur",
  "fresh fruit shop Hosur",
  "fruit home delivery Hosur",
  "seasonal fruits Hosur",
  "fresh fruit shopping Hosur",
  "online fruit store Hosur",
  "fruit basket delivery Hosur",
  "fresh fruit market Hosur",
  "daily fresh fruits Hosur",
  "premium fruits Hosur",
  "fresh fruit suppliers Hosur",
  "fruits online shopping Hosur",
  "mixed fruit delivery Hosur",

  // =====================================
  // 4. VEGETABLES
  // =====================================
  "fresh vegetables Hosur",
  "online vegetables delivery Hosur",
  "vegetable delivery Hosur",
  "buy vegetables online Hosur",
  "fresh vegetable shop Hosur",
  "vegetable home delivery Hosur",
  "daily fresh vegetables Hosur",
  "online vegetable store Hosur",
  "fresh vegetable shopping Hosur",
  "green vegetables Hosur",
  "farm fresh vegetables Hosur",
  "organic vegetables Hosur",
  "vegetable basket delivery Hosur",
  "fresh vegetable market Hosur",
  "vegetables online shopping Hosur",
  "local vegetables delivery Hosur",

  // =====================================
  // 5. GROCERY AND FOOD PRODUCTS
  // =====================================
  "rice online shopping Hosur",
  "dal and pulses Hosur",
  "cooking oil online Hosur",
  "masala products Hosur",
  "spices online shopping Hosur",
  "atta and flour Hosur",
  "sugar and grocery Hosur",
  "salt and spices Hosur",
  "grocery food products Hosur",
  "packed food delivery Hosur",
  "breakfast products Hosur",
  "instant food products Hosur",
  "cooking essentials online Hosur",
  "food essentials delivery Hosur",
  "kitchen grocery items Hosur",

  // =====================================
  // 6. SNACKS AND BEVERAGES
  // =====================================
  "snacks delivery Hosur",
  "online snacks shopping Hosur",
  "biscuits online Hosur",
  "chocolate delivery Hosur",
  "chips and snacks Hosur",
  "soft drinks online Hosur",
  "juice delivery Hosur",
  "tea and coffee products Hosur",
  "beverages online shopping Hosur",
  "namkeen delivery Hosur",

  // =====================================
  // 7. HOUSEHOLD ESSENTIALS
  // =====================================
  "household essentials Hosur",
  "household items online Hosur",
  "home essentials delivery Hosur",
  "cleaning products Hosur",
  "cleaning supplies online Hosur",
  "dishwash products Hosur",
  "detergent online Hosur",
  "floor cleaner Hosur",
  "kitchen essentials Hosur",
  "home care products Hosur",
  "household products delivery Hosur",
  "daily home essentials Hosur",

  // =====================================
  // 8. PERSONAL CARE
  // =====================================
  "personal care products Hosur",
  "personal care online shopping Hosur",
  "beauty products Hosur",
  "skin care products Hosur",
  "hair care products Hosur",
  "bath products online Hosur",
  "personal hygiene products Hosur",
  "daily personal care essentials Hosur",

  // =====================================
  // 9. DAILY NEEDS AND MONTHLY SHOPPING
  // =====================================
  "daily needs Hosur",
  "daily essentials delivery Hosur",
  "monthly groceries Hosur",
  "monthly grocery shopping Hosur",
  "daily household shopping Hosur",
  "family grocery shopping Hosur",
  "everyday supermarket Hosur",
  "daily shopping online Hosur",
  "essential products delivery Hosur",
  "home shopping online Hosur",
  "daily needs online shopping Hosur",
  "all in one supermarket Hosur",

  // =====================================
  // 10. LOCAL SEO – HOSUR
  // =====================================
  "Avalapalli Road Hosur",
  "grocery delivery Avalapalli Road",
  "supermarket Avalapalli Road Hosur",
  "grocery shop Avalapalli Road",
  "GKD Nagar grocery delivery",
  "grocery shop near GKD Nagar",
  "supermarket near GKD Nagar",
  "fruits and vegetables GKD Nagar",
  "grocery delivery Hosur Tamil Nadu",
  "online supermarket Hosur Tamil Nadu",
  "grocery delivery Hosur 635109",
  "supermarket near Avalapalli Road",
  "local supermarket Hosur",
  "nearby grocery store Hosur",
  "grocery store near me Hosur",
  "supermarket near me Hosur",
  "vegetable shop near me Hosur",
  "fruit shop near me Hosur",

  // =====================================
  // 11. CUSTOMER BUYING INTENT
  // =====================================
  "order groceries online in Hosur",
  "shop groceries online Hosur",
  "get groceries delivered Hosur",
  "buy daily essentials online Hosur",
  "best online supermarket near me",
  "affordable groceries online Hosur",
  "fresh fruits and vegetables home delivery Hosur",
  "order fresh vegetables online Hosur",
  "order fresh fruits online Hosur",
  "online grocery shopping offers Hosur",
  "grocery discounts Hosur",
  "supermarket offers Hosur",
  "grocery shopping deals Hosur",
  "convenient grocery shopping Hosur",
  "quick grocery delivery Hosur",
  "easy grocery shopping Hosur",

  // =====================================
  // 12. TAMIL AND REGIONAL KEYWORDS
  // =====================================
  "Hosur grocery kadai",
  "Hosur vegetables online",
  "Hosur fruits delivery",
  "Maligai porul delivery Hosur",
  "Kaikari delivery Hosur",
  "Pazham delivery Hosur",
  "Hosur online kadai",
  "Hosur maligai kadai",
  "Hosur kaikari kadai",
  "Hosur pazham kadai",
  "மளிகை பொருட்கள் ஹோசூர்",
  "காய்கறி டெலிவரி ஓசூர்",
  "பழங்கள் டெலிவரி ஓசூர்",
  "ஆன்லைன் மளிகை கடை ஓசூர்"
],

  other: { "geo.region": "IN-TN", "geo.placename": "Hosur" },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
  applicationName: "Hosur Basket",
  // Launched from the iPhone home screen: full screen, with the status bar
  // drawn over the dark green utility strip.
  appleWebApp: { capable: true, title: "Hosur Basket", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

// Self-hosted by next/font at build time, so there is no request to Google from
// the shopper's browser and no layout shift while it loads.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page draw under the iPhone home indicator; the bottom nav pads
  // itself back out with env(safe-area-inset-bottom).
  viewportFit: "cover",
  themeColor: "#0f4a23",
};

export default async function RootLayout({ children }) {
  // The category bar is on every page, so it is fetched once in the layout and
  // cached — not re-requested per route.
  const data = await getCategories();
  const categories = data?.categories || [];

  return (
    <html lang="en-IN" className={poppins.variable}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS) }}
        />
        <Providers>
          {/* Header reads useSearchParams, which needs a Suspense boundary so
              the rest of the page can still be statically rendered. */}
          <Suspense fallback={<div style={{ height: "var(--header-total)" }} />}>
            <Header categories={categories} />
          </Suspense>

          <main>{children}</main>
          <CartDrawer />
          <ComingSoonModal />

          <FooterGate>
            <Footer categories={categories} />
          </FooterGate>

          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          <PwaSupport />
          <ReviewPrompt />
          <WhatsAppChat />
          <OfferPopup />
        </Providers>
      </body>
    </html>
  );
}
