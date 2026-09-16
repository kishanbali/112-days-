# KEMP EYE 112 — secure payment backend

This folder is the secure backend contract for Razorpay stage purchases. It is designed to run as a Cloudflare Worker with Cloudflare D1.

## Current test configuration

- Paid stages: L1–L11 and L12-20
- Price: ₹333 per paid stage (33,300 paise)
- Currency: INR
- Testing target: Razorpay Test Mode only
- The verified 112-day experience and `audit-112.html` are kept separate from payment verification.

## Security model

- Razorpay Key Secret and webhook secret are Worker secrets only; never place them in `index.html`.
- The browser asks the Worker to create an order for an allowlisted stage key.
- The Worker reads the stage price from D1, so the browser cannot choose its own amount.
- Razorpay payment verification is server-side.
- Webhook signatures are verified against the raw request body.
- Razorpay event IDs are stored so duplicate webhook deliveries are idempotent.
- Access tokens are random bearer tokens. Only a SHA-256 hash is stored in D1.
- The normal KEMP EYE index can use the returned entitlement token to unlock the purchased stage. `localStorage` remains only a client-side cache; payment truth lives in D1.
- `audit-112.html` remains independent practice/audit mode and is not used as proof of payment.

## Required Worker secrets

Set these in Cloudflare, not in GitHub source:

- `RAZORPAY_KEY_ID` — Razorpay Test Mode key ID
- `RAZORPAY_KEY_SECRET` — Razorpay Test Mode key secret
- `RAZORPAY_WEBHOOK_SECRET` — webhook signing secret you create
- `ACCESS_TOKEN_PEPPER` — a separate random secret used to hash access tokens

Never commit the values of these secrets to GitHub or paste them into the HTML.

## Required D1 binding

- Binding name: `DB`
- Database: `kemp-eye-112`

The stage-price seed data is in `schema.sql`. It configures ₹333 for every paid stage.

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

1. Deploy the Worker from the payment-backend code.
2. Bind the D1 database as `DB`.
3. Apply `schema.sql` to the D1 database.
4. Add the four Worker secrets in Cloudflare.
5. Configure the Razorpay webhook to the Worker HTTPS endpoint.
6. Use `payment-agent.html` from GitHub Pages to select a stage and start a ₹333 Test Mode checkout.
7. Confirm the Worker verifies the Razorpay payment and returns a stage access token.
8. Only after the complete Test Mode flow works should the normal locked `index.html` be connected.

## API contract

`POST /api/order` body:

```json
{"stage_key":"L2"}
```

Response:

```json
{"order_id":"order_...","stage_key":"L2","amount":33300,"currency":"INR","checkout_token":"..."}
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
