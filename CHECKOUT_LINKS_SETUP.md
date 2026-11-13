# Unique checkout links

The existing homepage pricing buttons now call POST /api/create-promo-checkout-link and redirect to a new 30-minute /c/<token> URL. The /c/<token> route renders the existing Stripe checkout; /api/checkout-link/<token> supplies the server-validated plan. Existing Stripe payment intent and webhook routes are unchanged.

For a separate affiliate landing page (not included in the uploaded archive), call POST /api/create-promo-checkout-link with JSON: {"plan":"starter", "step2File":"checkout.html", "sourcePage":"/affiliate-page.html", "originalQueryString":"?ref=partner123", "ref":"partner123"}; redirect to the returned url. Valid plans are starter, premium, ultimate, or their legacy aliases. Legacy Xolvis step-two templates are not included or supported in this Stripe package. Affiliate attribution is stored with the link but is NOT automatically propagated into Stripe payment records or postbacks.

Requires the existing DATABASE_URL, Stripe keys, and webhook configuration. Deploy and verify a unique /c/ URL is created for each click; test payment, webhook delivery and unlocked access. Existing direct /checkout.html?plan= URLs still work for compatibility. Do not treat this as a replacement for affiliate tracking integration.
