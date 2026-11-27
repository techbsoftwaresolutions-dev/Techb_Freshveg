import Script from "next/script";

// Google Analytics 4. Loads only when NEXT_PUBLIC_GA_ID (like G-XXXXXXXXXX) is set on the server,
// so nothing is sent from development or from a deployment that has not opted in. Page changes
// inside the site are picked up by GA4's built-in "page changes based on browser history events".
export default function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
