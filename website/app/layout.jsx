import { Suspense } from "react";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FooterGate from "@/components/FooterGate";
import MobileNav from "@/components/MobileNav";
import PwaSupport from "@/components/PwaSupport";
import ReviewPrompt from "@/components/ReviewPrompt";
import { getCategories, SITE_URL } from "@/lib/api";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hosur Basket — fresh fruit, vegetables & groceries delivered",
    // Every page supplies its own name; the brand is appended once, here.
    template: "%s | Hosur Basket",
  },
  description:
    "Order fresh fruit, vegetables, groceries, personal care and household essentials from your neighbourhood store. Same-day delivery, with free delivery above a minimum order.",
  openGraph: {
    type: "website",
    siteName: "Hosur Basket",
    locale: "en_IN",
  },
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
        <Providers>
          {/* Header reads useSearchParams, which needs a Suspense boundary so
              the rest of the page can still be statically rendered. */}
          <Suspense fallback={<div style={{ height: "var(--header-total)" }} />}>
            <Header categories={categories} />
          </Suspense>

          <main>{children}</main>

          <FooterGate>
            <Footer categories={categories} />
          </FooterGate>

          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          <PwaSupport />
          <ReviewPrompt />
        </Providers>
      </body>
    </html>
  );
}
