# Cancellation, Return & Refund Policy

> **STATUS: DRAFT — NOT READY FOR PUBLICATION.**
> Code: cancel — backend/src/modules/orders/order.routes.js POST /:id/cancel (refused from PICKED_UP on; website and app hide the button at the same point) and order.service.js transition() CANCELLED/REJECTED (releaseStock, couponService.releaseForOrder, reverseCredits, paymentService.refund when paid). Unpaid online orders: jobs/rules.js PAYMENT_PENDING expiry.
> Returns — orders/return.routes.js: DELIVERED only; per-line eligibility from the category's `returnable` feature and `returnWindowDays` (fallback 7 days when no category can be read); RETURN_REQUESTED → RETURN_APPROVED | back to DELIVERED (declined) → RETURN_PICKED (restock or damaged write-off) → REFUNDED. Refund amount defaults to the returned lines' `payable`.
> Destination — payment.service.js refund(): "wallet" (instant), "source" (Razorpay refund) or "cash"; default from Admin → Settings → Payments "auto refund to wallet" (default ON, so online cancellations go to the wallet unless switched off). Staff can choose per return refund.
> Not reversed on a return refund in code: loyalty points and cashback credited at delivery. Not stated publicly; business decision (lawyer checklist item).
> LAWYER: (1) defaulting refunds of online payments to a non-withdrawable wallet; (2) no-refund-for-perishables position; (3) refund timelines; (4) E-Commerce Rules 2020 r.4/r.6 and the 2026 amendment's disclosure duties.

This policy explains when you can cancel an order, what can be returned, and how refunds are paid. It follows exactly what our ordering system does; where something is decided per product category or per store, this policy tells you where you will see the rule that applies to you.

## Cancelling an order {#cancel}

- **You can cancel** from Orders → your order → Cancel order, at any time until the delivery person collects the order from the store (until the order shows "Picked up"). Once it is on its way, the Cancel option disappears; contact support if there is a problem.
- **There is no cancellation charge.**
- **Unpaid online orders** — if you choose online payment and do not complete it, the order is held briefly and then cancelled automatically, and your cart is restored unless you have started a new one.
- **We may cancel or decline an order** we cannot fulfil, for example if an item is out of stock or your address is outside our delivery area. We will tell you in the app.

### What happens when an order is cancelled

- Anything you paid online is refunded (see "How refunds are paid" below).
- Wallet balance used on the order goes back to your wallet, and loyalty points used go back to your points.
- A reward coupon used on the order goes back to your account if it has not expired; an expired one is not reissued.
- For cash on delivery orders nothing has been charged, so there is nothing to refund.

## Returns {#returns}

- Returns are possible only after an order is delivered, from Orders → your order → Return items.
- **Which items can be returned, and for how long, depends on the product category.** Some categories — typically fresh and perishable items — cannot be returned. The Return items screen shows, for each item on your order, whether it can be returned and how many days are left.
- Choose the items and tell us the reason. The store reviews the request and either approves it or declines it with a reason; a declined request leaves the order as it was.
- Approved returns are collected from you. Items that are damaged when collected are recorded as such.

## Damaged, wrong or missing items {#quality}

If something arrives damaged, spoiled, wrong or missing — including perishable items that cannot be returned — raise a request in Help & support and choose the order and items. Our team may offer a refund, a replacement or another resolution.

Please tell us within [[QUALITY_COMPLAINT_WINDOW]].

## How refunds are paid {#refunds}

- **Amount** — for a cancelled prepaid order, everything paid online. For a return, the amount you paid for the returned items (after the discounts that applied to them).
- **Where** — a refund goes either to your [[BRAND]] wallet, where it is available immediately for your next order, or back to the original payment method through our payment provider. If you prefer a refund to your original payment method, tell us before the refund is issued.
- **Cash on delivery returns** are refunded to your wallet or, where the store arranges it, in cash.
- **Timing** — wallet refunds are instant. Refunds to the original payment method are started by us at once and then depend on the payment provider and your bank: [[GATEWAY_REFUND_TIME]].
- Wallet balance cannot be withdrawn as cash; it can be used on any future order.

## Rewards and refunds {#rewards}

A refund can affect Refer & Earn: if a friend's purchase that earned a referral reward is refunded below the qualifying amount, the reward coupon it earned is cancelled if it has not been used. A reward coupon already used on a delivered order is not given back if that order is later returned. See the [Referral & Coupon Terms](/referral-terms).

## Questions {#contact}

Contact Help & support, [[SUPPORT_EMAIL]] or [[SUPPORT_PHONE]]. See also the [Terms & Conditions](/terms-and-conditions).
