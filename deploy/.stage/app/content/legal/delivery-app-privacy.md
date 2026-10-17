# Delivery Staff Privacy Notice

> **STATUS: DRAFT — NOT READY FOR PUBLICATION.** Privacy policy URL for the "Farmers Basket Delivery" app (com.samagramart.partner) in Play Console and App Store Connect.
> Delivery staff are salaried employees of the store — NOT independent or gig partners. Code: role `delivery_partner` (backend/src/modules/auth/roles.js, label "Delivery Boy"), created only by an admin (users/user.routes.js), phone-OTP sign-in. The per-delivery fee was retired (src/migrations/20261014-retire-delivery-fee.js).
> What the app reads: GET /orders/delivery/queue, /orders/delivery/history, /orders/:id — customer data trimmed by order.routes.js forViewer() (contact details only while the order is on the rider's run). The app requests NO device permissions (no location, camera, contacts, notifications); "Navigate" opens the phone's maps app, "Call" opens the dialer. The backend can store location pings (delivery/delivery.routes.js POST /orders/:id/ping, 7-day TTL) but the app does not send any today — if GPS tracking is added, this notice, the store listing and a prominent in-app disclosure must change first.
> LAWYER: interaction with the employment contract/HR policy; legal basis for employee data under DPDP s.7(i) (employment); retention of employment records.

This notice explains how [[BRAND]] handles personal data in the Farmers Basket Delivery app. The app is used only by the store's own employees who deliver customer orders. It is not open to the public and nobody can sign up for it themselves.

## Whose data, and who is responsible {#scope}

It covers you, the delivery employee, and the customers whose orders you deliver. The employer and the party responsible for this data is [[LEGAL_ENTITY_NAME]], [[REGISTERED_ADDRESS]]. Your employment is governed by your employment terms with the store; this notice covers only the app.

## Your data {#your-data}

- **Account details the store enters** — your name, mobile number, optionally an email address, your role and which stores you deliver for.
- **Sign-in** — you sign in with a one-time code sent to your number. We record when you last signed in.
- **Work records** — which orders were assigned to you, each step you marked (picked up, out for delivery, arrived, delivered) with the time, the handover-code check, and cash-on-delivery amounts you collected and when they were handed in at the store.
- **Deletion requests** you make in the app, and the store's response.

The app does not use your phone's location, camera, microphone, contacts or files, does not run in the background, and contains no analytics or advertising tools. When you tap **Navigate**, your phone's maps app opens with the address; that app's own privacy terms apply to what it does.

## Customers' data you see {#customer-data}

While an order is on your run you see the customer's name, the delivery phone number, address and delivery instructions, so you can deliver it. You never see the customer's email address, payment details, account details or the handover code (the customer gives it to you at the door). After the run, your history shows only the area, pincode and amounts of past deliveries, not the customer's contact details.

Use customer data only to deliver the order in hand — see the [Delivery App Usage Terms](/delivery-app-terms).

## Why we use your data {#purposes}

To give you access to the app, assign deliveries, confirm that orders reached customers, reconcile cash on delivery, deal with customer complaints about a delivery, and keep the records an employer and a seller must keep. Customers see your name and phone number while you are delivering their order.

## Who can see it {#access}

Store administrators and supervisors who manage deliveries. Our hosting and database providers process it on our behalf. We do not sell it or share it with advertisers.

## How long we keep it {#retention}

Your account stays while you work for the store. When it is closed (on your request or when you leave), your phone number, email and login are erased; orders you delivered keep your name as the store's record of who handled the goods and cash, for as long as accounting and tax laws require. Other employment records are kept by the store under its employment policies.

## Your rights {#rights}

You can ask the store to correct your details, and request deletion of your account in the app (Profile → Legal & account) — see [Account deletion](/account-deletion#delivery-staff). Switching your account off (deactivation) is not deletion. For questions or complaints, contact [[SUPPORT_EMAIL]] or the person named below; you can also complain to the Data Protection Board of India.

Privacy contact: [[GRIEVANCE_OFFICER_NAME]], [[GRIEVANCE_OFFICER_DESIGNATION]], [[GRIEVANCE_OFFICER_EMAIL]].

## Changes {#changes}

We will update this notice if the app changes — for example, before any location tracking is introduced — and tell you in the app.
