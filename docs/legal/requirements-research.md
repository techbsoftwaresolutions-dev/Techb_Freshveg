# Requirements research — Google Play, Apple, Indian law

Checked **16 October 2026**. This is a reading aid for the business and its lawyer. It is **not legal advice** and does not establish that either app is compliant or will be approved.

How each item was verified:
- **[Official]** — read on the official page this session.
- **[Secondary]** — the official text could not be loaded (HTTP 403, refused connection or unreadable PDF); taken from named law-firm/legal-publisher summaries. Confirm against the Gazette.
- **[Not re-verified]** — from general knowledge; nobody read a source for it this session. Treat as a lead for the lawyer, not a fact.

## 1. Status at a glance

| Requirement | Status on 16 Oct 2026 | Applies to | Verified |
|---|---|---|---|
| Google Play User Data policy (privacy policy, account deletion in-app + web link, prominent disclosure) | **In force** | Both apps | Official |
| Google Play Data safety form incl. data-deletion questions | **In force** (enforcement since 31 May 2024) | Both apps | Official |
| Google Play target API level 36 (Android 16) for new apps and updates | **In force since 31 Aug 2026** (extension requests to 1 Nov 2026) | Both apps | Official |
| Google Play location-button / contact-picker policy changes | **Takes effect 27 Jan 2027** | Neither app today (no location or contacts permission) | Official (banner only) |
| Apple App Review Guidelines 5.1.1 (privacy policy in ASC and in-app; in-app deletion initiation), 5.1.2, 2.1, 3.1.3(e), 4.8 | **In force** (guidelines last updated 8 Jun 2026) | Both apps | Official |
| Apple App Privacy ("nutrition label") | **In force** | Both apps | Official |
| Apple privacy manifest / required-reason APIs | In force for SDKs Apple lists | Both iOS builds | **Not verified** — Apple's page did not render; check Xcode's privacy report on the first EAS iOS build |
| DPDP Act 2023 — Data Protection Board, definitions (Rules 1, 2, 17–21) | **In force** since the Rules' notification (13/14 Nov 2025) | Business | Secondary + PIB |
| DPDP Rule 4 — Consent Manager registration | **From ~13/14 Nov 2026** | Not needed by this business | Secondary (sources differ) |
| DPDP substantive duties — notice (R3), security (R6), breach intimation (R7), erasure/retention (R8), contact (R9), children (R10), rights/grievances (R14) | **Takes effect ~13/14 May 2027** (18 months) | Business, both apps | Secondary + PIB ("eighteen-month period", "ninety days" for requests) |
| Proposal to shorten DPDP phase-in to 12 months | **Reported, not notified** (as of 8 Sep 2026) | — | Secondary — re-check before launch |
| DPDP (Removal of Difficulties) Order 2026 (notified 5 Oct 2026, in force 6 Oct 2026) | In force; rewords Act ss. 9(1), 10(2)(c)(ii); no change to commencement | — | Secondary (SCC Online) |
| IT Act s.43A + SPDI Rules 2011 (privacy policy, grievance officer, consent for sensitive data) | **In force now** until DPDP repeals s.43A | Business | Not re-verified |
| CERT-In Directions (Apr 2022): incident reports within 6 hours, logs kept 180 days | In force | Business | Not re-verified (6-hour figure also cited by a secondary DPDP source) |
| Consumer Protection (E-Commerce) Rules 2020 — Rule 4 (display legal name/address/contacts, grievance officer, 48h acknowledge / 1 month resolve), Rule 6 (inventory-model disclosures) | **In force** | Business; website and customer app | Secondary — official PDF refused connection |
| Consumer Protection (E-Commerce) (Amendment) Rules 2026 (notified 9 Sep 2026) | **Takes effect 1 Jan 2027** | Business; website and customer app | Secondary (SCC Online, Lexorbis) |
| CCPA Dark Patterns Guidelines (30 Nov 2023) | **In force**; annual self-audit duty from 1 Jan 2027 under the 2026 amendment | Website and customer app | Secondary |
| Legal Metrology (Packaged Commodities) e-commerce label display; FSSAI licence display for food e-commerce | In force | Product pages | Not re-verified (outside this task's code changes) |

## 2. Google Play

Sources (all read this session):
- Account deletion requirements — https://support.google.com/googleplay/android-developer/answer/13327111
- Data safety section — https://support.google.com/googleplay/android-developer/answer/10787469
- User Data policy — https://support.google.com/googleplay/android-developer/answer/10144311
- Permissions and APIs that access sensitive information — https://support.google.com/googleplay/android-developer/answer/9888170 (served as answer/16558241)
- Target API level requirements — https://support.google.com/googleplay/android-developer/answer/11926878

What applies here:
- **Account deletion.** Any app that lets users create an account must offer (a) an in-app path to delete the account and associated data, prominently placed (e.g. account settings), and (b) a working web link where deletion can be requested without reinstalling the app, naming the app/developer as on the listing. The link goes in the Data safety form. Deactivation/"freezing" is not deletion. Data kept for security, fraud prevention or regulatory compliance must be disclosed (e.g. in the privacy policy). Ask processors to delete too; complete within a "reasonably quick" time.
  - Delivery app: accounts are created by the employer, not by users. Google's text ties the duty to account creation "within your app"; the page does not discuss employer-provisioned accounts. Conservative position taken: provide the in-app request and the web section anyway. **Platform-specific; confirm with Play policy support if questioned.**
- **Data safety.** Required for all apps, even ones that collect nothing; must match the privacy policy. "Collected" = sent off the device (including by SDKs). Transfers to service providers processing on your instructions, legally required transfers and user-initiated transfers are not "sharing". Must say whether data is encrypted in transit and whether users can request deletion.
- **Privacy policy.** Link in Play Console *and* in the app; on an active, public, non-geofenced URL (not a PDF); must name the developer/app, give a privacy contact, list data collected/shared and with whom, secure handling, and the retention and deletion policy.
- **Prominent disclosure + consent** is needed only for collection users would not reasonably expect (e.g. background location). Neither app does that today. **If GPS tracking is ever added to the delivery app, this becomes mandatory first.**
- **Permissions.** Request only what current features use. SMS/Call Log permissions are restricted to default handlers (block them; use the SMS Retriever API for OTP autofill).
- **Target API.** New apps and updates must target API 36 since 31 Aug 2026 — check the SDK 57 build output (`targetSdkVersion`).

## 3. Apple

Sources (read this session):
- App Review Guidelines (last updated 8 Jun 2026) — https://developer.apple.com/app-store/review/guidelines/ (the old /app-review/guidelines/ URL now returns 404)
- Offering account deletion in your app — https://developer.apple.com/support/offering-account-deletion-in-your-app/
- App privacy details — https://developer.apple.com/app-store/app-privacy-details/
- Privacy manifest files — https://developer.apple.com/documentation/bundleresources/privacy-manifest-files (**did not render; nothing taken from it**)

What applies here:
- **5.1.1(i)** privacy policy link in App Store Connect and inside the app, easily accessible; must describe collection, use, third-party protection, retention/deletion and how to revoke consent or request deletion.
- **5.1.1(v)** apps that support account creation must let users *initiate* deletion inside the app; a website may be used only to finish it, linked directly. Temporary deactivation is not enough; user-generated content (e.g. reviews) must go with the account; no phone call/email requirement for non-regulated apps; reauthentication/confirmation is allowed; tell users how long it takes and confirm completion.
- **5.1.1(v)** don't require personal information unless relevant to the core function — phone (login, delivery contact) and address are core here; email is optional in the code.
- **4.8 Login Services** — not triggered: both apps use only the business's own phone-OTP sign-in.
- **3.1.3(e)** physical goods/services must *not* use in-app purchase — Razorpay/COD is correct. Wallet top-ups do not exist in the code; if added, check 3.1.1 (digital value).
- **2.1** working demo account and live backend for review; explain non-obvious features in Review Notes. See the review-login mechanism in the store checklists.
- **App Privacy** — declare data collected for app functionality too; "linked to the user" covers account data; tracking = combining with third-party data for ads (none here).

## 4. India

### 4.1 Digital Personal Data Protection Act 2023 and DPDP Rules 2025
Sources: PIB note "DPDP Rules, 2025 Notified" (https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf — text extracted locally this session); dpdpa.dcomply.in/rules/ (vendor reference, verified 8 Sep 2026); SCC Online blog 26 Dec 2025 and 15 Oct 2026.

- **Notified** 13 Nov 2025 per dcomply (G.S.R. 846(E)); 14 Nov 2025 per SCC. Confirm the Gazette.
- **Phasing:** Board and definitions immediately; consent managers after 12 months; substantive duties after **18 months** (PIB confirms an "eighteen-month period").
- **Coming duties that shaped this work** (in force from ~May 2027; recommended to meet now):
  - stand-alone, plain-language notice listing data and purposes, with links to withdraw consent, exercise rights and complain (R3) → privacy policy + sign-in screen links;
  - reasonable security safeguards including access control, logging and backups (R6) → security audit;
  - breach intimation to affected people "at the earliest" and to the Board (R7; the 72-hour Board deadline commonly cited is **not confirmed** by the sources read) → internal breach-response plan;
  - erasure when the purpose is served, notice at least 48 hours before erasure for specified classes, logs kept at least one year (R8; the Third Schedule thresholds were **not confirmed**) → retention schedule;
  - publish the contact of a DPO or person who can answer questions (R9) → placeholder until named;
  - respond to access/correction/erasure requests within **90 days** (PIB) → in-app deletion is immediate; other requests by email.
- **Needs a lawyer:** legal basis for employee data (s.7 legitimate uses), whether anonymised order rows remain personal data, children (no age verification exists; terms require 18+), and whether the business could ever be a Significant Data Fiduciary (unlikely at this scale).

### 4.2 Consumer Protection (E-Commerce) Rules 2020 and 2026 amendment
Sources: SCC Online, "Consumer Protection E-Commerce Amendment Rules 2026: explained" (14 Sep 2026); Lexorbis summary (gives G.S.R. 789(E)); PIB press release PRID 2308759 (HTTP 403 — not read); 2020 Rules official PDF (connection refused — not read).

- **In force now (2020 Rules):** display legal name, address, customer care and grievance officer contact; grievance acknowledged in 48 hours and redressed within one month; this business is an **inventory e-commerce entity** (sells its own stock) — Rule 6 duties include clear return/refund/exchange, delivery and payment information. [Secondary / not re-verified]
- **From 1 Jan 2027 (2026 amendment):** grievance officer gives the complainant a copy of the complaint as recorded; National Consumer Helpline convergence; country of origin and importer details for imported goods; prior price = lowest price in the preceding 30 days when showing a reduction; invoice shows the seller's name as prominently as the platform's; dark-pattern compliance with an annual self-audit; GSTIN and MSME numbers displayed. [Secondary]
- Cancellation charges, refund timelines and MRP display under the amendment were **not covered** by the sources read — lawyer to check.

### 4.3 Other Indian law to check (not re-verified this session)
- IT Act s.43A and SPDI Rules 2011 — apply until the DPDP repeal of s.43A commences; privacy policy and grievance officer duties overlap with the above.
- CERT-In Directions 2022 — 6-hour incident reporting; keep ICT system logs for 180 days.
- CGST Act s.36 / Companies Act s.128 — how long invoices and books must be kept (drives the order-retention period; depends on the entity type).
- FSSAI licence display for online food sales; Legal Metrology declarations on product pages.

## 5. Classification used in the docs

- **Mandatory** — required by a rule in force now, or by a store policy for publishing.
- **Mandatory (later)** — required once a rule takes effect (DPDP ~May 2027; E-Commerce amendment 1 Jan 2027). Built now because retrofitting later is harder.
- **Conditional** — required only if a feature exists or is switched on (online payments, WhatsApp, GPS tracking, push notifications).
- **Recommended** — good practice, not identified as legally required on the evidence above.
- **Lawyer** — wording or position that needs an Indian lawyer's interpretation.
