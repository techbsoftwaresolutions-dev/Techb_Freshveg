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
  "HosurBasket makes online grocery shopping easy in Hosur. Buy fresh fruits, vegetables, daily groceries, rice, pulses, cooking oils, snacks, beverages, dairy products, cleaning supplies, personal care and household essentials with convenient home delivery in Hosur, GKD Nagar and Avalapalli Road.",

  openGraph: {
    type: "website",
    siteName: "Hosur Basket",
    locale: "en_IN",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Hosur Basket — your everyday supermarket" }],
  },
  
 Keywords : [

  // ==========================================
  // 1. SUPERMARKET AND GROCERY STORE
  // ==========================================
  "supermarket online Hosur",
  "local supermarket online Hosur",
  "grocery supermarket Hosur",
  "nearby supermarket delivery Hosur",
  "online grocery market Hosur",
  "grocery shopping website Hosur",
  "online provision store Hosur",
  "provision store home delivery Hosur",
  "departmental store Hosur",
  "online departmental store Hosur",
  "neighborhood grocery store Hosur",
  "local grocery shop online Hosur",
  "grocery delivery platform Hosur",
  "online daily shopping Hosur",
  "supermarket products online Hosur",
  "grocery shopping at home Hosur",
  "all groceries online Hosur",
  "best supermarket shopping Hosur",
  "grocery ordering website Hosur",
  "local online supermarket Tamil Nadu",

  // ==========================================
  // 2. FRESH PRODUCE AND FARM PRODUCTS
  // ==========================================
  "fresh produce delivery Hosur",
  "fresh farm products Hosur",
  "farm fresh products online Hosur",
  "fresh market products Hosur",
  "fresh food delivery Hosur",
  "fresh produce online shopping Hosur",
  "daily fresh produce Hosur",
  "fresh farm vegetables delivery Hosur",
  "fresh market vegetables online Hosur",
  "fresh seasonal produce Hosur",
  "locally sourced vegetables Hosur",
  "fresh garden vegetables Hosur",
  "fresh food products online Hosur",
  "farm produce shopping Hosur",
  "fresh vegetable basket Hosur",
  "fresh food supermarket Hosur",

  // ==========================================
  // 3. FRUIT CATEGORY SEARCHES
  // ==========================================
  "apple delivery Hosur",
  "banana delivery Hosur",
  "orange delivery Hosur",
  "mango delivery Hosur",
  "grapes online Hosur",
  "watermelon delivery Hosur",
  "papaya online Hosur",
  "pomegranate delivery Hosur",
  "pineapple online Hosur",
  "guava delivery Hosur",
  "lemon online Hosur",
  "mosambi delivery Hosur",
  "kiwi fruit Hosur",
  "dragon fruit Hosur",
  "mixed fruits online Hosur",
  "fruit shopping online Hosur",
  "fresh cut fruits Hosur",
  "fruit box delivery Hosur",
  "seasonal fruit shopping Hosur",
  "fresh fruit basket online Hosur",

  // ==========================================
  // 4. VEGETABLE CATEGORY SEARCHES
  // ==========================================
  "tomato delivery Hosur",
  "onion delivery Hosur",
  "potato delivery Hosur",
  "carrot online Hosur",
  "beans delivery Hosur",
  "brinjal delivery Hosur",
  "cabbage online Hosur",
  "cauliflower delivery Hosur",
  "cucumber online Hosur",
  "beetroot delivery Hosur",
  "spinach online Hosur",
  "drumstick delivery Hosur",
  "lady finger online Hosur",
  "green chilli delivery Hosur",
  "coriander leaves Hosur",
  "mint leaves online Hosur",
  "curry leaves delivery Hosur",
  "vegetable shopping online Hosur",
  "fresh greens delivery Hosur",
  "mixed vegetable basket Hosur",

  // ==========================================
  // 5. RICE, FLOUR AND PULSES
  // ==========================================
  "rice shop online Hosur",
  "buy rice online Hosur",
  "basmati rice Hosur",
  "sona masoori rice Hosur",
  "ponni rice online Hosur",
  "idli rice delivery Hosur",
  "wheat flour online Hosur",
  "atta delivery Hosur",
  "maida online Hosur",
  "rava online Hosur",
  "sooji delivery Hosur",
  "toor dal online Hosur",
  "urad dal delivery Hosur",
  "moong dal online Hosur",
  "chana dal Hosur",
  "green gram online Hosur",
  "black gram delivery Hosur",
  "pulses online shopping Hosur",
  "grains and pulses Hosur",
  "rice and dal delivery Hosur",

  // ==========================================
  // 6. OIL, MASALA AND SPICES
  // ==========================================
  "cooking oil delivery Hosur",
  "sunflower oil online Hosur",
  "groundnut oil Hosur",
  "coconut oil online Hosur",
  "gingelly oil delivery Hosur",
  "mustard oil Hosur",
  "ghee online shopping Hosur",
  "masala online shopping Hosur",
  "spice powder delivery Hosur",
  "chilli powder online Hosur",
  "turmeric powder Hosur",
  "coriander powder Hosur",
  "pepper powder online Hosur",
  "cumin seeds delivery Hosur",
  "mustard seeds online Hosur",
  "cooking spices Hosur",
  "Indian spices online Hosur",
  "kitchen masala products Hosur",
  "traditional spices Hosur",
  "spices and seasoning Hosur",

  // ==========================================
  // 7. DAIRY AND BREAKFAST PRODUCTS
  // ==========================================
  "dairy products delivery Hosur",
  "milk products online Hosur",
  "curd delivery Hosur",
  "butter online Hosur",
  "cheese delivery Hosur",
  "paneer online Hosur",
  "milk powder Hosur",
  "breakfast cereals Hosur",
  "cornflakes online Hosur",
  "oats delivery Hosur",
  "bread delivery Hosur",
  "jam online Hosur",
  "honey delivery Hosur",
  "peanut butter Hosur",
  "breakfast essentials Hosur",
  "morning grocery delivery Hosur",

  // ==========================================
  // 8. BAKERY AND PACKAGED FOOD
  // ==========================================
  "bakery products online Hosur",
  "bread and bakery delivery Hosur",
  "cake products Hosur",
  "cookies online Hosur",
  "biscuits delivery Hosur",
  "rusk online Hosur",
  "packaged food online Hosur",
  "ready to eat food Hosur",
  "instant noodles delivery Hosur",
  "pasta online Hosur",
  "vermicelli delivery Hosur",
  "sauce and ketchup Hosur",
  "food packets online Hosur",
  "instant breakfast products Hosur",
  "ready mix products Hosur",

  // ==========================================
  // 9. HOME CLEANING AND HOUSEHOLD
  // ==========================================
  "home cleaning essentials Hosur",
  "bathroom cleaning products Hosur",
  "toilet cleaner online Hosur",
  "laundry products Hosur",
  "washing powder delivery Hosur",
  "fabric softener Hosur",
  "dishwashing liquid Hosur",
  "dishwash bar online Hosur",
  "garbage bags Hosur",
  "tissue paper delivery Hosur",
  "paper napkins online Hosur",
  "room freshener Hosur",
  "house cleaning supplies Hosur",
  "kitchen cleaning products Hosur",
  "home hygiene products Hosur",
  "cleaning essentials online Hosur",

  // ==========================================
  // 10. PERSONAL CARE AND HYGIENE
  // ==========================================
  "soap online shopping Hosur",
  "shampoo delivery Hosur",
  "toothpaste online Hosur",
  "toothbrush delivery Hosur",
  "face wash online Hosur",
  "body lotion Hosur",
  "hair oil online Hosur",
  "deodorant delivery Hosur",
  "sanitary products Hosur",
  "handwash online Hosur",
  "sanitizer delivery Hosur",
  "personal hygiene online Hosur",
  "daily grooming products Hosur",
  "beauty and personal care Hosur",
  "bathroom essentials online Hosur",

  // ==========================================
  // 11. BABY AND FAMILY ESSENTIALS
  // ==========================================
  "baby care products Hosur",
  "baby essentials online Hosur",
  "baby diapers delivery Hosur",
  "baby wipes online Hosur",
  "baby hygiene products Hosur",
  "baby food products Hosur",
  "family essentials shopping Hosur",
  "kids daily essentials Hosur",
  "family shopping online Hosur",
  "mother and baby products Hosur",

  // ==========================================
  // 12. PET CARE PRODUCTS
  // ==========================================
  "pet food online Hosur",
  "dog food delivery Hosur",
  "cat food online Hosur",
  "pet care products Hosur",
  "pet essentials shopping Hosur",
  "pet supplies online Hosur",
  "pet hygiene products Hosur",
  "pet products delivery Hosur",

  // ==========================================
  // 13. ONLINE SHOPPING AND DELIVERY INTENT
  // ==========================================
  "order daily needs online Hosur",
  "shop daily essentials online Hosur",
  "online home shopping Hosur",
  "grocery delivery to doorstep Hosur",
  "order supermarket products online Hosur",
  "online shopping for groceries Hosur",
  "get fresh groceries at home Hosur",
  "home delivery supermarket products Hosur",
  "grocery ordering app Tamil Nadu",
  "online grocery shopping Tamil Nadu",
  "grocery delivery service Tamil Nadu",
  "supermarket online shopping Tamil Nadu",
  "fresh vegetables online Tamil Nadu",
  "fresh fruits online Tamil Nadu",
  "daily essentials online Tamil Nadu",
  "online grocery website Tamil Nadu",

  // ==========================================
  // 14. PRICE AND OFFER SEARCHES
  // ==========================================
  "cheap groceries online Hosur",
  "low price groceries Hosur",
  "affordable supermarket Hosur",
  "grocery offers online Hosur",
  "best grocery prices Hosur",
  "daily grocery offers Hosur",
  "supermarket discounts Hosur",
  "fruits and vegetables offers Hosur",
  "online shopping discounts Hosur",
  "grocery deals Tamil Nadu",
  "budget grocery shopping Hosur",
  "monthly grocery budget shopping Hosur",
  "value for money supermarket Hosur",
  "grocery sale online Hosur",
  "supermarket special offers Hosur",

  // ==========================================
  // 15. REGIONAL SEARCH VARIATIONS
  // ==========================================
  "Hosur online supermarket Tamil Nadu",
  "Hosur daily grocery shop",
  "Hosur grocery home delivery service",
  "Hosur fresh produce store",
  "Hosur online fruits shop",
  "Hosur online vegetables shop",
  "Hosur grocery ordering",
  "Hosur supermarket online delivery",
  "Hosur household shopping",
  "Hosur daily essentials shop",
  "Hosur local grocery service",
  "Hosur fresh food shopping",
  "Hosur grocery shopping website",
  "Hosur supermarket delivery app",
  "Hosur online provision shop",

  // ==========================================
  // 16. NEARBY LOCATION SEARCH VARIATIONS
  // ==========================================
  "grocery delivery near Hosur bus stand",
  "supermarket near Hosur bus stand",
  "grocery delivery near Bagalur Road",
  "supermarket near Bagalur Road Hosur",
  "grocery store near Mathigiri",
  "online grocery delivery Mathigiri",
  "fruits delivery Mathigiri",
  "vegetable delivery Mathigiri",
  "grocery shop near Mookandapalli",
  "online grocery Mookandapalli",
  "grocery delivery near SIPCOT Hosur",
  "supermarket near SIPCOT Hosur",
  "grocery delivery near Denkanikottai Road",
  "supermarket near Rayakottai Road",
  "grocery delivery near Old Bangalore Road",
  "supermarket near New ASTC Hudco",

  // ==========================================
  // 17. TAMIL SEARCH VARIATIONS
  // ==========================================
  "Hosur maligai porutkal",
  "Hosur kaikari delivery",
  "Hosur pazhangal delivery",
  "Hosur grocery online Tamil",
  "Hosur daily maligai",
  "Hosur fresh kaikari",
  "Hosur fresh pazhangal",
  "Hosur supermarket online",
  "ஓசூர் ஆன்லைன் மளிகை கடை",
  "ஓசூர் சூப்பர் மார்க்கெட்",
  "ஓசூர் பழங்கள்",
  "ஓசூர் காய்கறிகள்",
  "ஓசூர் மளிகை பொருட்கள் டெலிவரி",
  "ஓசூர் வீட்டிற்கு மளிகை டெலிவரி",
  "ஓசூர் ஆன்லைன் காய்கறி கடை",
  "ஓசூர் ஆன்லைன் பழக்கடை"

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
