# Store checklist — delivery app "Farmers Basket Delivery"

Android `com.samagramart.partner` · iOS `com.samagramart.partner` · version 0.1.0 (delivery-app/app.config.js). Users are the store's **salaried delivery employees**; accounts are created only by an admin.

## 0. First decision: public listing or private distribution?

The app is useless to the public (no self-sign-up). Two options — **business decision, recommended: private**:
- **Private** — Google Play: a *private app* through Managed Google Play (Google's account-deletion page exempts "permanently private apps", and the Data safety page exempts private apps); or keep it on an internal-testing track. Apple: *Custom App* through Apple Business Manager, or *unlisted app distribution*. [Distribution options not re-verified this session — check current Apple/Google pages before choosing.]
- **Public listing** — every item below applies, and reviewers may question an employees-only app; the Review Notes must explain it.

## A. Google Play — checklist (public or closed track)

| ✓ | Item | Status / where |
|---|---|---|
| ☐ | Privacy policy URL: `https://thefarmersbasket.in/delivery-app-privacy` | page built — publish after review |
| ☐ | Privacy notice and usage terms reachable in the app | done: Profile → Legal & account |
| ☐ | Account deletion in-app: employee **request**, admin completes | done (Profile → Legal & account → Request account deletion; Admin → Delivery Boys → requests) |
| ☐ | Web link for deletion: `https://thefarmersbasket.in/account-deletion#delivery-staff` | page built |
| ☐ | Data safety form (draft below) | business |
| ☐ | Target API 36 | check build |
| ☐ | Permissions: INTERNET, VIBRATE only; no location | done |
| ☐ | Content rating; target audience 18+ (employees) | business |
| ☐ | App access: review login — see D | set `REVIEW_LOGINS` |
| ☐ | Ads: none | true |

## B. Google Play — Data safety draft

**Collects user data:** Yes. **Encrypted in transit:** Yes. **Deletion:** Yes — request in-app and via the web link; completed by the employer's admin (state in the form's explanation that work records the employer must keep are retained without the phone number).

| Category → type | Collected | Shared | Purposes | Notes |
|---|---|---|---|---|
| Personal info → Phone number | Yes | No | Account management, App functionality | sent at OTP sign-in |
| Personal info → Name | Yes | No | Account management | entered by the admin, shown in the app |
| Personal info → Email address | Optional | No | Account management | admin may enter |
| Personal info → User IDs | Yes | No | Account management | |
| App activity → Other actions | Yes | No | App functionality | pick-up / out-for-delivery / arrived / delivered steps, handover-code entry |
| Financial info → Other financial info | Yes | No | App functionality | cash-on-delivery amounts collected, for reconciliation |
| Location | **No** | — | — | no permission; pings API unused |
| Photos and videos → Photos | Yes | No | App functionality | product photo at the door before handover (camera only); stored on the store's servers, deleted after 90 days |
| Contacts, Messages, Files, Device IDs, Diagnostics | No | — | — | |

Customer data shown in the app (name, phone, address while on a run) is received from the server for delivery; it is covered in the customer app's form and the delivery privacy notice. If Play's form review asks, explain it is not collected *from* the delivery app's user.

## C. Apple — checklist and App Privacy draft

| ✓ | Item | Status |
|---|---|---|
| ☐ | Distribution choice (section 0) | business |
| ☐ | Privacy policy URL in ASC + in-app | done in app |
| ☐ | 5.1.1(v) in-app deletion initiation | done as a request the employer completes. Apple's deletion page does not discuss employer-managed accounts: explain in Review Notes; Apple may insist on deletion without a support step — if so, the admin flow must complete it promptly and the app must say how long it takes |
| ☐ | Demo account (2.1) with an assigned demo order | see D |
| ☐ | No purpose strings needed | verified |
| ☐ | Privacy manifest | check Xcode privacy report on the first build |

App Privacy: **Tracking: No.** Contact Info → Name, Phone Number (Yes, linked, App Functionality); Email Address (optional, linked); Identifiers → User ID (linked); Usage Data → Product Interaction (delivery steps; linked; App Functionality); Financial Info → Other Financial Info (COD collected; linked). Location: **No**.

## D. Review notes and test account

1. In Admin → Delivery Boys → Add Delivery Boy, create "App Review" with a reserved demo number.
2. On the production API: `REVIEW_LOGINS=delivery_partner:<demo number>:<6-digit code>` (comma-separate it from the customer entry). Restart.
3. Before submitting: take a demo order (demo customer, COD) to Ready for pickup in the admin and assign it to "App Review", so the reviewer sees a run. Give the reviewer the customer's 4-digit handover code from the admin order page so they can complete it.
4. Review notes text (fill in):
   > This app is for our store's own delivery employees; accounts are created by the store, there is no public sign-up. Demo: open the app, enter <number>, Continue, code <code>. A demo order is assigned: tap it, Picked up → Out for delivery → Arrived, then enter handover code <code> to complete. Account deletion: Profile → Legal & account → Request account deletion; the employer's admin completes it in the admin portal (employment and cash records). The app requests no device permissions and has no location tracking.
5. After review: remove the `REVIEW_LOGINS` entry and erase or deactivate the demo rider.
