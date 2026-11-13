# Stripe Elements setup — Top Video Games

This version uses a custom checkout page at `/checkout.html`, Stripe.js Card Element, and Payment Intents. Card details go directly to Stripe, not to this Node server.

## Northflank service environment variables
- `DATABASE_URL` — private PostgreSQL connection string
- `STRIPE_SECRET_KEY` — live or test secret key
- `STRIPE_PUBLISHABLE_KEY` — matching live or test publishable key
- `STRIPE_WEBHOOK_SECRET` — signing secret for the webhook destination
- `NODE_ENV=production` — enables secure session cookies behind HTTPS
- `PUBLIC_BASE_URL=https://videogamestop.video` — optional in this version

`JWT_SECRET` is not used by this application: sessions use cryptographically random tokens stored hashed in PostgreSQL.

## Stripe Workbench webhook
- URL: `https://videogamestop.video/api/stripe/webhook`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
- Choose events from Your account.
- Copy the signing secret for the *same* test/live mode as your API keys.

## Deploy and test
1. Upload this complete ZIP's contents to the GitHub repository root, including `stripe-payments.js` and all `public/` files.
2. Deploy the Northflank service; ensure PostgreSQL is connected and logs show startup.
3. Create a user, log in, and select a tier. The checkout displays Stripe's hosted card input embedded in your own page.
4. First use matching test keys and Stripe's test card `4242 4242 4242 4242` with a future expiry and any CVC.
5. Verify Stripe webhook delivery (HTTP 200), purchase status, and game access. Switch to matching live keys and webhook secret only after tests pass.

Prices are server-side: Starter £22.95, Premium £26.95, Ultimate £37.95, all one-time payments.

Do not publish Stripe secret keys in HTML, GitHub, or chat. Ensure you have permission to sell access to the embedded games.
