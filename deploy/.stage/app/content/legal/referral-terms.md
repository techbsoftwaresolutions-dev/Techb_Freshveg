# Referral & Coupon Terms

> **STATUS: DRAFT — NOT READY FOR PUBLICATION.**
> Deliberately names NO reward amounts, counts, minimums or expiry periods: all are admin-configurable (Admin → Marketing → Referral & Rewards → settings.referral: enabled, milestones[{purchases,reward}], repeatEvery/repeatReward, refereeReward, minQualifyingOrderValue, couponExpiryDays, couponMinOrderValue, combinable, maxRewardsPerReferrer, excludedCategories). The live values are shown to customers on website /account/refer and the app's Refer & earn screen (GET /referrals/me), and coupons on /account/coupons and My coupons.
> Code: backend/src/modules/referrals/referral.service.js (rules block at the top), coupon.model.js (lifecycle), coupon.service.js, pricing.service.js (reward coupon at checkout).
> Gap: an erased account's number can sign up again and be referred again (account deletion frees the number). Fraud control relies on manual review and the "misuse" clause below — see docs/legal/compliance-gap-analysis.md.

Refer & Earn rewards you with discount coupons when friends you invite shop with [[BRAND]]. These terms explain how it works. **The current rewards — how much, after how many purchases, the minimum purchase that counts and how long coupons last — are shown in your account under Refer & earn** (website: Account → Refer & earn; app: Account → Refer & earn). Those live rules are part of these terms.

## Joining with a friend's code {#joining}

- Each customer has a personal referral code and link, shown in Refer & earn.
- A new customer can use a friend's code when signing up, by opening their link, or in Refer & earn before placing their first order.
- You can be referred only once, only before your first order, and not by yourself or by someone you referred. A referral cannot be moved to another person later.

## Qualifying purchases {#qualifying}

A friend's order counts towards your rewards only when all of these are true:

- it has been **delivered and paid** (cash on delivery orders count once paid at delivery);
- it is worth at least the minimum shown in Refer & earn, measured on the value of the items after product prices and offers, but before delivery and packaging charges, wallet, points and reward coupons;
- it was delivered while the programme was running.

Orders that do not qualify are recorded but do not count.

## Rewards {#rewards}

- Rewards are **single-use coupons**, never cash or wallet money. You earn one when a friend's number of qualifying purchases reaches a milestone shown in Refer & earn; there may also be a repeating reward after the last milestone, and a total limit per person.
- Your friend may receive a one-time welcome coupon on their first qualifying purchase, as shown in Refer & earn.
- The rules that apply to a purchase are the ones in force when that purchase counts. Later changes apply only to later purchases and never change a coupon already issued.

## Using reward coupons {#coupons}

- Your coupons are listed in My coupons, each with its value, expiry date and any minimum order value.
- A coupon can be used once, on one order, before it expires. It takes a fixed amount off the items in your cart; some product categories may be excluded, and whether it can be combined with an offer code is shown at checkout.
- If the order you used a coupon on is cancelled before delivery, the coupon comes back to you if it has not expired.
- Coupons cannot be exchanged for cash, transferred or sold.

## When rewards are reversed {#reversal}

If a friend's qualifying purchase is refunded so that it falls below the minimum (or is fully refunded), it stops counting. A coupon that purchase earned is cancelled if it has not been used yet; a coupon already used stays used.

## Fair use {#fair-use}

The programme is for genuine friends and family. Referring yourself (for example with another phone number), creating accounts to collect rewards, or any other abuse may lead to rewards being cancelled, referrals being voided and accounts being blocked. We review referrals and may void ones that break these terms.

## Changes and ending the programme {#changes}

We may change the rewards and rules, or pause or end the programme, at any time; the current rules are always in Refer & earn. While the programme is paused, purchases do not count and earn nothing; existing referrals, progress and issued coupons are kept, and progress continues if it restarts. Coupons already issued can still be used until they expire.

## Questions {#contact}

Contact Help & support, [[SUPPORT_EMAIL]] or [[SUPPORT_PHONE]]. These terms are part of our [Terms & Conditions](/terms-and-conditions).
