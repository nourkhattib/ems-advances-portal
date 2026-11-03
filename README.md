# EMS Advances Portal

A separate, locked-down portal where each manager records salary advances (cash given to employees) — part of the [EMS](https://github.com/nourkhattib/ems-workforce-management) system.

## Screenshots

| Desktop | Mobile |
|---|---|
| **Login**<br><img src="docs/screenshots/login-desktop.png" width="560"> | <img src="docs/screenshots/login-mobile.png" width="200"> |

## Highlights
- **Server-side identity** – the client never sends who the payer is; the Edge Function derives it from the signed JWT, and each manager can write only their own amount column.
- **Payroll-month logic** – between the 1st and 10th of a month, advances are attributed to the previous payroll month; the real hand-over date is stored separately.
- PIN login with HMAC-signed JWT (Web Crypto), no access to the general EMS API.

## Files
| File | Purpose |
|------|---------|
| `01_payments_portal_migration.sql` | DB migration (tables, columns) |
| `payments-api.ts` | Supabase Edge Function – the portal API |
| `seed-payment-users.ts` | One-time Edge Function to set PINs |
| `payments-auth.js` | Front-end auth helper |
| `payments-login.html`, `payments-portal.html` | UI |

## Setup
1. Run the SQL migration in the Supabase SQL editor.
2. Deploy `payments-api` and `seed-payment-users` as Edge Functions.
3. Set secrets: `EMS_JWT_SECRET`, `PAYMENTS_SEED_SECRET` (Supabase provides `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).
4. Call `seed-payment-users` once to set PINs.

## Tech
TypeScript (Deno) · Supabase Edge Functions · Postgres · Vanilla JS
