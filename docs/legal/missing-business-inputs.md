# Missing business inputs

Nothing below was found in the repository, so nothing was invented. Website policy sentences that need a value stay **hidden** until it is entered in `website/lib/legal.js` → `LEGAL_VALUES` (then rebuild/redeploy). Values marked "found in repo" were taken from existing code and should still be confirmed.

## Identity (needed for every policy, both store accounts and invoices)

| Key | What | Where it is used | Found in repo? |
|---|---|---|---|
| `LEGAL_ENTITY_NAME` | Registered name of the business that sells and runs the apps | all policies, store developer name | no |
| `ENTITY_TYPE` | Company / LLP / partnership / proprietorship | privacy policy | no |
| `REGISTERED_ADDRESS` | Registered or principal place of business | privacy, terms, delivery notice (E-Commerce r.4) | no ("Bengaluru, Karnataka" only) |
| `CIN_OR_REGISTRATION` | CIN / LLPIN / registration number | optional display | no |
| `GSTIN` | GST number | terms; 2026 amendment display duty | no (settings.company.gstin empty by default) |
| `FSSAI_LICENCE` | FSSAI licence/registration number | terms; food e-commerce display | no |
| Brand to use | "The Farmers Basket" vs "Samagra Mart" vs "Fresh Market" | listings, app names, settings.company.name | conflicting |
| Operating state | Karnataka (site) vs Tamil Nadu (seed, tax home state 33) | tax, jurisdiction | conflicting |

## Contacts

| Key | What | Found in repo? |
|---|---|---|
| `SUPPORT_EMAIL` | support@thefarmersbasket.in | **found in repo** (website/lib/seo.js) — confirm |
| `SUPPORT_PHONE` | +91 80726 05216 / +91 63740 47119 | **found in repo** — confirm |
| `GRIEVANCE_OFFICER_NAME`, `_DESIGNATION`, `_EMAIL`, `_PHONE` | Grievance officer (E-Commerce Rules r.4; also SPDI) | no |
| `PRIVACY_CONTACT_EMAIL` | DPDP Rule 9 contact, if different | no |
| `JURISDICTION_CITY` | Courts named in the terms | no (old /terms said Bengaluru — confirm) |

## Operations and providers

| Key / item | What | Found in repo? |
|---|---|---|
| `HOSTING_PROVIDERS` | Who hosts the API/website and the MongoDB database (and where) | no |
| `SMS_PROVIDER` | OTP SMS vendor (also DLT registration) | **not integrated** |
| WhatsApp | Whether WhatsApp order updates will be switched on at launch | code exists; config unknown |
| Online payments | Whether Razorpay is live at launch (settings.payment.onlineEnabled) | default off |
| Refund default | Keep "auto refund to wallet" ON for online payments? | default ON — lawyer item |

## Policy numbers (not enforced by code; only appear once you set them)

| Key | What | Found in repo? |
|---|---|---|
| `QUALITY_COMPLAINT_WINDOW` | Time to report damaged/wrong perishables | old /terms said "24 hours of delivery" — confirm or replace |
| `GATEWAY_REFUND_TIME` | Typical time for refunds to the original method | old /terms said "usually 5–7 working days" — confirm with Razorpay |
| `FINANCIAL_RECORD_RETENTION` | How long invoices/orders/payments are kept | no — ask the CA/lawyer |
| Effective date / version | Currently "16 October 2026", version 1.0 (`LAST_UPDATED`, `POLICY_VERSION`) | set to the real publication date |

## Store accounts and review

- Google Play developer account and Apple Developer (organisation) account in the entity's name; D-U-N-S number for Apple.
- Review demo numbers and codes (`REVIEW_LOGINS`), a pincode in an active delivery area, review-hours store availability.
- Delivery app distribution decision (private vs public).
- Store listing assets: screenshots, descriptions, support URL, marketing URL, content rating answers.

## Internal owners

- Incident lead, technical lead, communications owner (breach plan).
- Data owner for the retention schedule.
- Person who processes email/phone deletion requests and verifies identity (Admin → Customers → Delete account on request; requires the users.manage permission).
