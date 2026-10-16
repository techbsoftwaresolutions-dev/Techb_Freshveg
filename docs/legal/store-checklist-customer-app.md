# Store checklist — customer app "The Farmers Basket"

Android `com.samagramart.customer` · iOS `com.samagramart.customer` · version 0.1.0 (customer-app/app.config.js).
Evidence for every answer: [data-inventory.md](data-inventory.md). These are **drafts to review**, not submitted answers; approval is decided by Google and Apple.

## A. Google Play — checklist

| ✓ | Item | Status / where |
|---|---|---|
| ☐ | Developer account in the legal entity's name; developer name matches the policies' entity | business input |
| ☐ | Privacy policy URL: `https://thefarmersbasket.in/privacy-policy` live, public, not geofenced, not a PDF | page built (website/app/privacy-policy) — publish after review |
| ☐ | Privacy policy reachable in the app | done: Account → Legal & about; sign-in screen links Terms and Privacy |
| ☐ | Account deletion in-app | done: Account → Legal & about → Delete my account |
| ☐ | Account deletion web link in Data safety: `https://thefarmersbasket.in/account-deletion` | page built; works without the app (sign in by OTP there) |
| ☐ | Data safety form (draft below) | business to enter |
| ☐ | Target API 36 (required for new apps/updates since 31 Aug 2026) | check EAS build output |
| ☐ | Permissions: only INTERNET, VIBRATE | done (blockedPermissions); re-check merged manifest of the first build |
| ☐ | No SMS/Call-log permissions | blocked |
| ☐ | Content rating questionnaire (IARC) | business — shopping app, no user-to-user chat, real-money purchases of physical goods |
| ☐ | Target audience: 18+ (terms require 18+) | business |
| ☐ | Ads declaration: **no ads** | true in code |
| ☐ | Financial features declaration: not a financial app (payments for own goods via Razorpay) | business |
| ☐ | Government/health declarations: not applicable | |
| ☐ | Store listing: screenshots, description mentioning delivery areas (Bengaluru), support email/phone, website | business |
| ☐ | App access instructions (review login) — see E | set `REVIEW_LOGINS` on the production API before submitting |
| ☐ | SMS OTP live in production (security-audit B2) | **blocker** |
| ☐ | Secrets rotated (security-audit B1) | **blocker** |

## B. Google Play — Data safety draft

**Does your app collect or share user data?** Yes. **Is all user data encrypted in transit?** Yes (HTTPS to `https://thefarmersbasket.in`). **Do you provide a way to request deletion?** Yes — in-app and web link above.

| Category → type | Collected | Shared | Optional? | Purposes | Evidence |
|---|---|---|---|---|---|
| Personal info → Name | Yes | No | Optional | App functionality, Account management | sign-in/profile |
| Personal info → Email address | Yes | No | Optional | Account management, App functionality (payment prefill) | profile; gateways.js prefill |
| Personal info → User IDs | Yes | No | Required | Account management, App functionality | account id, referral code |
| Personal info → Address | Yes | No | Required to order | App functionality | Saved addresses / order snapshot |
| Personal info → Phone number | Yes | No | Required | Account management, App functionality, Fraud prevention/security, Developer communications (order updates), Advertising or marketing (offer messages — only if the "Offers" channel is used) | OTP login, WhatsApp/SMS |
| Financial info → Purchase history | Yes | No | Required | App functionality, Account management | orders, wallet/points ledgers |
| Financial info → User payment info | **Decide** — card/UPI is typed into Razorpay's SDK inside the app and sent to Razorpay, never to us. Google's form exempts payment services collecting under their own terms when the app never accesses the data; if you are not certain it applies, declare it as collected (not shared) for App functionality | — | Optional (COD available) | App functionality | react-native-razorpay |
| Messages → Other in-app messages | Yes | No | Optional | App functionality (support) | Help & support tickets |
| App activity → Other user-generated content | Yes | No | Optional | App functionality | reviews and ratings |
| Device or other IDs | Yes (random guest id for the cart before sign-in) | No | Required | App functionality | customer-app/src/api/client.js guestId |
| Location, Photos, Contacts, Audio, Files, Calendar, Health, Web browsing, App info & performance | **No** | — | — | — | no permission, no SDK |

"Shared": none. Razorpay, Meta (WhatsApp), the SMS provider, Cloudinary and hosting act as service providers on our instructions; delivery staff are the business's own employees.

## C. Apple — checklist

| ✓ | Item | Status / where |
|---|---|---|
| ☐ | Apple Developer account enrolled as the legal entity (organisation) | business input |
| ☐ | Privacy Policy URL in App Store Connect + in-app link (5.1.1(i)) | done in app; publish page |
| ☐ | In-app account deletion initiation (5.1.1(v)) | done — immediate, with confirmation and reference number; tells the user it is immediate |
| ☐ | Reviews deleted with the account (Apple: user content must be deleted) | done (accountDeletion.service.js) |
| ☐ | No IAP for physical goods (3.1.3(e)) — Razorpay / COD | true |
| ☐ | No third-party login → 4.8 not triggered | true (own phone OTP) |
| ☐ | Demo account + live backend + Review Notes (2.1) — see E | set `REVIEW_LOGINS` |
| ☐ | App works without sign-in for browsing (5.1.1(v)) | true — catalogue browsable signed out |
| ☐ | No permission prompts → no purpose strings needed | verified (no NS…UsageDescription) |
| ☐ | Privacy manifest / required-reason APIs | **check Xcode privacy report on the first EAS iOS build** (AsyncStorage, Razorpay pod) — Apple's page was not readable this session |
| ☐ | Age rating questionnaire | business |
| ☐ | Export compliance: uses only standard HTTPS encryption | answer "exempt" per Apple's prompt — confirm |
| ☐ | Support URL and marketing URL | website /help |
| ☐ | Minimum functionality (4.2): native screens, cart, checkout, tracking — not a web wrapper | true |
| ☐ | SMS OTP live, secrets rotated | **blockers** (security-audit B1/B2) |

## D. Apple — App Privacy draft

**Tracking:** No (no ad SDKs, no data broker, no cross-company linking).

| Data type | Collected | Linked to user | Tracking | Purposes |
|---|---|---|---|---|
| Contact Info → Name | Yes | Yes | No | App Functionality |
| Contact Info → Email Address | Yes (optional) | Yes | No | App Functionality |
| Contact Info → Phone Number | Yes | Yes | No | App Functionality; Developer's Advertising or Marketing (only if offer messages are sent) |
| Contact Info → Physical Address | Yes | Yes | No | App Functionality |
| Purchases → Purchase History | Yes | Yes | No | App Functionality |
| Financial Info → Payment Info | **Decide**: Apple says payment info entered through a payment service you never access is not collected — Razorpay's checkout fits that description; declare if unsure | — | No | App Functionality |
| User Content → Customer Support | Yes | Yes | No | App Functionality |
| User Content → Other User Content (reviews) | Yes | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Yes | No | App Functionality |
| Identifiers → Device ID | Yes (random guest id, joined to the account at sign-in) | Yes | No | App Functionality |
| Location, Health, Contacts, Browsing/Search History, Usage Data, Diagnostics, Sensitive Info | No | — | — | — |

## E. Review notes and test account (both stores)

1. On the production API set, then restart:
   `REVIEW_LOGINS=customer:<demo number>:<6-digit code>` (10-digit number reserved for review, not a real person's). Nothing is sent to or shown for that number; the code is the only way in. Remove it after approval.
2. Sign in once yourself with that number so the account exists; add a saved address with a pincode inside an active delivery area; make sure the store is open (or accepting orders) during review hours and COD is enabled.
3. Review notes text (fill in):
   > Sign in: tap Account → Sign in, enter <demo number>, tap Continue, enter code <code>. Browse without signing in is also possible. Use pincode <pincode> on the Location screen. Place an order with Cash on delivery — no payment is taken. Account deletion: Account → Legal & about → Delete my account (immediate; please use a fresh order-free state or cancel the test order first, since an order in progress blocks deletion). Online payment uses Razorpay (physical goods, no in-app purchase). The app does not request any device permissions.
4. After review, cancel test orders from the admin, and delete the demo account or keep it only for future reviews.
