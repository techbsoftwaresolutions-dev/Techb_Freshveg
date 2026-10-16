# Compliance gap analysis — customer app and delivery app

As of 16 Oct 2026, against [requirements-research.md](requirements-research.md), using the evidence in [data-inventory.md](data-inventory.md). "Before" = the code at the start of this work; "Now" = after it. **Closing a gap here means the technical or drafting work exists — not that the app is legally compliant or will be approved.**

Class: M = mandatory now · ML = mandatory later (DPDP ~May 2027, E-Commerce amendment 1 Jan 2027) · C = conditional · R = recommended · L = needs a lawyer.

## Customer app (and website)

| # | Requirement | Class | Before | Now | Remaining |
|---|---|---|---|---|---|
| C1 | Public privacy policy URL (Play, Apple, SPDI) | M | none | /privacy-policy page (draft) | business inputs; legal review; deploy |
| C2 | Privacy policy inside the app | M | none | Account → Legal & about; sign-in screen links | — |
| C3 | In-app account deletion (Play, Apple 5.1.1(v)) | M | none | immediate erasure with blockers, warnings, typed confirmation, reference, sessions revoked | — |
| C4 | Web deletion link working without the app (Play) | M | none | /account-deletion with sign-in + deletion panel | deploy |
| C5 | Deactivation ≠ deletion; disclosure of retained data | M | n/a | erasure anonymises; retained records listed on the page | lawyer to confirm retention periods |
| C6 | Delete user content with the account (Apple) | M | n/a | reviews deleted, ratings recomputed | — |
| C7 | Data safety / App Privacy answers consistent with the policy | M | none | drafts in store-checklist-customer-app.md | business to enter; decide Payment Info |
| C8 | Minimum permissions (Play, Apple 5.1.1(iii)) | M | 3 unused template permissions | removed | verify merged manifest on first build |
| C9 | Target API 36 | M | unknown | — | check EAS build |
| C10 | Working sign-in for reviewers (Apple 2.1) | M | only via unsafe OTP_ON_SCREEN | REVIEW_LOGINS mechanism | configure before submission |
| C11 | Working SMS OTP in production | M | **missing** | **missing** | **blocker** — integrate provider (security-audit B2) |
| C12 | Secrets out of git | M | **committed** | **still committed** | **blocker** — rotate (security-audit B1) |
| C13 | E-Commerce Rules r.4: legal name, address, grievance officer on the platform | M | phones/email only | placeholders that appear once filled | **business inputs** (grievance officer etc.) |
| C14 | Cancellation/return/refund policy matching the system (r.4/r.6) | M | old /terms contradicted the code | /refund-cancellation-policy matches state machine; API now refuses cancel after pickup | lawyer: wallet-default refunds, perishables, timelines |
| C15 | Shipping/delivery policy (r.6) | M | none | /shipping-delivery-policy | — |
| C16 | No cancellation charge unless... (r.4) | M | none charged | stated | — |
| C17 | Referral terms without hardcoded values | R/L | none | /referral-terms points to live rules (verified on /account/refer and app screen) | lawyer: promotional-scheme rules |
| C18 | DPDP notice (R3): itemised data, purposes, rights, withdrawal, complaint to Board | ML | none | privacy policy covers; sign-in links | lawyer to check wording; consider a separate short notice at sign-up |
| C19 | DPDP R9 contact person published | ML | none | placeholder | business input |
| C20 | DPDP rights handling within 90 days; grievance redress | ML | none | deletion self-service; other requests by email/support | define internal SOP and owner |
| C21 | DPDP R7 breach intimation readiness | ML | none | internal-breach-response.md | fill roles; lawyer to confirm deadlines |
| C22 | DPDP R8 retention and erasure; logs ≥ 1 year | ML | no expiry anywhere | internal-retention-schedule.md | implement TTLs; confirm periods |
| C23 | Children: verifiable parental consent or no children's data | ML/L | no age statement | terms and policy: 18+ | lawyer: is a statement enough? |
| C24 | Cookies/storage disclosure | R | none | /cookies-storage | — |
| C25 | 2026 amendment (from 1 Jan 2027): grievance copy, NCH convergence, prior price, country of origin, GSTIN/MSME display, dark-pattern self-audit | ML | none | NCH named in terms | product-page and process work not in this task |
| C26 | Customer PII minimisation for delivery staff | R (DPDP security) | full PII forever | only during the run | — |
| C27 | Token storage hardening | R | AsyncStorage + device backup | backup disabled | secure-store, token rotation (security-audit R1/R2) |
| C28 | Open-source licence notices | R | none | open-source-notices.md (direct deps) | in-app/web page; full scan |

## Delivery app

| # | Requirement | Class | Before | Now | Remaining |
|---|---|---|---|---|---|
| D1 | Distribution model (public vs private) | — | undecided | analysed in store-checklist-delivery-app.md | **business decision** (private recommended) |
| D2 | Privacy notice for employees, public URL + in-app | M (if listed) | none | /delivery-app-privacy; Profile → Legal & account | review with HR/lawyer |
| D3 | Usage terms that do not imply gig/contractor status | R/L | none | /delivery-app-terms | lawyer + employment contract |
| D4 | Account deletion path keeping admin control | M (if listed) | deactivation only | request in app → admin erases (blocked while on a run or holding cash) or declines with a reason | Apple may want completion without support steps — be ready to complete quickly |
| D5 | Deactivation ≠ deletion | M | deactivation called "inactive" | erasure is separate, irreversible, audited | — |
| D6 | Riders see only assigned orders, minimum customer PII | R (security) | assigned-only, but full PII + history | trimmed (see C26) | — |
| D7 | No location / permissions | M | 3 unused permissions | INTERNET, VIBRATE only | if GPS is added: prominent disclosure first |
| D8 | Data safety / App Privacy | M (if listed) | none | drafts | business |
| D9 | Demo account with an assigned run | M (Apple 2.1) | n/a | instructions | prepare before submission |
| D10 | Employee data legal basis and retention | L | — | notice describes; retention schedule placeholders | lawyer/HR |

## Both apps — business and brand

| # | Gap | Class |
|---|---|---|
| X1 | Brand names inconsistent: "The Farmers Basket" (apps, site) vs "Samagra Mart" (backend settings default, bundle IDs) vs "Fresh Market" (repo/admin). Store developer name, policies and invoices must name the same legal entity. | M |
| X2 | Old /terms said Bengaluru; seed data describes a Hosur (Tamil Nadu) store and the tax home state defaults to 33 (Tamil Nadu). Confirm the operating state for GST and jurisdiction. | M/L |
| X3 | Refunds default to a non-withdrawable wallet (`autoRefundToWallet` default ON). | L |
| X4 | Wallet balance forfeited on deletion (user confirms). | L |
| X5 | Loyalty points and cashback credited at delivery are not reversed when a return is refunded. | business decision |
| X6 | An erased number can be referred again (fraud). | R |
