# Shipping & Delivery Policy

> **STATUS: DRAFT — NOT READY FOR PUBLICATION.**
> Code: serviceability — stores/deliveryArea.service.js (Admin → Delivery Areas; else the store's pincode list), order.service.js placeOrder(). Slots — delivery/delivery.service.js availableSlots() (templates with capacity and cutoff; settings.delivery.slotDays, default 3). Charges — pricing.service.js (store deliveryCharge, freeDeliveryAbove, packagingCharge; offers can waive). Estimated time — order.delivery.expectedBy = store prep time + 30 minutes. Handover code — 4 digits, order.service.js deliveryOtp(); shown to the customer from PICKED_UP (trackingView); rider must enter it (POST /orders/:id/deliver, 5 wrong tries per 15 min). Store hours — Store.isOpenNow().
> There is no "delivery failed" status in the state machine: an undeliverable order is cancelled by staff, which refunds anything paid automatically. If the business wants a different rule for undeliverable perishables, it needs a code change first.
> We sell our own stock; delivery is by the store's salaried employees (not a courier or gig platform). No inter-state shipping exists in the code.

We deliver our own stock from our stores, using our own delivery staff. This policy explains where and when we deliver, what it costs and how the handover works.

## Where we deliver {#areas}

We deliver in [[CITY]] to the areas and pincodes our stores serve. Enter your pincode (or choose your area) and the site or app tells you whether we deliver there and which store will serve you. If we stop serving an area after you have chosen it, checkout will tell you before you place the order.

## When we deliver {#slots}

- Orders are accepted while the serving store is open; the app tells you if the store is not taking orders right now.
- Where delivery slots are offered, you choose one at checkout from the next few days. Each slot has limited capacity and stops taking orders shortly before it starts; full or closed slots are shown as unavailable.
- You can follow your order's progress in Orders. The expected delivery time shown is an estimate; traffic, weather and the number of orders can affect it.

## Delivery charges {#charges}

Any delivery charge, packaging charge and the order value above which delivery is free are set by the serving store and shown in your cart and at checkout before you pay. Some offers waive the delivery charge. A minimum order value may apply and is shown in your cart.

## The handover {#handover}

- When your order is on its way, your order page shows the name and phone number of the store employee delivering it, and a **four-digit handover code**.
- Give the code to the delivery person only when you receive your order. They need it to mark the order delivered, which is how we know it reached you.
- For cash on delivery, please pay the amount shown on your order to the delivery person.
- Never share your login OTP — the handover code is the only code a delivery person ever needs.

## If we can't deliver {#problems}

If the delivery person cannot reach you or find the address, they or the store will try to contact you on the phone number given for the address. If the order cannot be delivered and is cancelled, anything you paid is refunded as described in our [Cancellation, Return & Refund Policy](/refund-cancellation-policy).

## Problems with your delivery {#complaints}

For a late, damaged, wrong or incomplete delivery, use Help & support in the app or website, email [[SUPPORT_EMAIL]] or call [[SUPPORT_PHONE]].
