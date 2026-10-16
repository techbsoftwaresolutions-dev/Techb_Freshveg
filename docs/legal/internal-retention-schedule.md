# Internal data retention schedule

> **INTERNAL — not for publication. STATUS: DRAFT — periods marked [LAWYER/CA] must be confirmed.** Classification: **mandatory (later)** under DPDP Rule 8 (from ~May 2027); recommended now. Owner: [[DATA_OWNER — name/role]].

"Current" is what the code does on 16 Oct 2026. "Target" is the proposed rule. Account deletion overrides everything marked "until deletion" (accountDeletion.service.js).

| Data | Where | Current | Target | Basis / note |
|---|---|---|---|---|
| Customer profile, addresses, preferences | `User` | until deletion; erased on deletion | same; plus consider erasing accounts inactive for [LAWYER] years with 48 h prior notice | DPDP R8 (erasure when purpose ends) |
| Cart (active/abandoned), wishlist | `Cart`, `Wishlist` | forever (deleted on account deletion) | abandoned carts: delete after 90 days | minimisation |
| In-app notifications | `Notification` | forever | delete after 180 days | minimisation |
| OTP codes | `Otp` | ~1 h after expiry (TTL) | same | security |
| Orders, invoices | `Order` | forever; anonymised on account deletion | keep [FINANCIAL_RECORD_RETENTION] then delete or fully anonymise | CGST Act s.36 / Companies Act s.128 [LAWYER/CA] |
| Payments, refunds, wallet & points ledgers | `Payment`, `Refund`, `WalletTransaction`, `LoyaltyTransaction` | forever; gateway payload cleared on deletion | as orders | accounting, chargebacks |
| Support tickets | `SupportTicket` | forever; name/phone removed on deletion | closed tickets: [LAWYER] years (consumer-complaint limitation period) | Consumer Protection Act limitation [LAWYER] |
| Reviews | `Review` | until deletion (deleted with the account) | same | user content |
| WhatsApp delivery log | `WhatsAppMessage` | forever (masked number) | delete after 90 days | minimisation |
| Delivery tracking pings | `DeliveryTracking` | 7 days (TTL) | same | dispute window |
| Referral records | `Referral`, `Coupon` | forever | as orders (they explain coupon discounts on invoices) | |
| Account-deletion receipts | `AccountDeletion` | forever | [LAWYER] years | proof of erasure |
| Admin audit log (incl. IP, user agent) | `AuditLog` | forever | security logs ≥ 1 year (DPDP R8 logs) and ≥ 180 days (CERT-In) [LAWYER]; then delete | security |
| Delivery-employee account | `User` | until erased by admin | erase within [LAWYER] days of leaving, once cash is settled | employment law [LAWYER] |
| Server/hosting logs | host | unknown — provider not identified | ≥ 180 days in India (CERT-In) [LAWYER] | |
| Backups | MongoDB host | unknown | state backup retention; erased data ages out of backups within the backup cycle; restore procedures must re-apply erasures | |

Implementation notes (not done — follow-ups): TTL indexes on `Notification.createdAt`, `WhatsAppMessage.createdAt`, abandoned `Cart.updatedAt` and `AuditLog.createdAt`; a scheduler job for financial records past their period.
