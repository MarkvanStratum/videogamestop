# Checkout activation changes

- Replaced disabled Coming Soon pricing buttons with links to `/checkout.html?plan=starter|premium|ultimate`.
- Set `/api/plans` checkout_enabled to true.
- Initialize the Stripe payment database table at server startup (`payments.init()`), after the account schema initialization.
- Added account registration/login directly on checkout before a payment intent is created.
- Kept Stripe Elements so card data goes to Stripe, not the application server.
- Updated package amounts in terms to GBP 22.95 / 26.95 / 37.95.

## Before accepting real payments
Verify permission to charge for access to the third-party games, confirm Stripe account/keys and webhook, check database connection, test all three tiers, refunds, failed payments, 3DS, and access unlock. Live payments have not been tested.
