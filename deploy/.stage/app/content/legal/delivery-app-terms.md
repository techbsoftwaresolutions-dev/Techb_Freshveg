# Delivery App Usage Terms

> **STATUS: DRAFT — NOT READY FOR PUBLICATION.** For the "Farmers Basket Delivery" app. These are app-use rules for salaried store employees, not a contract for services — the employment contract and HR policies govern the job itself (pay, hours, conduct, vehicle, insurance). LAWYER: align with the employment contract; confirm no wording implies an independent-contractor or gig relationship.
> Code: state machine backend/src/modules/orders/orderStatus.js (rider moves: PICKED_UP, OUT_FOR_DELIVERY, ARRIVED, DELIVERED only via the handover code), order.routes.js (assertAssigned, handover attempts capped at 5 per 15 minutes), payments (codCollectedBy / codSettledAt, Admin → Payments → Cash on delivery), middleware/auth.js (deactivation ends sessions at once).

These terms set out how the store's delivery employees may use the Farmers Basket Delivery app. They sit alongside your employment terms with [[BRAND]], which take priority on anything about the job itself.

## Access {#access}

- The app is only for delivery employees the store has added. You sign in with a one-time code sent to your registered mobile number; never share that code or let anyone else use your account.
- The store can switch your account off at any time (for example, when you are off duty for a long period or leave); this signs you out at once.

## Doing a delivery {#deliveries}

- You see only the orders assigned to you. Mark each step honestly as it happens: picked up, out for delivery, arrived.
- Mark an order delivered only by entering the customer's four-digit handover code, given to you by the customer at handover. Do not ask customers for any other code (such as their login OTP). After several wrong codes the app makes you wait; call the store if a customer cannot find their code.

## Cash on delivery {#cash}

Collect exactly the amount shown in the app. The cash belongs to the store: hand it in at the store as instructed; the app shows how much you are holding. Your account cannot be closed while cash you collected has not been handed in.

## Customer data {#customer-data}

Use customers' names, phone numbers and addresses only to deliver the order in hand. Do not copy, photograph, share or keep them, contact customers for any other reason, or use them after the delivery. Report a lost phone or any misuse of customer data to the store immediately. See the [Delivery Staff Privacy Notice](/delivery-app-privacy).

## Safety {#safety}

Never use the app while riding or driving; stop safely first. Follow traffic laws and the store's safety instructions.

## Leaving or deleting your account {#account}

You can request deletion of your app account from Profile → Legal & account; a store administrator completes it — see [Account deletion](/account-deletion#delivery-staff).

## Contact {#contact}

Questions about the app: your store supervisor or [[SUPPORT_EMAIL]].
