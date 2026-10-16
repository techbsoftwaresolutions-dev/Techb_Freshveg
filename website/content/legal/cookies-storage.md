# Cookies & Local Storage

> **STATUS: DRAFT — NOT READY FOR PUBLICATION.** Classification: recommended (no advertising/analytics cookies exist, so no consent banner is needed on today's evidence; lawyer to confirm).
> Evidence: website/lib/client-api.js (session, guest id, referral code), components/Providers.jsx (pincode, area), Header.jsx (sessionStorage location prompt), PwaSupport.jsx, RailDrawer.jsx, ReviewPrompt.jsx (UI dismissals), public/sw.js (offline cache). Apps: customer-app/src/api/client.js, context/StoreContext.js, WishlistContext.js, components/BrandLogo.js; delivery-app/src/api/client.js, components/BrandLogo.js. No document.cookie writes and no analytics/ads scripts in website/, customer-app/ or delivery-app/ (grep on 16 Oct 2026).
> Third-party: Razorpay's checkout script (checkout.razorpay.com) loads only when paying online and may set its own cookies.

The [[BRAND]] website and apps keep a few small pieces of information on your device so that they work. We do not use advertising cookies, analytics cookies or tracking pixels.

## What we store on your device {#what}

- **Your sign-in session** — the tokens that keep you signed in (website: browser local storage; apps: app storage). Removed when you sign out.
- **Your pincode and delivery area** — so prices, stock and delivery options match where you are.
- **A guest identifier** — so a cart and wishlist built before you sign in are kept.
- **A referral code from a link** you opened — kept until you sign up, so the referral can be applied.
- **Display choices** — for example that you closed a banner or an install prompt, and a cached copy of our logo.
- **Offline copy of some pages** (website only) — so the site still opens on a weak connection.

None of this is used to track you across other websites or apps.

## Third-party services {#third-parties}

- When you pay online, Razorpay's payment window is loaded from Razorpay and may use its own cookies to process the payment securely; see Razorpay's privacy policy.
- Product images are loaded from Cloudinary's servers.

## How to clear it {#clear}

Sign out to remove your session. You can also clear site data in your browser settings, or clear the app's storage (or uninstall the app) in your phone's settings. The site and apps will then simply ask for your pincode again.
