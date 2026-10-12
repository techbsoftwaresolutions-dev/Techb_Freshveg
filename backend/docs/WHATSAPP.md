# WhatsApp order updates

Customers get a WhatsApp message when their order is confirmed, packed, out for
delivery, delivered and (optionally) cancelled — sent through the official
**Meta WhatsApp Cloud API** using templates Meta has approved.

**Status: built and tested, not live.** Nothing is sent until real Meta
credentials and approved templates are added and `WHATSAPP_ENABLED=true`.
With every variable empty the API starts and orders work exactly as before.

## What is implemented

| Piece | Where |
|---|---|
| Meta Cloud API client (templates, timeouts, error handling, signature check) | `src/modules/notifications/whatsapp.js` |
| Status → message mapping, queue with retries, delivery receipts | `src/modules/notifications/whatsapp.service.js` |
| Delivery log, retry queue and duplicate guard (one row per order + event) | `src/modules/notifications/whatsappMessage.model.js` (collection `whatsappmessages`) |
| Webhook for Meta's delivery receipts | `POST/GET /api/v1/webhooks/whatsapp` — `whatsapp.routes.js` |
| Trigger | `orderService.transition()` — after the new status is saved |
| Retry sweep | `whatsappQueue` job, every minute (`src/jobs/scheduler.js`) |
| Tests (Meta mocked, never called) | `test/whatsapp.test.js` — `npm test` |

### When each message is sent

| Order status reached | Event | Template variable |
|---|---|---|
| `ORDER_CONFIRMED` (COD at checkout; online after payment) | `order_confirmed` | `WHATSAPP_TEMPLATE_ORDER_CONFIRMED` |
| `READY_FOR_PICKUP` (packing finished) | `order_packed` | `WHATSAPP_TEMPLATE_ORDER_PACKED` |
| `OUT_FOR_DELIVERY` | `out_for_delivery` | `WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY` |
| `DELIVERED` | `order_delivered` | `WHATSAPP_TEMPLATE_ORDER_DELIVERED` |
| `CANCELLED` or `REJECTED` | `order_cancelled` | `WHATSAPP_TEMPLATE_ORDER_CANCELLED` (optional) |

- Each event goes **once per order** — enforced by a unique database index, so a
  status reached twice (e.g. a rider unassigned and the order back to "ready")
  or two processes racing cannot send it again.
- Nothing is sent for `ORDER_PLACED`, `PAYMENT_PENDING`, failed payments, or
  edits that do not change status.
- Sending is **never awaited** by the order: a slow, failing or unconfigured
  WhatsApp cannot delay, fail or roll back an order or a payment.
- Failures that may pass (timeouts, Meta 5xx, rate limits) retry after 1, 5, 15
  and 60 minutes — 5 attempts, then `failed`. Configuration errors (bad token,
  unapproved template) fail at once and log one clear line.
- A message is **skipped** (logged, not sent) when the customer has turned off
  order updates or WhatsApp in their account, or has no valid phone number.

### The log (`whatsappmessages`)

`order`, `orderCode`, `customer`, `event`, `template`, `toMasked` (e.g.
`91******3210` — the full number is never stored here), `status`
(`pending` → `sent` → `delivered` → `read`, or `failed` / `skipped`),
`messageId` (Meta's), `attempts`, `lastError` (`code`, `message`), and
timestamps. No tokens are stored or logged anywhere.

## Environment variables

Set these in the API's environment (hosting panel or `backend/.env`), never in
`.env.example`, never in git. See the security note at the end.

| Variable | Required to send | Notes |
|---|---|---|
| `WHATSAPP_ENABLED` | yes | `true` to send. Anything else (default) = off. |
| `WHATSAPP_ACCESS_TOKEN` | yes | A **permanent System User token** (see below), not the 24-hour test token. |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | The *Phone number ID* (not the phone number itself). |
| `WHATSAPP_API_VERSION` | yes | e.g. `v23.0` — any version Meta currently supports. |
| `FRONTEND_URL` | yes | The customer website, e.g. `https://thefarmersbasket.in` (for order links). |
| `WHATSAPP_TEMPLATE_ORDER_*` | per message | Approved template names. Empty = that message is not sent. |
| `WHATSAPP_TEMPLATE_LANGUAGE` | no | Language the templates were approved in. Default `en`. |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | no | Prefixed to 10-digit account numbers. Default `91`. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | no | For reference / template management; not used to send. |
| `WHATSAPP_APP_SECRET` | for receipts | Meta app secret — verifies webhook signatures. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | for receipts | Any long random string you also type into Meta. |

If `WHATSAPP_ENABLED=true` but a required value is missing, nothing is sent and
the API logs (once): `[whatsapp] WHATSAPP_ENABLED is true but … are empty`.

**Second switch:** Admin → Settings → General → Notifications → **whatsapp**
must also be ticked. It is off by default; that is the store's own on/off,
without a redeploy.

## Getting the credentials from Meta

Done by whoever owns the business's Meta account. Requires a Meta Business
account and a phone number not already used on WhatsApp.

1. **developers.facebook.com → My Apps → Create app** → type *Business* → add
   the **WhatsApp** product.
2. **WhatsApp → API Setup**: add and verify the business phone number. Copy the
   **Phone number ID** and **WhatsApp Business Account ID**.
3. **Permanent token**: business.facebook.com → Business settings → Users →
   **System users** → add one (Admin) → *Add assets* → your app and WhatsApp
   account → **Generate token** with `whatsapp_business_messaging` and
   `whatsapp_business_management`. That is `WHATSAPP_ACCESS_TOKEN`.
4. **App secret**: App → Settings → Basic → *App secret* → `WHATSAPP_APP_SECRET`.
5. Complete **business verification** and the display-name review, or Meta
   limits who you can message.

## Templates to create and get approved

WhatsApp Manager → **Message templates** → Create → category **Utility**.
Names are yours (put them in the env vars). The body **must use these
parameters, in this order** — the API fills them positionally:

| Template | `{{1}}` | `{{2}}` | `{{3}}` | `{{4}}` |
|---|---|---|---|---|
| Order confirmed | first name | order code | order total (e.g. ₹540) | order link |
| Order packed | first name | order code | order link | — |
| Out for delivery | first name | order code | expected time (or "shortly") | order link |
| Delivered | first name | order code | — | — |
| Cancelled | first name | order code | — | — |

Example — *Order confirmed*:
> Hi {{1}}, your Farmers Basket order {{2}} for {{3}} is confirmed. Track it here: {{4}}

Notes:
- No buttons, header or footer variables are sent — keep templates to body
  parameters (a static footer is fine).
- The order link is the customer's existing order page,
  `FRONTEND_URL/orders/<id>`. It asks the customer to sign in, so the link on
  its own shows nothing to anyone else. Its status timeline is the store's;
  there is no live GPS tracking.
- If a template is edited and re-approved with a different number of
  parameters, Meta rejects the sends (logged as a configuration error).

## Delivery receipts (optional, recommended)

App → WhatsApp → **Configuration → Webhook → Edit**:
- Callback URL: `https://<your API host>/api/v1/webhooks/whatsapp`
- Verify token: the value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- Then **subscribe to the `messages` field**.

Every POST is checked against `X-Hub-Signature-256` with the app secret;
unsigned or wrongly signed requests get `401`. Receipts only move a message
forward (sent → delivered → read) and repeats change nothing. They describe the
*WhatsApp message*, not the groceries — order status never changes from here.

## Turning it on

1. Create and get the templates approved.
2. Set the variables above on the server, `WHATSAPP_ENABLED=true`, restart the API.
3. Tick **whatsapp** in Admin → Settings → General → Notifications.
4. Place a test order on your own number. Check the `whatsappmessages`
   collection: `status: "sent"` with a `messageId`, then `delivered`/`read`
   once the webhook is set up.

To switch off instantly: untick it in the admin, or set `WHATSAPP_ENABLED=false`.

## Testing safely

- `npm test` runs `test/whatsapp.test.js`: Meta is mocked (no message can be
  sent) and the database is in memory.
- While trying it for real, Meta's API Setup page lets you add up to five test
  recipient numbers; only those receive messages until the number is live.

## Still needs a business decision

- **Customer opt-in.** Meta requires customers to have agreed to WhatsApp
  messages. Accounts currently default the WhatsApp preference to *on*
  (`user.notificationPrefs.whatsapp`); the sign-up or checkout should ask, or
  the default should be reviewed, before this goes live.
- **Template wording and approval** — Meta reviews each one.
- **Meta costs** — business-initiated utility messages are charged per message
  by Meta.

## Security note

Several environment files are tracked in git (`backend/.env`,
`deploy/farmersbasket-app.env`, `customer-app/.env`, `delivery-app/.env`,
`website/.env.local`, `deploy/.stage/app/.env`). `.gitignore` now ignores
environment files, but that does not untrack files already committed. Do not
put the WhatsApp token in a tracked file; untrack them
(`git rm --cached <file>`, keeping the local copy) once deployment no longer
reads them from the repository, and rotate any secret they have contained.
