# Account Deletion & Data Retention

> **STATUS: DRAFT — NOT READY FOR PUBLICATION.** This is the web page entered as the "delete account URL" in Play Console (Data safety → Data deletion) and linked from both apps.
> Code: backend/src/modules/auth/accountDeletion.service.js (what is erased/kept — keep this page in step with scrubCustomer/scrubAccount/eraseDeliveryStaff), routes GET/POST /auth/me/deletion, POST /customers/:id/erase (admin, on request), POST /users/:id/erase and /users/deletion-requests (admin). Tests: backend/test/accountDeletion.test.js.
> Internal schedule with periods and owners: docs/legal/internal-retention-schedule.md.
> LAWYER: wallet balance forfeiture on deletion (consumer money from refunds); retention periods for orders/invoices; whether anonymised order rows still count as personal data.

You can delete your [[BRAND]] shopping account at any time, from the app or from this page — you do not need the app installed. Deleting erases your personal details for good. It is different from signing out, and different from an account being blocked or switched off, which keeps everything.

## How to delete your account {#how}

- **In the app:** Account → Legal & about → Delete my account.
- **On the website:** sign in on this page with your account's mobile number, then confirm. This works even if you have uninstalled the app.
- **No access to your number any more?** Email [[SUPPORT_EMAIL]] from the email address on your account (or call [[SUPPORT_PHONE]]). We will check that the account is yours before deleting it on your behalf.

You will be asked to type DELETE to confirm. If you have a wallet balance, loyalty points or unused reward coupons, we show them and ask you to confirm that you give them up.

## How long it takes {#timing}

Deletion happens **immediately** when you confirm, and you get a reference number. Every device signed in to your account is signed out at the same moment. Requests sent by email or phone are completed after we have verified them, within the time the law allows.

## When deletion has to wait {#blockers}

To protect your money and your orders, we ask you to finish these first; the deletion screen lists any that apply:

- an **order still in progress** — cancel it, or wait until it is delivered, cancelled or its return is refunded;
- a **refund that has not completed**;
- an **open support request** — ask support to close it.

## What is deleted {#deleted}

- Your name, mobile number, email address and saved addresses.
- Your reviews and ratings (product ratings are recalculated without them).
- Your cart, wishlist, notifications and notification preferences.
- Your referral code; unused reward coupons are cancelled.
- Your wallet balance and loyalty points (written off, after you confirm).
- On your past orders: your name, phone number, email, street address, landmark, map location, delivery instructions, order notes, review comments and delivery photo.
- In our support records: your name and phone number.
- Personal details in payment providers' raw responses stored with our payment records.

Your mobile number becomes free: if you sign up again later with it, you get a new, empty account.

## What we keep, and why {#kept}

- **Orders, invoices, payments, refunds and the wallet and points ledgers** — kept without your name or contact details, because tax and accounting laws require these records (currently for [[FINANCIAL_RECORD_RETENTION]]) and to deal with chargebacks and disputes. The city, state and pincode of the delivery address stay on the order because they determine the tax on the invoice.
- **Closed support requests** — the messages, without your name and phone number, as a record of complaints and how they were resolved.
- **A deletion record** — the reference number, the date, the last four digits of your phone number and what was forfeited, so we can confirm the deletion and honour any later claim.

These records are kept in a form that no longer shows who you are, and only authorised staff can see them. Our payment provider keeps its own records of online payments under its own legal obligations.

## Delivery staff {#delivery-staff}

Delivery staff are employees of the store. If you use the Farmers Basket Delivery app, open **Profile → Legal & account → Request account deletion**. Your account stays active until a store administrator completes the request; they may first need you to finish any deliveries in hand and hand in cash collected. When it is completed, your phone number, email and login are erased and you are signed out. Orders you delivered keep your name, as the store's record of who handled the goods and cash. Records your employer must keep under employment law are handled separately by the store. If a request is declined, the app shows the reason. Switching an account off (deactivation) is not deletion. You can also write to [[SUPPORT_EMAIL]].
