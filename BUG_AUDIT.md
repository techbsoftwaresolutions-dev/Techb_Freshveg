# Bug audit — 27 October 2026

No application fixes have been made. IDs below are intended for selecting fixes one at a time.

## Verification and limits

- Manual source review: backend order, payment, inventory, return, authentication and pricing paths, plus customer checkout integration. This is source-level manual review, not a completed browser/device walkthrough.
- All 107 backend JavaScript files passed `node --check`.
- `admin`: `npm.cmd run build` passed; bundle-size warning only.
- `website`: build failed fetching Poppins through `next/font` (EACCES/network restriction). A complete production build is unverified; this is not evidence of a UI defect.
- `backend`: existing in-memory MongoDB smoke suite: **149 passed, 1 failed**. Failure: loose quantity expected a 0.25 kg step but got 1. Whole-unit migration exists, so this may be a stale test rather than a product defect; confirm intended quantity policy before fixing.
- `node backend/audit-checks.cjs`: four defect probes reproduced. These use real service logic with mocked persistence/dependencies, no database or external payment calls. They prove service behavior, not a complete HTTP exploit test.
- Native mobile builds, visual layout, real SMS, real payments, and concurrent database stress tests were not performed. This audit cannot guarantee discovery of every hidden bug.

## Findings

### B01 — Critical: customers can confirm manual payments without paying
Evidence: `backend/src/modules/payments/gateways.js:29`, `payment.service.js:93`, `payment.routes.js` customer confirm endpoint.
The manual provider always returns successful verification. The customer-accessible confirm route accepts this result and advances a pending order to confirmed. There is no staff verification requirement for manual UPI payment.
Reproduction: create a manual-provider payment, then confirm with an empty proof object. Audit probe observes status `captured` and the full amount recorded as captured.
Suggested fix: reject customer confirmation of manual payments; require an authorized staff reconciliation flow. Fail closed when a real gateway becomes unavailable.
Status: reproduced with isolated service probe and route review.

### B02 — Critical: delivery status endpoint bypasses assignment and OTP
Evidence: `backend/src/modules/orders/order.routes.js:196`, `order.service.js:223`.
The generic status route allows `delivery.fulfil`, then calls `transition` directly. It does not enforce assigned rider ownership or call the OTP-protected completion function. A rider can submit DELIVERED for another rider's eligible order.
Reproduction: transition an OUT_FOR_DELIVERY order as a different delivery partner without supplying OTP. The audit probe observes delivery and stock dispatch.
Suggested fix: enforce assignment and route all delivery completion through the proof-validation flow.
Status: reproduced with isolated service probe and route review.

### B03 — High: declining a return dispatches stock and grants rewards again
Evidence: `backend/src/modules/orders/return.routes.js:184`, `order.service.js:264`.
Decline transitions RETURN_REQUESTED back to DELIVERED. The DELIVERED handler reruns inventory dispatch, reward credit and delivery timestamp assignment, and also reruns COD collection for COD orders.
Reproduction: deliver an order, request a return, decline it. The probe verifies a new dispatch and loyalty earn call on decline.
Suggested fix: distinguish restoration of delivered status from first delivery; make delivery side effects idempotent.
Status: reproduced with isolated service probe.

### B04 — High: rider responses expose the customer's delivery OTP
Evidence: `backend/src/modules/orders/order.routes.js:390`, `order.model.js:187`, `order.routes.js:114`.
Delivery queue serializes the full order, including `delivery.otp`. Tracking also returns an OTP to users with orders.view, which delivery partners hold. The rider can read the supposed customer-only proof before handover.
Reproduction: inspect a rider's queue response or track an out-for-delivery order; the OTP is present in the serialized data.
Suggested fix: use explicit rider response fields and expose OTP only to the owning customer.
Status: confirmed by source review; HTTP reproduction pending.

### B05 — High: concurrent stock reservations can oversell
Evidence: `backend/src/modules/inventory/inventory.service.js:171`.
Reservation reads available stock, checks it, then saves a new reserved value. Two callers can both read one available unit, both succeed, and overwrite reserved with 1 despite two successful reservations. Checkout supplies no transaction.
Reproduction: synchronize two reservations against the final stock unit.
Suggested fix: conditional atomic increment with an available-stock predicate, plus consistent movement logging.
Status: source-confirmed race; concurrent DB reproduction pending.

### B06 — High: checkout failures after reservation leave partial orders and locked stock
Evidence: `backend/src/modules/orders/order.service.js:172` and `:177`.
Rollback only surrounds the reservation loop. Order save, wallet debit and loyalty redemption run afterward without compensating rollback. A wallet-balance change between pricing and debit can leave a saved ORDER_PLACED order, active cart and reserved inventory despite checkout returning an error. Concurrent checkout requests can also both read the same active cart before conversion.
Suggested fix: atomic checkout claim/idempotency and a transaction or complete compensation for every side effect.
Status: source-confirmed failure paths; integration fault injection pending.

### B07 — High: picked quantities do not update billing or release unused reservations
Evidence: `backend/src/modules/orders/order.routes.js:221`, `order.service.js:276`.
Picking only saves pickedQuantity. It does not reprice the order or release the difference from the original reservation. Delivery dispatches pickedQuantity. Order 5 units, pick 3: billing remains for 5 and 2 units remain reserved. There is also no minimum constraint on pickedQuantity in the model; negative quantities can increase stock in dispatch.
Suggested fix: validate quantities, reconcile reservations and explicitly calculate adjustments/refunds before completion.
Status: confirmed by source review.

### B08 — High: source refunds can be marked completed without moving money
Evidence: `backend/src/modules/payments/payment.service.js:166`, `:202`, `:216`.
Source refunds only execute if a captured payment with providerPaymentId is found. Otherwise execution still marks the refund completed. After a first partial refund the payment status becomes partially_refunded, so the next lookup restricted to captured misses it. A second explicitly requested source refund can therefore complete only on paper.
Suggested fix: include partially refunded payments and reject unsupported/missing source payment details before creating a completed refund.
Status: confirmed by source review.

### B09 — Medium: payment retry returns the wrong response shape
Evidence: `backend/src/modules/payments/payment.service.js:27`.
An existing idempotency key returns a bare Payment document; the caller expects `{ payment, checkout }`. Retrying the same key yields undefined payment/checkout fields. Lookup is also global rather than scoped to customer and order.
Suggested fix: return the same envelope on every path and scope/validate idempotency ownership.
Status: reproduced with isolated service probe.

### B10 — Medium: configured loyalty point value is ignored during checkout
Evidence: `backend/src/modules/pricing/pricing.service.js:326`, `backend/src/modules/loyalty/loyalty.service.js:99`, `backend/src/modules/settings/settings.model.js:52`.
Cart pricing hardcodes 10 paise per point while loyalty redemption uses configured pointValuePaise. Changing that setting produces inconsistent checkout discounts and redemption value.
Reproduction: configure a point value other than 10 and apply points at checkout.
Suggested fix: use one configured conversion policy for pricing, point debit and ledger value.
Status: confirmed by source review.

## Other observations requiring verification

- Rider queue/history accept an arbitrary partner query parameter without restricting it for delivery_partner users (`order.routes.js:353`, `:426`), exposing other riders' orders and customer addresses.
- Customer app displays manual UPI controls whenever any UPI method is returned, including a Razorpay-only setup with no manual VPA (`customer-app/src/screens/CheckoutScreen.js:160`). That configuration needs device testing: it can display an empty payee ID and a QR endpoint that returns 404.
- Root README describes a different frontend and instructs running npm at a root with no package.json. Onboarding instructions are stale.

Recommended order: B01, B02, B04, B03, then inventory/checkout/refunds. Repair each with a regression check before proceeding to the next.
