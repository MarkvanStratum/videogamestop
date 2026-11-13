# Lifetime tiers (checkout disabled)

- Starter: £22.95, 500 games
- Premium: £26.95, 1,000 games (includes Starter)
- Ultimate: £37.95, all games

Game assignment is deterministic by alphabetical game slug, using the current catalog. As games are added/removed, some assignments may shift. For production, persist immutable assignments in PostgreSQL.

`access_tier` is stored in `tvg_users` and defaults to `free`. There is deliberately no public endpoint for granting paid access and no checkout; payment gateway/webhook integration and licensing authorization are required before sales. Do not manually change tiers without verifying payment. Existing legacy `lifetime_access=true` users retain Ultimate-equivalent access.

The free trial still allows one game per browser cookie; clearing cookies can reset it. Games themselves have publicly accessible GameArter URLs, so this paywall only controls access through your website.
