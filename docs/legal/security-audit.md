# Security and privacy audit (launch scope)

Scope: backend API, both apps, website; 16 Oct 2026. Only launch blockers were fixed; everything else is listed with a recommendation. Severity: Critical / High / Medium / Low.

## Fixed in this change

| # | Severity | Finding | Fix | Test |
|---|---|---|---|---|
| F1 | High | Customer access tokens (7-day) were never re-checked against the account, so a blocked or deleted customer stayed signed in until expiry | `middleware/auth.js` requireAuth now checks every account is `active` | accountDeletion.test.js ("every session ends at once") |
| F2 | High | Riders' order views carried the customer's email, staff internal notes, customer id, payment references, proof photo; and the full name/phone/address of every past delivery stayed visible in History indefinitely | `order.routes.js` forViewer(): contact details only while the order is on the rider's run; never email/notes/ids/payment refs | "riders see contact details only while the order is on their run" |
| F3 | Medium | Customers' own order JSON included staff `internalNote`; rider name and phone stayed on delivered orders forever | `forCustomer()` and `trackingView()` — rider contact only during the run | covered by existing customer tests (no client used those fields) |
| F4 | Medium | API let a customer cancel an order already picked up / out for delivery (UIs hid the button), releasing stock that was in the rider's bag | `POST /orders/:id/cancel` refuses from PICKED_UP | existing tests + policy |
| F5 | Medium | OTP requests limited per IP only — rotating IPs could flood one number (SMS cost / harassment once SMS is wired) | 5 codes per number per 15 min | otpLogin.test.js |
| F6 | Medium | Store reviewers could only sign in with `OTP_ON_SCREEN=true` (which lets *anyone* sign in as *any* number) | opt-in `REVIEW_LOGINS` env: fixed codes for named demo numbers only, nothing sent or shown | otpLogin.test.js |
| F7 | Medium | Android auto-backup would copy the AsyncStorage session token to Google backups | `android.allowBackup: false` in both app configs | introspect output |
| F8 | Low | Unneeded Android permissions from the Expo template | `blockedPermissions` | introspect output |
| F9 | Low | Location pings accepted for orders not on a run | refused outside ASSIGNED…ARRIVED | — |

## Open — must be resolved before launch (not fixed: need the business's decision or credentials)

| # | Severity | Finding | What to do |
|---|---|---|---|
| B1 | **Critical** | **Production secrets are committed to git** and present in pushed history: `deploy/.stage/app/.env` holds a MongoDB URI with credentials, both JWT secrets and the Cloudinary API secret; `backend/.env`, `customer-app/.env`, `delivery-app/.env`, `website/.env.local`, `admin/.env.production`, `deploy/farmersbasket-app.env` are also tracked although `.gitignore` now ignores them. (Values were not printed or copied anywhere.) | Rotate the MongoDB password, `JWT_SECRET` + `JWT_REFRESH_SECRET` (signs everyone out) and the Cloudinary secret; `git rm --cached` the files and commit; then decide on history rewriting. Check the GitHub repository's visibility and access list. |
| B2 | **Critical** | **No SMS provider** (`auth.routes.js` TODO). In production either nobody can sign in, or `OTP_ON_SCREEN=true` is set, which lets anyone sign in to any account (and the delivery app) by typing a number. | Integrate an SMS/OTP provider (DLT-registered sender and template in India), then make sure `OTP_ON_SCREEN` is unset in production. Use `REVIEW_LOGINS` for store review. |
| B3 | High | `app.set("trust proxy", 1)`: if the API is ever reachable without exactly one proxy in front, `X-Forwarded-For` is attacker-controlled and every IP rate limit (OTP, staff login, handover code) can be bypassed. | Confirm the production topology (one reverse proxy) or set trust proxy to the proxy's address. |

## Open — recommended (not launch blockers on current evidence)

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| R1 | Medium | Session tokens in AsyncStorage / browser localStorage (readable by any script on the site in an XSS) | Move app tokens to `expo-secure-store` (Keychain/Keystore); consider httpOnly cookies for the website |
| R2 | Medium | Long-lived tokens (7 d access / 30 d refresh), refresh tokens not rotated or individually revocable | Shorter access tokens (≈15 min) with refresh rotation; add a per-user token version for "sign out everywhere" |
| R3 | Medium | Staff login: per-IP limit only, no lockout, 8-char minimum | Per-account lockout/backoff; 2FA for super admins |
| R4 | Medium | Uploads: anyone with `delivery.fulfil` (riders) may upload images to any folder name; no per-user rate limit (5 MB cap, type sniffing and folder sanitising exist) | Restrict riders to a `proof` folder or remove the permission while the app has no camera feature |
| R5 | Medium | Audit log and notifications have no retention limit; audit log stores IP and user agent | Apply internal-retention-schedule.md (TTL indexes) |
| R6 | Low | `CORS_ORIGINS` unset = all origins allowed | Confirm it is set in production (it is in the staged deploy env) |
| R7 | Low | Erased accounts free the phone number, so the same person can be referred again | Keep a keyed hash of erased numbers for referral-fraud checks only (disclose in privacy policy) |
| R8 | Low | ~~Delivered proof photos live in Cloudinary; erasure clears the URL but not the asset~~ **Resolved:** product photos are authenticated Cloudinary assets, deleted via the API on account deletion, on retake and after 90 days | — |
| R9 | Low | Website order page shows "Cancel" for orders in a return state; API refuses (409) | Hide it for RETURN_* statuses |

## Checked and found acceptable

- Riders cannot list store-wide orders, payments or returns (`roles.js`: delivery.fulfil only); every order route checks assignment (`assertAssigned`); handover code hidden from riders; wrong codes capped (5 / 15 min).
- Customers can only read/cancel/rate/return/track their own orders; support threads hide staff internal notes.
- No secrets or OTPs logged in production (OTP, push and SMS console logs are guarded by `!config.isProd`; morgan off in production). Error responses omit stacks in production.
- Production config refuses to start without `JWT_SECRET`/`MONGODB_URI` (no dev fallbacks).
- Upload endpoint: allow-list + magic-byte sniffing, 5 MB cap, folder names sanitised, branding uploads require `settings.manage`.
- Razorpay: card/UPI data entered on Razorpay's own checkout; webhook signature verified on raw body (existing razorpay.test.js).
- helmet, compression, JSON body limit 2 MB.
