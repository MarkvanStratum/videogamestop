# Top Video Games — accounts and free trial

This version adds PostgreSQL-backed registration/login, secure HttpOnly session cookies, and a one-free-game-per-browser trial. The same free game can be replayed. After that, a non-collecting upgrade screen appears. No checkout or lifetime-access purchasing is enabled.

## Deploy
1. Commit all files to your GitHub repository root, including `auth.js` and `Dockerfile`.
2. In Northflank, set `DATABASE_URL` to the normal PostgreSQL addon's internal `POSTGRES_URI` (do not use the admin URI). Never commit credentials.
3. Deploy using Dockerfile, HTTP port 3000.
4. Database tables are created automatically on startup.
5. Test registration, logout/login, one free game, and the second-game upgrade screen.

## Important limitations
- A guest's free-game allowance is tied to an HttpOnly browser cookie; clearing cookies or changing devices can reset it. This is a product preview, not fraud-proof trial enforcement.
- A user can visit publicly accessible GameArter URLs outside your website; this cannot restrict GameArter itself.
- No password reset, email verification, payment gateway, or checkout is included. Do not market paid access until those are implemented and licensing permission is obtained.
- To grant access later, integrate a **verified payment webhook** that sets `tvg_users.lifetime_access=true` for the correct customer. Never accept a browser-only success signal as proof of payment.
- For production security, configure monitored backups, rate limits at the edge, and a password reset flow before promoting accounts widely.

Pricing navigation fix: #pricing, #games and #categories now scroll after restoring the home view. Cache-busted scripts included.
