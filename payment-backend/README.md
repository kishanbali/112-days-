# KEMP EYE 112 — secure payment backend

This folder is the backend contract for Razorpay stage purchases. It is designed to run as a Cloudflare Worker with Cloudflare D1.

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

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `ACCESS_TOKEN_PEPPER`

## Required bindings

- D1 binding named `DB`

## Production sequence

1. Create the Worker and D1 database.
2. Apply `schema.sql`.
3. Replace the 1-paise seed prices with the final approved INR prices.
4. Deploy the Worker.
5. Configure the Razorpay webhook to the Worker HTTPS URL and subscribe to `payment.captured` and `order.paid` as required.
6. Test in Razorpay Test Mode.
7. Connect `index.html` to the Worker checkout endpoint only after backend verification works.
8. Move to Razorpay Live Mode only after KYC/live activation and end-to-end testing.

## API contract

`POST /api/order` body:

```json
{"stage_key":"L2"}
```

Response:

```json
{"order_id":"order_...","stage_key":"L2","amount":1234,"currency":"INR","checkout_token":"..."}
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
