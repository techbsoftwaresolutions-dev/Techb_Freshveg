# Store readiness report — customer app and delivery app (India)

16 October 2026 · branch `farmers_basket` · nothing committed.

**Bottom line: not ready to submit.** The privacy and deletion work the stores require is built and tested, but two security blockers (B1, B2 below) and the business inputs and legal review must come first. This report does not certify legal compliance or predict store approval.

## 1. What was done

### Account deletion (backend, both apps, website, admin)
- **Customers** erase their own account: app (Account → Legal & about → Delete my account), website (`/account-deletion`, works without the app), or an admin acting on an email/phone request (Admin → Customers → customer → "Delete account on request"; needs `users.manage` and a note).
  - Refused, with the reason, while an order is in progress, a refund is incomplete or a support request is open.
  - Wallet balance, points and unused coupons are shown and must be acknowledged. They are written off through the ledgers.
  - Typed DELETE confirmation; a reference number is returned; every session ends immediately.
  - Erased: name, phone (number freed for a new sign-up), email, addresses, reviews (ratings recomputed), cart, wishlist, notifications, preferences, referral code, OTPs, and PII on orders, support tickets and gateway payloads.
  - Kept, anonymised: orders, payments, refunds, ledgers, closed tickets, and a deletion receipt holding only the last 4 digits of the phone.
  - **Orders are never deleted.**
- **Delivery employees** request deletion in the app (Profile → Legal & account). An admin completes it in Admin → Delivery Boys → "Account deletion requests" (erase) or declines it with a reason the employee sees.
  - Erasure is refused while the rider holds a run or unsettled cash.
  - Delivered orders keep the rider's name, not their phone.
  - **Deactivation stays separate and is not deletion.**
- Code: `backend/src/modules/auth/accountDeletion.{model,service}.js`, routes in `auth.routes.js`, `users/user.routes.js`, `customers/customer.routes.js`.
- Tests: `backend/test/accountDeletion.test.js` (12 tests).

### Security and privacy fixes (launch-relevant)
- Every request now re-checks that the account is active, so blocking or erasing a customer ends their sessions at once (it already did for staff).
- Riders see customer contact details only while the order is on their run. They never see email, staff notes, customer ids or payment references, and their history keeps only the area and the amounts.
- Customers no longer receive staff `internalNote`. The rider's phone shows only during the run.
- The API now refuses customer cancellation after pickup, matching the UI and the refund policy.
- OTP requests are capped at 5 per number per 15 minutes.
- `REVIEW_LOGINS` gives fixed codes to designated demo numbers for store review. It replaces the need for `OTP_ON_SCREEN`.
- Location pings are accepted only during a run.
- Android: `allowBackup=false`, and unused template permissions are blocked.
- Tests: `backend/test/otpLogin.test.js` (2 tests) plus the deletion suite.

### Website
- Policy pages, each with a title, metadata, last-updated/effective date and version:
  - `/privacy-policy`, `/terms-and-conditions`, `/refund-cancellation-policy`, `/shipping-delivery-policy`, `/referral-terms`
  - `/account-deletion` (with the live deletion panel), `/cookies-storage`
  - `/delivery-app-privacy`, `/delivery-app-terms`
- `/terms` permanently redirects to `/terms-and-conditions`.
- The footer has a "Policies" column; the sitemap lists the pages; the sign-in notice links Terms and Privacy.
- The pages are mobile-responsive: checked at 375 px with no horizontal scroll.
- Placeholders never render: a sentence whose value is missing is hidden.

### Apps
- **Customer app:** "Legal & about" (policies, delete account, version, support), reachable signed in or out. The sign-in screen links Terms and Privacy.
- **Delivery app:** "Legal & account" (privacy notice, usage terms, deletion request with status).

### Documents
`docs/legal/` (index: [README.md](README.md)) and `website/content/legal/`.

## 2. Verification results (run 16 Oct 2026)

| Check | Result |
|---|---|
| `cd backend && npm test` | **146 / 147 pass** in each of the last two full runs. The one failure is always in `whatsapp.test.js`, but it is a different retry test each time ("…the retry waits", then "a timeout is retried rather than failed"). Each fails about 1 in 3 runs even when the file runs alone, and the whole suite passed 133/133 in the baseline run before this work. Cause: the tests poll a message row while the send is still in flight, so they can read it before `nextAttemptAt` is written. This work did not touch WhatsApp code. All 12 deletion tests and both OTP tests pass. |
| `admin: npx vite build` | **Pass** (after fixing a syntax error introduced in this work, found by this build) |
| `website: npx next build` | **Pass**; 10 legal routes prerendered; built HTML checked for leaked placeholders and review notes: none |
| `customer-app: npx expo export --platform web` | **Pass** |
| `delivery-app: npx expo export --platform web` | **Pass** |
| Native config (`expo config --type introspect`) | Both apps: only INTERNET, VIBRATE; `allowBackup=false`; no iOS usage strings |
| Browser, against an in-memory demo API | Website policy pages at 375 px; website sign-in → delete (reference shown, session cleared); customer app Legal & about (signed out and in) → Delete account blocked by an open order → order cancelled → deleted with a reference |
| Delivery app UI in a browser | **Not verified.** The web build appears to have called the user's own dev API instead of the demo API (see section 5), so the test was stopped. The screen compiles (export passes) but has not been seen working. |

## 3. Launch blockers (must fix before submitting)

| # | Blocker | Owner |
|---|---|---|
| B1 | **Production secrets are committed and pushed to git**: MongoDB credentials, JWT secrets and the Cloudinary secret are in `deploy/.stage/app/.env`, and several other `.env` files are tracked. Rotate everything, then untrack the files (security-audit.md). | business / dev |
| B2 | **No SMS OTP provider.** In production nobody can sign in, unless `OTP_ON_SCREEN=true`, which lets anyone sign in as anyone. | dev + business (DLT registration) |
| B3 | Business identity: legal entity, address, grievance officer, GSTIN/FSSAI. Store developer accounts must be in the entity's name, and the brand name must be settled (The Farmers Basket / Samagra Mart). | business |
| B4 | Lawyer review of all policy drafts and of the positions listed in lawyer-review-checklist.md §B (wallet refunds, forfeiture on deletion, perishables, undeliverable orders). | business + lawyer |
| B5 | Store build checks: target API 36 (Play, since 31 Aug 2026), the merged Android manifest, and the iOS privacy report on the first EAS builds. | dev |
| B6 | Delivery app distribution decision (private vs public listing). | business |

## 4. Before each submission

1. Fill `website/lib/legal.js` `LEGAL_VALUES`, set the real publication date, rebuild and deploy the website, and confirm every policy URL loads publicly.
2. Set `REVIEW_LOGINS` on production and prepare the demo data (store-checklist files, section E/D).
3. Enter the Data safety and App Privacy answers from the drafts. First decide the "Payment info" question for the Razorpay SDK.
4. Make sure `OTP_ON_SCREEN` is unset in production.

## 5. Things to know

- **A test request may have reached your real dev database.** While I was checking the delivery app's web build, it appears to have used `delivery-app/.env` (`192.168.1.36:5055`, your "farmers-basket" database) instead of the in-memory demo API. If so, it created one OTP record for the test number **9811199999** (role `delivery_partner`); the sign-in was refused, so no account was created. That record expires but is only auto-removed if the OTP TTL index exists in that database (indexes are not auto-built). To clear it: `db.otps.deleteMany({ phone: "9811199999" })`. Every other browser test was checked to be hitting the in-memory demo database.
- New dependencies: none.
- Behaviour changes that users will notice:
  - Customers can no longer cancel through the API once an order is picked up (the UIs already hid the button).
  - Blocked customers are now signed out at once.
  - Riders lose access to past customers' contact details.
  - Old `/terms` links redirect to `/terms-and-conditions`.
- Follow-ups not done:
  - TTL/retention jobs (internal-retention-schedule.md);
  - expo-secure-store for tokens;
  - token rotation;
  - an in-app open-source licences screen;
  - a referral-fraud check for erased numbers;
  - fixing the flaky WhatsApp test;
  - hiding "Cancel" for return-state orders on the website;
  - product-page duties under the 2026 E-Commerce amendment (from 1 Jan 2027).
