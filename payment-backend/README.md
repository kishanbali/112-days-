# KEMP EYE 112 — secure payment backend

This folder is the backend contract for Razorpay stage purchases. It is designed to run as a Cloudflare Worker with Cloudflare D1.

## Current Test Mode configuration

- Paid stages: L1–L11 and L12-20.
- Price configured in D1 schema: **₹333 per paid stage** (33,300 paise).
- This branch is for **Razorpay Test Mode only** until end-to-end verification is complete.
- The verified 112-day `index.html` and permanent `audit-112.html` are not modified by this backend branch.

## Security model

- Razorpay Key Secret and webhook secret are Worker secrets only; never place them in `index.html`.
- The browser asks the Worker to create an order for an allowlisted stage key.
- The Worker reads the stage price from D1, so the browser cannot choose its own amount.
- Razorpay payment verification is server-side.
- Webhook signatures are verified against the raw request body.
- Razorpay event IDs are stored so duplicate webhook deliveries are idempotent.
- Access tokens are random, single-purpose bearer tokens. Only a SHA-256 hash is stored in D1.
- The normal KEMP EYE index can use the returned entitlement token to unlock the purchased stage. `localStorage` remains only a client-side cache; payment truth lives in D1.
- `audit-112.html` remains independent practice/audit mode and is not used as proof of payment.

## Required Worker secrets

Set these in Cloudflare, not in GitHub source:

- `RAZORPAY_KEY_ID` — **Test Mode** key ID
- `RAZORPAY_KEY_SECRET` — **Test Mode** key secret
- `RAZORPAY_WEBHOOK_SECRET` — webhook signing secret
- `ACCESS_TOKEN_PEPPER` — a strong random private value

Never commit the values of these secrets to GitHub or paste them into `index.html`.

## Required binding

- D1 binding named `DB`
- Database: `kemp-eye-112`
- Database ID: `71da40ba-3200-4781-b4a2-bfd3f9295ba2`

## Stage mapping

- L1 = Days 13–17
- L2 = Days 18–22
- L3 = Days 23–27
- L4 = Days 28–32
- L5 = Days 33–37
- L6 = Days 38–42
- L7 = Days 43–47
- L8 = Days 48–52
- L9 = Days 53–57
- L10 = Days 58–62
- L11 = Days 63–67
- L12-20 = Days 68–112

## Test sequence

1. Create/deploy the separate Cloudflare Worker from the `secure-payment-backend` branch.
2. Apply `schema.sql` to the D1 database.
3. Confirm the D1 stage prices are ₹333.
4. Add the four Test Mode Worker secrets in Cloudflare.
5. Configure the Razorpay webhook to the Worker HTTPS URL.
6. Open the KEMP EYE payment agent and test **L1** first.
7. Complete a Razorpay Test Mode checkout.
8. Confirm the Worker verifies the payment and returns an access token.
9. Test `GET /api/access` with that token.
10. Only after successful testing should the normal `index.html` be connected to the payment endpoint.
11. Move to Razorpay Live Mode only after KYC/live activation and complete end-to-end testing.

## API contract

`POST /api/order` body:

```json
{"stage_key":"L2"}
```

Response:

```json
{"ok":true,"order_id":"order_...","stage_key":"L2","amount":33300,"currency":"INR","key_id":"rzp_test_...","checkout_token":"..."}
```

`POST /api/verify` body:

```json
{"checkout_token":"...","razorpay_payment_id":"pay_...","razorpay_order_id":"order_...","razorpay_signature":"..."}
```

Response after successful server-side verification:

```json
{"ok":true,"stage_key":"L2","access_token":"..."}
```

`GET /api/access?token=...` response:

```json
{"ok":true,"stage_key":"L2"}
```

Webhook:

`POST /webhook/razorpay`

The Worker verifies the webhook signature before changing order state and records the Razorpay event ID before returning success.
