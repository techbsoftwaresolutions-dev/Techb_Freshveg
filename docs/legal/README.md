# Legal, privacy and app-store readiness

> **Every document here and in `website/content/legal/` is a DRAFT — NOT READY FOR PUBLICATION** until the inputs in [missing-business-inputs.md](missing-business-inputs.md) are supplied and an Indian lawyer has reviewed them ([lawyer-review-checklist.md](lawyer-review-checklist.md)). Nothing here claims that the apps are legally compliant or that they will be approved by Google or Apple.

Start with **[readiness-report.md](readiness-report.md)**.

## Public policies (one text each, rendered by the website)

The deploy script ships only `website/`, so the policy drafts live there: `website/content/legal/<name>.md`, rendered by `website/lib/legal.js` at the routes below. Lines starting with `>` are drafting/review notes and never reach the site; a sentence containing a `[[PLACEHOLDER]]` without a value in `LEGAL_VALUES` is left off the page, so no placeholder is ever published. The apps link to these pages (customer app: Account → Legal & about; delivery app: Profile → Legal & account).

| Document | Draft | Route | Class |
|---|---|---|---|
| Customer privacy policy | website/content/legal/privacy-policy.md | /privacy-policy | Mandatory |
| Customer terms & conditions | terms-and-conditions.md | /terms-and-conditions (old /terms redirects) | Mandatory |
| Cancellation, return & refund policy | refund-cancellation-policy.md | /refund-cancellation-policy | Mandatory |
| Shipping & delivery policy | shipping-delivery-policy.md | /shipping-delivery-policy | Mandatory |
| Referral & coupon terms | referral-terms.md | /referral-terms | Conditional (while Refer & Earn runs) |
| Account deletion & data retention | account-deletion.md | /account-deletion (+ live deletion panel) | Mandatory (store policies) |
| Cookies & local storage | cookies-storage.md | /cookies-storage | Recommended |
| Delivery staff privacy notice | delivery-app-privacy.md | /delivery-app-privacy | Mandatory if the delivery app is listed; recommended otherwise |
| Delivery app usage terms | delivery-app-terms.md | /delivery-app-terms | Recommended |

## Internal and supporting documents (this folder)

| Document | Purpose | Class |
|---|---|---|
| [requirements-research.md](requirements-research.md) | Sources; in force now vs later; platform vs law | — |
| [data-inventory.md](data-inventory.md) | What data, where, why, third parties, retention — evidence for everything else | — |
| [compliance-gap-analysis.md](compliance-gap-analysis.md) | Both apps, before/after, what remains | — |
| [permissions-audit.md](permissions-audit.md) | Every Android/iOS permission and why | — |
| [security-audit.md](security-audit.md) | Findings by severity; what was fixed; launch blockers | — |
| [store-checklist-customer-app.md](store-checklist-customer-app.md) | Play + Apple checklists, Data safety and App Privacy drafts, review notes | — |
| [store-checklist-delivery-app.md](store-checklist-delivery-app.md) | Same for the delivery app, incl. private-distribution decision | — |
| [internal-retention-schedule.md](internal-retention-schedule.md) | Retention periods and owners (internal) | Mandatory later (DPDP R8) |
| [internal-breach-response.md](internal-breach-response.md) | Breach response plan (internal) | Mandatory later (DPDP R7); CERT-In now |
| [open-source-notices.md](open-source-notices.md) | Licences of the apps' direct dependencies | Recommended |
| [missing-business-inputs.md](missing-business-inputs.md) | Everything the business must supply | — |
| [lawyer-review-checklist.md](lawyer-review-checklist.md) | Questions for an Indian lawyer | — |

## Keeping documents tied to the code

When any of these change, update the matching policy text in the same change:
- order state machine `backend/src/modules/orders/orderStatus.js`, cancellation `order.routes.js`, returns `return.routes.js`, refunds `payments/payment.service.js` → refund policy;
- `backend/src/modules/auth/accountDeletion.service.js` → account-deletion page and privacy policy retention section;
- `backend/src/modules/referrals/*` and `settings.referral` → referral terms (never put amounts in the text);
- any new SDK, permission, analytics or push service → privacy policy, data inventory, store forms.
