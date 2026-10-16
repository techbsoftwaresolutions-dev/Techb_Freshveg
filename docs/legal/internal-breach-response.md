# Internal personal-data breach response plan

> **INTERNAL — not for publication. STATUS: DRAFT.** Classification: **mandatory (later)** — DPDP Rule 7 (from ~May 2027); CERT-In reporting duties apply now [not re-verified — LAWYER]. Fill in the [[…]] names before launch.

## Roles
- Incident lead: [[INCIDENT_LEAD — name, phone]]
- Technical lead (API, database, hosting): [[TECH_LEAD]]
- Legal/compliance contact and person notifying authorities: [[GRIEVANCE_OFFICER_NAME]] / [[LAWYER]]
- Communications to customers/staff: [[COMMS_OWNER]]

## Timeline (start = the moment anyone suspects a breach)

| When | Action |
|---|---|
| Immediately | Tell the incident lead. Do not delete evidence. Write down what was seen, when, by whom. |
| Within 1 hour | Contain: rotate exposed secrets (`JWT_SECRET`/`JWT_REFRESH_SECRET` sign everyone out; MongoDB user; Cloudinary; Razorpay; WhatsApp token), deactivate compromised staff accounts (Admin → Users — takes effect immediately), block abusive IPs at the proxy. |
| Within 6 hours | Report to CERT-In if it is a reportable cyber incident (CERT-In Directions 2022 — [LAWYER] to confirm categories and form). |
| As soon as possible | Assess: which data (see data-inventory.md), how many people, customers or staff, still ongoing? Preserve logs (`AuditLog`, host logs). |
| "Without delay" / at the earliest | Tell affected people in plain language: what happened, when, what data, likely consequences, what we did, what they should do, and who to contact (DPDP R7). Channels: in-app notification, SMS/WhatsApp, email where held. |
| Within the Board's deadline | Notify the Data Protection Board with the details and later a full report (DPDP R7 — the commonly cited 72-hour follow-up deadline was **not confirmed** in sources read on 16 Oct 2026; [LAWYER]). |
| After | Root-cause review, fix, update security-audit.md, record the incident and decisions. |

## Known high-impact scenarios for this system
1. **Leaked secrets** (see security-audit.md B1 — already in git history): anyone with `JWT_SECRET` can mint admin tokens; anyone with `MONGODB_URI` reads every customer's phone, addresses and orders. Response: rotate all, review DB access logs at the host, review `AuditLog` for unknown actors.
2. **OTP shown on screen in production** (B2): accounts can be taken over by number. Response: unset `OTP_ON_SCREEN`, invalidate sessions (rotate JWT secrets), review recent logins.
3. **Lost rider phone**: deactivate the rider in Admin → Delivery Boys (sessions end at once); they could only see orders currently on their run.
4. **Admin account compromise**: deactivate, rotate its password, review `AuditLog` for its actions.

## Record (keep for [LAWYER] years)
Date/time detected, reporter, description, data and people affected, containment steps and times, notifications sent (to whom, when, copy), authority reference numbers, root cause, fixes.
