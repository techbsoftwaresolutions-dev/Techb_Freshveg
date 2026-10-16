# Data inventory (evidence for the policies and store forms)

Taken from the code on branch `farmers_basket`, 16 Oct 2026. Every row names where it lives, so it can be re-checked when the code changes. "Customer app" = `customer-app/` ("The Farmers Basket", com.samagramart.customer); "delivery app" = `delivery-app/` ("Farmers Basket Delivery", com.samagramart.partner).

## 1. Personal data collected

### Customers (website and customer app)

| Data | Source | Stored in | Purpose | Notes |
|---|---|---|---|---|
| Mobile number | typed at sign-in | `User.phone` (auth/user.model.js) | identity, OTP login, delivery contact, WhatsApp updates | unique per role |
| Name | sign-in / profile | `User.name` | account, delivery | optional at sign-in |
| Email | profile (optional) | `User.email` | account, Razorpay prefill | never required |
| Addresses (contact name/phone, line1/2, landmark, city, state, pincode) | typed | `User.addresses[]` | delivery, serviceability | `location` (GeoJSON) exists in the schema but **no client captures coordinates** |
| Order snapshot (customer name/phone/email, address, items, prices, notes, instructions) | checkout | `Order` (orders/order.model.js) | fulfilment, invoice, support | snapshot, not a reference |
| Order status history (who/when) | system/staff | `Order.statusHistory` | audit, tracking | |
| Handover code (4 digits) | generated | `Order.delivery.otp` | proof of delivery | hidden from riders |
| Ratings & reviews (text; `images` field exists but customers cannot upload) | typed | `Review`, `Order.rating` | product feedback | moderated (reviewsNeedApproval default on) |
| Support tickets (messages, order link, name/phone copy) | typed | `SupportTicket` | complaints | staff-only internal notes on the same thread |
| Cart, wishlist | app use | `Cart`, `Wishlist` | shopping | guest carts by device id |
| Wallet & loyalty balances and ledgers | system | `User.walletBalance/loyaltyPoints`, `WalletTransaction`, `LoyaltyTransaction` | refunds, rewards | |
| Referral link, code, progress; reward coupons | system | `Referral`, `Coupon`, `User.referralCode/referredBy` | Refer & Earn | |
| Notifications inbox, preferences | system | `Notification`, `User.notificationPrefs` | messages | push tokens field `User.devices` exists; **no app registers tokens** (no expo-notifications) |
| Online payment records (method, amount, gateway ids, raw gateway payload) | Razorpay | `Payment`, `Refund` | payments, refunds, disputes | no card/UPI details stored |
| WhatsApp message log (masked number, status) | system | `WhatsAppMessage` | delivery receipts, retries | only when WhatsApp is configured |
| OTP codes (hashed) | system | `Otp` | login | TTL index: removed ~1 h after expiry |
| Account deletion receipt (reference, masked phone, forfeited balances) | system | `AccountDeletion` (new) | proof of erasure | no PII beyond last 4 digits |

### Delivery staff (delivery app)

| Data | Source | Stored in | Notes |
|---|---|---|---|
| Name, phone, optional email, role, stores, status | admin (Admin → Delivery Boys) | `User` | cannot self-register |
| Last login | system | `User.lastLoginAt` | |
| Assignment and status steps, delivery time | app + admin | `Order.delivery.*`, `statusHistory` | |
| COD collected / settled | system | `Payment.codCollectedBy/At`, `codSettledAt` | |
| Location pings (lat/lng, speed, battery) | **API exists, app never sends** | `DeliveryTracking` (7-day TTL) | ping now refused outside an active run |
| Proof photo / signature / delivered location | **fields exist, app never sends** | `Order.delivery.proofPhoto/signature/deliveredLocation` | |
| Deletion requests | app | `AccountDeletion` | |

### Staff using the admin portal (out of store scope, listed for completeness)
Name, phone, email, password hash, role/permissions, audit log entries with IP address and user agent (`AuditLog`, no TTL).

## 2. Device permissions (verified with `npx expo config --type introspect`)

| | Customer app | Delivery app |
|---|---|---|
| Android permissions after this change | INTERNET, VIBRATE (both normal, install-time) | INTERNET, VIBRATE |
| Removed (`android.blockedPermissions`) | READ/WRITE_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW, READ_SMS, RECEIVE_SMS | READ/WRITE_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW |
| iOS usage-description strings | none | none |
| Runtime prompts | none | none |
Details: [permissions-audit.md](permissions-audit.md).

## 3. Authentication and token storage

- Customers and riders: phone OTP (6 digits, 5-minute expiry, 5 attempts per code, sha256-hashed). Rate limits: 10 requests / 15 min per IP; **new:** 5 codes / 15 min per number. Staff: phone + bcrypt password, 20 attempts / 15 min per IP.
- JWT access token (default 7 days) + refresh token (default 30 days). **New:** every authenticated request re-checks the account is active (was staff-only), so blocking or deleting a customer ends their sessions at once.
- Storage: website `localStorage` (`commerce.web.session`-style keys in lib/client-api.js); apps AsyncStorage (unencrypted app sandbox). **New:** `android.allowBackup=false` keeps tokens out of device/cloud backups. Not done: Keychain/Keystore storage (expo-secure-store) — recommended, see security-audit.md.
- **SMS is not wired** (auth.routes.js TODO): in production either nobody receives a code or `OTP_ON_SCREEN=true` shows it on screen (anyone can sign in as any number). Launch blocker — see security-audit.md.

## 4. Third parties

| Party | What it receives | When | Role |
|---|---|---|---|
| Razorpay | amount, order ref, prefill name/phone/email (gateways.js:109); payer enters card/UPI on Razorpay's own screen; refunds | online payments, if enabled (Admin → Settings → Payments) | payment processor (own privacy policy) |
| Meta WhatsApp Cloud API | customer phone, order code/status template params | only if WhatsApp is configured and the customer has not turned it off | processor |
| SMS provider | phone + OTP | **not integrated yet** | processor (to be named) |
| Cloudinary | admin-uploaded product/brand/banner images and videos; serves images to every visitor (sees IP) | always | processor/CDN |
| MongoDB host, app/website host | everything stored | always | processors — **providers not identified in the repo** |
| Google/Apple maps apps | delivery address, when a rider taps Navigate | user-initiated, on the rider's device | not a transfer by us |
| Analytics, ads, crash reporting, push SDKs | **none present** (grep of website/, customer-app/, delivery-app/, admin/src, backend/src) | — | — |

## 5. Retention found in the code (before this work)

| Data | Retention in code |
|---|---|
| OTP codes | TTL ~1 h after expiry |
| Delivery tracking pings | TTL 7 days |
| Users, orders, payments, refunds, ledgers, tickets, reviews, notifications, carts, WhatsApp log, audit log | **no expiry** |
| Deleted accounts | previously impossible: only deactivation existed (staff) and no customer deletion at all |
Target schedule: [internal-retention-schedule.md](internal-retention-schedule.md).

## 6. Legal pages and links before this work

- Website: `/terms` only (dated 1 Oct 2026), linked from the footer, plus "Returns & Refunds" pointing to `/orders`. No privacy policy, refund, shipping, referral or deletion page. Footer phones/email/"Bangalore" from `website/lib/seo.js` `BUSINESS`.
- Old `/terms` statements that the code does not implement: "cancel until packed" (code: until picked up), a flat "24 hours" complaint window (code: per-category return windows; no complaint deadline), "refund in 5–7 working days" (no timeline in code), "delivery partners" (they are store employees).
- Customer app: no legal links anywhere; footer text "thefarmersbasket.in". Delivery app: none.
- Brand names: website/apps say "The Farmers Basket"; backend settings default "Samagra Mart"; bundle IDs `com.samagramart.*`; schemes `samagramart` / `samagrapartner`. The store listing developer name must match the legal entity named in the policies.
