# Top Video Games

A complete responsive HTML5 arcade website for **TopVideoGames.games**, powered by the public GameArter Game Catalog API.

## Quick start

Requires Node.js 18+.

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Deploy to Northflank

1. Push this folder to a GitHub repository.
2. Create a Northflank service from the repository.
3. Choose the Node.js buildpack or use `npm install` as the build command and `npm start` as the start command.
4. Expose the HTTP port specified by Northflank's `PORT` environment variable (default local port: 3000).
5. Add `TopVideoGames.games` and `www.TopVideoGames.games` as custom domains, and configure DNS using Northflank's displayed records.

## How the catalog works

- `/api/games` fetches all catalog pages, up to 200 games per request, using `next_offset`.
- `/api/games/:slug` fetches individual game details including the iframe URL.
- Both endpoints cache data in memory for 10 minutes.
- No API key or GameArter account is required.
- Game assets remain hosted by GameArter.
- Game cards, search, genres, mobile layout, random game and fullscreen mode are included.

## Before public launch

**GameArter's API access is public, but paid access rights have not been confirmed.** Get written permission before placing these games behind a one-time payment or subscription. Do not assume that an open API grants paid resale rights.

**Game ads:** GameArter states that the website domain must contain the required `ads.txt` records from its embed guide at https://www.gamearter.com/games. Create `public/ads.txt` with their *current exact records* before launch; don't guess these records.

**Other launch work:** Add your privacy policy, cookie/consent handling as required for ads and analytics, terms, contact information and payment integration if authorized. No payment system, accounts, or paywall are included in this version.

## Architecture

- Express backend: `server.js`
- Static frontend: `public/index.html`, `public/style.css`, `public/app.js`
- No database required for the initial version.
