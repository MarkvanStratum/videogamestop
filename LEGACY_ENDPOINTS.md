# Legacy endpoint compatibility and limitations

Prices are GBP 22.95 (`2295`), 26.95 (`2695`), 37.95 (`3795` or `lifetime`).

`POST /api/stripe/create-payment-intent` accepts both new tier names (`starter`, `premium`, `ultimate`) and the numeric legacy plan IDs. Requires a logged-in Top Video Games session cookie. Response: `clientSecret`, `reference`. Confirm with Stripe.js.

The source Legend Speak server uses Xolvis transaction tokens, a different user/JWT system, protected `/c/:token` links, and promo-checkout database records. Its endpoint names are NOT sufficient for unchanged old landing pages to work with Stripe. For safety, legacy Xolvis endpoints `/api/create-landing-payment`, `/api/create-au-payment-2695`, `/api/create-payment-2295`, `/api/create-promo-payment` return HTTP 426 with a clear migration error instead of falsely indicating successful payment. `/api/xolvis-public-key` returns HTTP 410.

Before uploading old landing pages, their Xolvis JavaScript and authentication/checkout-link flow must be migrated to Stripe Elements. Do not deploy those pages expecting payments to work unchanged.

Stripe webhooks must be configured at `/api/stripe/webhook`. Run end-to-end Stripe test-mode payments and verify fulfillment before enabling live payments.
