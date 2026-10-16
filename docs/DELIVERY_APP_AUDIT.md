# Delivery App Audit

*14 Oct 2026. Covers `delivery-app/`, the backend routes it calls, Admin → Delivery Boys, and the delivery seed.*

**Verdict.** Ready for development testing and end-to-end integration testing on a development database. Not ready for production. Three things block production:

1. Rider sign-in codes are not delivered anywhere in production (no SMS provider; see §7).
2. Live GPS tracking is not built.
3. The app has not been run on a physical device.

Four security holes in the rider API are now fixed and covered by tests. They let any rider:
- read every order, payment and return in the store;
- read other riders' runs;
- mark any order delivered without the customer's code;
- see the customer's handover code in the API data.

**Stack.** Expo SDK 57, React Native 0.86, React Navigation 7 (tabs + native stack), AsyncStorage session. Riders sign in with a phone OTP as role `delivery_partner`. They live in the same `users` collection that Admin → Delivery Boys writes to; there is no separate rider model or login system.

---

## 1. Feature inventory

Statuses use the brief's scale. "Tested" names the evidence:
- **API**: `backend/test/delivery.test.js`.
- **UI**: driven in the app's web build against an in-memory backend (§5).
- **Code**: read, not run.

| Feature | Screen / file | Status | Evidence and notes |
|---|---|---|---|
| OTP sign-in | `LoginScreen`, `AuthContext` | Functional | API + UI. Unregistered, inactive and customer numbers are refused. |
| Dev-code hint on login | `LoginScreen` | Fixed | The "Seeded partners: …" line showed in production builds. Now shown only in development builds (`__DEV__`). |
| Session restore on launch | `AuthContext` | Functional, fixed | UI. **Fixed:** no signal at launch used to sign the rider out. The last profile is now kept and screens retry (code; not run offline). |
| Token refresh | `api/client.js` | Partially tested | Refusal after deactivation tested (API). The successful-refresh path was not exercised. |
| Session ended by the server | `client.js`, `AuthContext` | Fixed | UI: deactivating a rider in admin returned the app to sign-in on the next request. Before, the app stayed open with every request failing. |
| Sign out | `ProfileScreen` | Partially functional | Clears the phone's session only; the backend has no logout route to revoke the refresh token. The confirm dialog uses `Alert`, which does nothing on the web build, so this was not clickable there (code; native untested). |
| Profile, today's and 7-day figures | `ProfileScreen` | Functional, fixed | UI. **Fixed:** a failed load used to show zeros as if real; it now says it couldn't load. |
| Queue ("My runs"), today's counts, cash to hand in | `QueueScreen` | Functional | API + UI. Real data only. Delivery boys are salaried store employees, so there are no per-delivery earnings (retired 14 Oct 2026; see `src/migrations/20261014-retire-delivery-fee.js`). |
| Run detail (pickup / drop, items, cash vs prepaid) | `DeliveryScreen` | Functional | API + UI. |
| Status steps (picked up → on the way → arrived) | `DeliveryScreen` | Functional, fixed | API + UI. Persisted with timestamps and the rider as actor. **Fixed:** there was no check the order belonged to the rider. |
| Handover with the customer's code | `DeliveryScreen` | Functional, fixed | API + UI: a wrong code is refused, the right code delivers, cash on delivery is marked paid. **Fixed** (see §3): the code was visible to the rider, `/status` could skip it, and guesses were unlimited (now 5 per 15 minutes per order). |
| "Delivered" screen → back to queue | `DeliveredScreen` | Fixed | UI. Used `replace("Tabs")`, which stacked a second, stale copy of the tabs; now `popToTop()`. |
| History (7 days, by day) | `HistoryScreen` | Functional, fixed | API + UI. **Fixed:** a failed load used to read "No completed deliveries"; it now shows the error. |
| Call / navigate | `components/ui.js` | Code only | `tel:` and maps deep links; need a device. |
| Report a problem | `DeliveryScreen` | UI only | An alert that says to call the store; in-app reporting was never built. |
| Live GPS tracking | — | Not implemented | `POST /delivery/orders/:id/ping` and `GET …/position` exist, but the app never sends a position and no customer screen shows one. The admin's "Live rider tracking" toggle has no effect. |
| Proof photo / signature | — | Not implemented | Order fields and upload permission exist; the app has no capture UI. The admin's "Require a photo / signature" toggles are not enforced. |
| "Require a handover OTP" setting | — | Not implemented | A code is always generated and required, whatever the toggle says. |
| Push notifications to riders | — | Not implemented | No push registration in the app. |
| Accept / reject an assignment | — | Not in the model | The state machine has no rider accept step; reassignment is the admin's (Ready for pickup ↔ Assigned). |
| Failed-delivery state | — | Not in the model | No "failed attempt" status; cancellation is staff-only. |
| Empty-state icons | `components/ui.js`, screens | Fixed (cosmetic) | Emoji had been stripped, leaving blank 46 px gaps; empty icons are no longer drawn. |

## 2. API audit

Every endpoint the delivery app calls, plus the admin endpoints that manage riders. "Rider" means the `delivery_partner` role.

| Method + route | Caller | Auth / rule | Result |
|---|---|---|---|
| `POST /auth/otp/request` | Login | Public; 10 per IP per 15 min | Pass |
| `POST /auth/otp/verify` (`role: delivery_partner`) | Login | Must be an existing, active rider | Pass. Unknown, customer and inactive numbers get 403; the inactive message now reads "This account is inactive…" |
| `GET /auth/me` | AuthContext | Any token; staff re-checked every request | Pass |
| `POST /auth/refresh` | client.js | Refresh token; account must be active | Refusal: pass. Success: not exercised |
| `GET /orders/delivery/queue` | Queue, Delivery, Profile | Rider or staff | Pass. **Fixed:** `?partner=` let a rider read anyone's queue; now riders always get their own. Handover code removed |
| `GET /orders/delivery/history` | History, Profile | Same | Pass. **Fixed:** same `?partner=` hole; code removed |
| `GET /orders/:id` | Delivery | `orders.view`, or `delivery.fulfil` for **own assigned** orders | Pass. **Fixed:** riders held `orders.view` and could open any order; code removed |
| `POST /orders/:id/status` | Delivery | `orders.manage` / `delivery.fulfil` + state machine + **own order** | Pass. **Fixed:** no ownership check; a rider could move another rider's order or set `DELIVERED` without the code (now 400) |
| `POST /orders/:id/deliver` | Delivery | Rider/staff, own order, customer's code | Pass. **Fixed:** wrong-code cap (5 per 15 min per rider per order); a second handover gets 409 |
| `POST /delivery/orders/:id/ping` | *(not called)* | Rider/staff, own order | Not exercised; no caller |
| `GET /delivery/orders/:id/position` | *(not called)* | Customer owner or `delivery.view` | Rider gets 403 now (added check) |
| `GET /orders`, `/payments`, `/returns`, `/delivery/report`, `/orders/:id/track` | *(not the app)* | `orders.view` / `delivery.view` / owner | **Fixed:** riders could read all of these. Now 403 for riders (tested) |
| `GET /users?role=delivery_partner` | Admin → Delivery Boys | `users.manage` | Pass (API + UI) |
| `POST /users` | Admin → Add Delivery Boy | `users.manage`, role assignable by the actor | Pass. Bad input gets 422 per field, a duplicate phone 422, supervisor/customer/rider 403 |
| `PATCH /users/:id` `{status}` | Admin → Deactivate / Activate | `users.manage` | Pass. Takes effect on the rider's very next request |
| `GET /orders/delivery/partners` | Admin → Order → Assign | `orders.assign` | Pass. Lists active riders with today's load; inactive riders are excluded |
| `POST /orders/:id/assign` | Admin → Orders table (Save), Order → Assign | `orders.assign`; only at Ready for pickup, or Assigned (reassign before pickup) | Pass (API + UI). Refused while preparing, once collected, and when closed |
| `DELETE /orders/:id/assign` | Admin → Orders table (Remove) | `orders.assign`; only before pickup | Pass (API + UI). Back to Ready for pickup with the rider cleared; recorded in the audit log |
| `GET /orders/:id/track` | Customer website / app | Owner | Pass. Shows each rider step, and the code while out for delivery |

**Root cause of the access holes.** The rider role carried `orders.view` and `delivery.view`: the store-wide permissions for the order, payment, return and delivery-report lists. Riders now hold only `delivery.fulfil`. The routes they need check that the order is assigned to them (`assertAssigned`), and strip `delivery.otp` from what they receive (`forViewer`); both helpers are in `order.routes.js`. Admin, supervisor and customer access is unchanged.

**No mock data** is used anywhere in the delivery app. The API base URL comes from `API_BASE_URL` (via `app.config.js`, falling back to `http://localhost:5055`).

## 3. Admin integration findings

Accounts an admin creates work in the delivery app. Proven end to end through the real admin UI and the real app (§5):

1. **Add Delivery Boy** shows a form with the role fixed to Delivery Boy and no password field; riders sign in by OTP.
   - Inline errors appeared for an empty name and a short phone.
   - A duplicate phone was refused with "Another staff account already uses this phone number".
   - The new account appeared in the list.
2. Same identity end to end. Records are in `users` with `role: delivery_partner`, unique on `{phone, role}`. The app signs in with the same pair, and the JWT's role and permissions come from `roles.js`. A customer with the same phone stays a separate account.
3. The new rider signed in, saw their own profile and an empty queue. After the admin assigned an order, it appeared in their queue only.
4. **Deactivate** blocks the rider at once:
   - the existing token gets 401 on the next request, and the app returned to sign-in;
   - refresh gets 401;
   - a new sign-in gets 403.
   **Activate** restores access.

Fixes made here:
- the inactive-rider message wording;
- the app returning to sign-in when the server ends the session.

The admin portal itself needed no changes.

## 4. Seed setup

**Scripts** (in `backend/package.json`):

| Command | What it does |
|---|---|
| `npm run seed:delivery:dev` | Adds the delivery fixtures. Runs the base seed (`npm run seed`) first if the catalog is missing. Safe to repeat. |
| `npm run seed:delivery:clean -- --yes` | Cancels the open fixture orders (releasing their stock through normal cancellation), then deletes every fixture order and its payment rows. Keeps the rider and customer accounts. Refuses without `--yes`. |
| `npm run test:delivery:integration` | The delivery integration tests on an in-memory MongoDB. Also part of `npm test`. |

**Test data** (`backend/src/seed/delivery.js`). All phone numbers are placeholders, not real people.

| Kind | Data |
|---|---|
| Riders | `9000000003` Kumar (active), `9000000004` Ravi (active), `9000000005` Inactive Rider (sign-in refused) |
| Customer | `9876500010` Delivery Test Customer, with a Hosur 635109 address. Kept separate so seeding never touches the main test customer's cart. |
| Orders | Cash on delivery, store HSR01, 2 kg tomatoes + 5 kg rice. Stages: **Ready for pickup** (unassigned, for admin assignment) · Kumar **Assigned** · Kumar **Out for delivery** · Kumar **Arrived** (the seed prints its handover code) · Kumar **Delivered** today · Ravi **Assigned** |

Orders are created with the real cart and order services and walked through the real state machine, so stock reservations, payment rows, timelines and handover codes are what production would make. Only inside the seed process is the store treated as open, so it works at night; nothing about the store is saved.

**Safety:**
- Re-running creates nothing and never rewinds an order a tester has moved on. Riders are matched by phone; orders by a `[dev-seed:delivery] <key>` tag in their customer note.
- Logs list what was created and what already existed.
- Exits non-zero on failure.
- Never drops the database.
- **Every seed** (`seed`, `seed:reset`, `seed:delivery:*`) now refuses `NODE_ENV=production`, and refuses any database not on localhost/127.0.0.1, unless you name it explicitly with `SEED_ALLOW_DATABASE=<db name>` (`src/seed/guard.js`).
  - Before this, `npm run seed:reset` with the committed `backend/.env` would have emptied the production `farmers-basket` database.
  - `npm run seed` would have created admin accounts with known passwords there.
  - Both commands now stop before connecting (verified).
  - `seed:farmers` is not guarded.

**To run it** (needs Node and a local MongoDB):

```bash
# backend/.env points at production, so override the database for this shell
cd backend
export MONGODB_URI="mongodb://127.0.0.1:27017/farmers_dev"
npm run seed:delivery:dev
npm run dev     # with the same MONGODB_URI
```

No local MongoDB? `npm run demo` serves the API on an in-memory database. Its log prints the database URI; run the seed with `MONGODB_URI=<that URI>`.

**Sign in and test:**
1. Delivery app: set `API_BASE_URL` in `delivery-app/.env` to your machine's LAN address (or `http://localhost:5055` for the web build), then `npx expo start -c`.
2. Enter `9000000003` and press **Send code**. Outside production the code appears on screen.
3. Kumar's queue shows three runs, not Ravi's.
4. Open the **Arrived** run and enter the handover code the seed printed. The customer also sees it on their order page while the order is out.
5. In Admin → Orders, assign the **Ready for pickup** order to a rider. It appears in that rider's queue on the next refresh.

**Clean up:** `npm run seed:delivery:clean -- --yes`, then `npm run seed:delivery:dev` for a fresh set.

**Environment variables:**
- `MONGODB_URI` (development database)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` (development fallbacks exist outside production)
- `SEED_ALLOW_DATABASE` (only to seed a non-local development database)
- `API_BASE_URL` in `delivery-app/.env`

## 5. Test results

| Check | Command / method | Result |
|---|---|---|
| Delivery integration (13 tests: seed, repeat seed, admin create/validate/duplicate/list, OTP sign-in, isolation, assignment, every transition, invalid and duplicate transitions, handover, code cap, deactivation, clean-up + stock release) | `npm run test:delivery:integration` | **13/13 passed** |
| Full backend suite | `npm test` | **74/74 passed** |
| Smoke script | `npm run smoke` | **149/150.** The failure is "a loose item snaps to the 0.25 kg step" (got 1), a cart rule in code this work didn't touch; the catalog moved to whole units earlier |
| Seed CLI on an empty in-memory database | `npm run seed:delivery:dev` ×2, `seed:delivery:clean` with and without `--yes` | Passed. First run seeded the base catalog then the fixtures; second run created nothing; clean-up refused without `--yes`, then removed 6 orders + 6 payment rows |
| Seed refuses production | `npm run seed:delivery:dev`, `npm run seed:reset` with the real `backend/.env`; `NODE_ENV=production` | Passed. Refused before connecting |
| End-to-end, real UIs, in-memory backend | Admin portal + delivery app web build (375 px) | Passed (steps below) |
| Delivery app bundles | `npx expo export --platform android / ios / web` | All three bundled |
| Dependency check | `npx expo install --check` | **Warning:** `expo-constants` 57.0.20, expected ~57.0.21 (predates this work; `npx expo install --fix` updates it) |
| Lint / type check | — | **Skipped:** neither the delivery app nor the backend has a linter or TypeScript |
| Physical device: GPS, calls, maps, Android back, push | — | **Blocked:** no device or emulator was used |
| Production SMS OTP | — | **Blocked:** no SMS provider is wired up (`auth.routes.js` TODO) |

The end-to-end run, in order:
1. Seeded the in-memory backend.
2. Admin listed the seeded riders.
3. Admin created Arun (9000000020) through the form, including the validation and duplicate errors.
4. Arun signed in to the app and saw an empty queue.
5. Admin assigned the Ready for pickup order to Arun from the order page; the picker listed active riders only.
6. Arun's queue showed it, and he walked Picked up → Out for delivery → Arrived. Each step was saved as his, with timestamps; the customer saw "Your delivery partner has arrived".
7. A wrong code was refused; the right code delivered.
8. Admin and customer both showed Delivered, and payment was paid.
9. Arun's queue showed ₹25 earned and ₹797 cash, and History listed the order.
10. Admin deactivated Arun: the app returned to sign-in, and his sign-in was refused.
11. Kumar signed in and saw only his three runs.
12. Kumar's handover went back to a single, refreshed queue.
13. Re-running the seed left every progressed order as it was.

## 6. Files changed

**Backend**
- `src/modules/auth/roles.js`: the rider role now holds only `delivery.fulfil`.
- `src/modules/orders/order.routes.js`:
  - `assertAssigned` and `forViewer`;
  - rider scoping on `GET /:id`, `/status`, `/deliver`, queue and history;
  - riders refused `DELIVERED` via `/status`;
  - the handover-code attempt cap.
- `src/modules/delivery/delivery.routes.js`: rider ownership check on `position`.
- `src/modules/auth/auth.routes.js`: the inactive-rider message.
- `package.json`: the `seed:delivery:dev`, `seed:delivery:clean` and `test:delivery:integration` scripts.

**Seed scripts**
- `src/seed/guard.js` (new): the development-database guard.
- `src/seed/delivery.js` (new): the fixtures and clean-up.
- `src/seed/run.js`: now guarded.

**Tests**
- `test/delivery.test.js` (new).

**Delivery app**
- `src/api/client.js`: session-ended hook.
- `src/context/AuthContext.js`:
  - keeps the session through an offline launch;
  - returns to sign-in when the server ends the session;
  - caches the profile.
- `src/screens/LoginScreen.js`: the dev hint shows in development builds only.
- `src/screens/HistoryScreen.js` and `src/screens/ProfileScreen.js`: error states.
- `src/screens/DeliveredScreen.js`: `popToTop`.
- `src/components/ui.js`: blank icon gap.

**Admin portal**
- None.

**Documentation**
- `docs/DELIVERY_APP_AUDIT.md` (this file).
- `PROJECT_CONTEXT.md`: the rider role row and the order-detail permission.

## 7. Remaining issues

1. **Production rider sign-in has no SMS.**
   - `deploy/farmersbasket-app.env` sets `NODE_ENV=production` with no `OTP_ON_SCREEN`, and the SMS hand-off is a TODO. As committed, sign-in codes reach no one (customers included).
   - Turning `OTP_ON_SCREEN` on in production is not a fix: it would show any phone's code on screen to whoever types the number.
   - Wire an SMS provider.
2. **Live tracking:** the app would need `expo-location` (foreground pings while out for delivery), and the customer screens would need to read `/position`. Until then, the admin's "Live rider tracking" toggle does nothing.
3. **Proof photo / signature** and the **"Require a handover OTP"** toggle are stored but not enforced or captured.
4. **No server-side logout:** sign-out cannot revoke the refresh token. The usual fix would be a token version on the user, checked at refresh.
5. **Riders deactivated mid-run keep their orders assigned.** The admin must reassign them; the Delivery Boys list shows each rider's "On the road" count.
6. **Report a problem** is a placeholder alert; `Alert` dialogs (it and sign-out) don't work in the web build.
7. **No device testing yet:** GPS, calls, maps, Android back and the offline-launch path.
8. `expo-constants` is one patch behind the SDK.
9. The **smoke script's cart-step check** (0.25 kg) is out of date with the whole-units catalog.
10. **Your local backend uses the production database.** `backend/.env` points at production `farmers-basket` with `NODE_ENV=development`, so the local backend returns OTP codes in API responses while reading and writing production data. Use a separate development database.
11. `seed:farmers` is not covered by the seed guard.

## 8. Readiness assessment

| Use | Ready? |
|---|---|
| Development testing on a development database | **Yes.** Seed, sign in, run and hand over orders; data access is correctly scoped |
| End-to-end integration testing (admin ↔ app ↔ customer) | **Yes** on the web build and API. Native device runs still need doing |
| Production | **No.** Wire SMS OTP delivery, run on real devices, and decide on live tracking and proof-of-delivery (or remove those admin toggles) |
