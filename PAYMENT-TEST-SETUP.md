# KEMP EYE 112 — Payment Test Setup

This document is for the **Razorpay Test Mode** integration only.

## GitHub files

- `index.html` = normal staged/locked 112-day experience.
- `audit-112.html` = permanent all-112-days practice/audit experience.
- `payment-agent.html` = Test Mode checkout agent.
- `payment-backend/worker.js` = secure Cloudflare Worker.
- `payment-backend/schema.sql` = D1 tables and ₹333 stage prices.
- `payment-backend/wrangler.toml` = Worker + D1 configuration.

## Worker deployment

Use a **separate Cloudflare Worker project**. Do not deploy the payment Worker as the existing `112-days` Pages/Worker project.

Repository:

`kishanbali/112-days-`

Branch:

`secure-payment-backend`

If Cloudflare offers a Root Directory field, use:

`/payment-backend`

If Cloudflare does not offer Root Directory, use `/` on the `secure-payment-backend` branch. That branch contains root-level `worker.js` and `wrangler.toml` specifically for deployment.

Build command: leave blank.

Deploy command:

`npx wrangler deploy`

Do not add a trailing `|` or any other characters.

Worker name:

`kemp-eye-112-payments`

## D1

Binding name:

`DB`

Database name:

`kemp-eye-112`

Database ID is already declared in the Wrangler configuration on the payment branch.

Apply `payment-backend/schema.sql` to the D1 database before testing `/api/order`.

## Worker secrets

Set these in Cloudflare Worker Secrets. Never put their values in GitHub:

- `RAZORPAY_KEY_ID` — Razorpay Test Mode key ID
- `RAZORPAY_KEY_SECRET` — Razorpay Test Mode key secret
- `RAZORPAY_WEBHOOK_SECRET` — webhook secret
- `ACCESS_TOKEN_PEPPER` — random private token-hashing secret

## Test flow

1. Deploy the separate payment Worker.
2. Bind D1 as `DB`.
3. Apply `schema.sql`.
4. Add the four Test Mode secrets.
5. Configure the Razorpay webhook at `/webhook/razorpay`.
6. Open `payment-agent.html`.
7. Select L1 first.
8. Start the ₹333 Test Mode payment.
9. Confirm server-side verification returns an access token for L1.
10. Only after L1 works should the normal locked `index.html` be connected to the backend.

## Important separation

The 112-day experience was already audited through Day 112. Payment testing must not modify the verified content or the permanent audit page.

No live money should be used during this test phase. Live Razorpay activation comes only after KYC/live activation and successful Test Mode verification.
