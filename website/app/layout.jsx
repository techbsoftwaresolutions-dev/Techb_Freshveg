import { Suspense } from "react";
import { DM_Serif_Display, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";
import PwaSupport from "@/components/PwaSupport";
import ReviewPrompt from "@/components/ReviewPrompt";
import { getCategories, getServiceAreas, SITE_URL } from "@/lib/api";
import { BUSINESS, HOME_DESCRIPTION, HOME_TITLE, KEYWORDS, SHARE_IMAGE, SITE_NAME, jsonLdHtml, siteJsonLd } from "@/lib/seo";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: HOME_TITLE,
    // Every page supplies its own name; the brand is appended once, here.
    template: "%s | The Farmers Basket",
  },
  description: HOME_DESCRIPTION,
  keywords: KEYWORDS,
  category: "shopping",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: SITE_URL,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Local-search hints: the shop serves Bengaluru, Karnataka.
  other: {
    "geo.region": BUSINESS.regionCode,
    "geo.placename": BUSINESS.city,
  },
  applicationName: "The Farmers Basket",
  // Launched from the iPhone home screen: full screen, with the status bar
  // drawn over the dark green utility strip.
  appleWebApp: {
    capable: true,
    title: "The Farmers Basket",
    statusBarStyle: "black-translucent",
    // The logo on cream while the installed app opens on an iPhone.
    startupImage: [
      { url: "/splash/splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/splash-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/splash/splash-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
    ],
  },
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

// Headings only — the serif that carries the Farmers Basket wordmark's tone.
const serif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-dm-serif",
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
  const [data, areaData] = await Promise.all([getCategories(), getServiceAreas()]);
  const categories = data?.categories || [];

  return (
    <html lang="en-IN" className={`${poppins.variable} ${serif.variable}`}>
      <body>
        {/* The shop and site as structured data, for Google's local results. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(siteJsonLd(SITE_URL, areaData?.areas))} />
        <Providers>
          {/* Header reads useSearchParams, which needs a Suspense boundary so
              the rest of the page can still be statically rendered. */}
          <Suspense fallback={<div style={{ height: "var(--header-total)" }} />}>
            <Header categories={categories} />
          </Suspense>

          <main>{children}</main>

          <Footer categories={categories} />

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
