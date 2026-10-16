# Checklist for review by an Indian lawyer

Documents to review: `website/content/legal/*.md` (the public texts; lines starting ">" are drafting notes), `docs/legal/internal-retention-schedule.md`, `docs/legal/internal-breach-response.md`, and the store-form drafts in `docs/legal/store-checklist-*.md`. Facts about the system are in `docs/legal/data-inventory.md`; sources and what is in force when are in `docs/legal/requirements-research.md` (several items there are from secondary sources only).

## A. Status of the law (please confirm)
1. DPDP Rules 2025: Gazette date (13 vs 14 Nov 2025), G.S.R. number, and the exact commencement date of the 18-month provisions; whether MeitY has notified any shortening of the phase-in.
2. Until then: the business's obligations under IT Act s.43A / SPDI Rules 2011 (privacy policy contents, grievance officer, sensitive data — staff passwords are hashed; no card data held).
3. Consumer Protection (E-Commerce) Rules 2020 as amended (2026 amendment notified 9 Sep 2026, effective 1 Jan 2027): which duties apply to a single-seller inventory model selling groceries in one city; what must be displayed on the website and inside the app.
4. CERT-In Directions 2022: reporting window and log-retention duties for this business and its hosting.

## B. Positions taken in the drafts that need a decision
5. **Refunds to a non-withdrawable wallet by default** for online payments (Admin setting "auto refund to wallet", default ON). Acceptable, or must refunds go to the source unless the customer chooses otherwise?
6. **Wallet balance forfeited on account deletion** (the customer is shown the amount and must confirm). Acceptable, or must it be paid out first?
7. **Non-returnable perishables** with quality complaints via support only; the complaint window (old site: 24 hours).
8. **No cancellation after the rider has collected the order.** Is that compatible with consumer law for COD orders (the customer can still refuse at the door)?
9. Undeliverable orders: the system refunds anything paid when the store cancels. The old site said such perishables "may not be refundable". Which position?
10. Points and cashback earned at delivery are not reversed when the order is returned and refunded.
11. Limitation-of-liability and force-majeure wording in the terms; governing law and jurisdiction city.
12. Minimum age 18 stated in the terms and privacy policy, without age verification — sufficient under DPDP s.9 and the 2026 Removal of Difficulties Order?

## C. Privacy policy (customer)
13. Legal basis wording (consent on sign-up and orders; "legitimate uses" for legal obligations).
14. Is the privacy policy enough as the DPDP R3 notice, or is a separate short notice needed at sign-up (and consent recorded)? The app shows Terms/Privacy links at sign-in; consent is not separately recorded.
15. Sharing: Razorpay (prefill of name/phone/email), Meta WhatsApp, SMS provider, Cloudinary, hosting — processor terms in place? Any cross-border transfer issues?
16. Rights section: "summary of personal data" and nomination via email; response "within the time the law allows" (90 days per PIB summary of the Rules).
17. Retention statements: anonymised order records kept for [FINANCIAL_RECORD_RETENTION]; closed support tickets kept without name/phone — periods?

## D. Account deletion page
18. Are anonymised orders (city, state, pincode, items, amounts, customer id) still personal data? Is keeping them as described lawful and adequately disclosed?
19. Email/phone deletion requests for people who lost their number: identity-verification standard.
20. Delivery employees: employer completes deletion; records kept under employment law — wording and periods.

## E. Delivery staff documents
21. Delivery staff privacy notice: legal basis for employee data (DPDP s.7 employment purposes), relation to the employment contract and HR policies.
22. Usage terms: confirm nothing suggests an independent-contractor/gig relationship; cash-handling and data-confidentiality obligations; consequences of breach belong in the employment contract.
23. If live GPS tracking is introduced later: employee monitoring rules and consent/notice.

## F. Referral & coupon terms
24. Any rules on promotional schemes/prize competitions that apply to milestone rewards; "we may change or end the programme" wording; voiding for misuse; consumer-protection fairness of reversal on refunds.

## G. Store submissions
25. Developer name on both stores = legal entity in the policies.
26. Review of the Data safety and App Privacy drafts, in particular the "Payment info" decision (Razorpay SDK).

## H. Internal documents
27. Retention schedule periods marked [LAWYER/CA].
28. Breach plan: who notifies the Board and affected people; deadlines; record keeping.
