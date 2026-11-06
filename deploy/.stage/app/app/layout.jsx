import { Suspense } from "react";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FooterGate from "@/components/FooterGate";
import MobileNav from "@/components/MobileNav";
import CartDrawer from "@/components/CartDrawer";
import PwaSupport from "@/components/PwaSupport";
import ReviewPrompt from "@/components/ReviewPrompt";
import WhatsAppChat from "@/components/WhatsAppChat";
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
  keywords: ["Hosur Basket", "grocery delivery Hosur", "fresh vegetables Hosur", "fruits Hosur", "Avalapalli Road Hosur", "supermarket Hosur 635109"],
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

          <FooterGate>
            <Footer categories={categories} />
          </FooterGate>

          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          <PwaSupport />
          <ReviewPrompt />
          <WhatsAppChat />
        </Providers>
      </body>
    </html>
  );
}
