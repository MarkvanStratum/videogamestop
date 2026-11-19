const express = require('express');
const path = require('path');
const app = express();
const auth = require('./auth');
const payments = require('./stripe-payments');
const checkoutLinks = require('./checkout-links');
const adminCrm = require('./admin-crm');
app.set('trust proxy', 1);
payments.attachWebhook(app); // Raw body must precede JSON middleware
auth.attach(app);
payments.attachApi(app,auth);
checkoutLinks.attach(app);
adminCrm.attach(app);
const PORT = process.env.PORT || 3000;
const BASE = 'https://www.gamearter.com/api/v1/catalog';
const TTL = 10 * 60 * 1000;
let cache = { at: 0, games: [], total: 0 };
const detailCache = new Map();
async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) { const err = new Error(`Game catalog returned ${response.status}`); err.status = response.status; throw err; }
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function getCatalog() {
  if (cache.games.length && Date.now() - cache.at < TTL) return cache;
  const games = []; let offset = 0; let total = 0;
  for (let page = 0; page < 100; page++) {
    const data = await getJson(`${BASE}/games?limit=200&offset=${offset}`);
    if (!Array.isArray(data.games)) throw new Error('Unexpected catalog response');
    games.push(...data.games); total = data.total || games.length;
    if (data.next_offset == null || !data.games.length || data.next_offset <= offset) break;
    offset = data.next_offset;
  }
  cache = { at: Date.now(), games, total };
  return cache;
}
// Deterministic tier assignment: first 500 sorted slugs Starter, next 500 Premium, remainder Ultimate.
// Existing slugs retain their tier as long as catalog membership remains stable.
async function tierForGame(slug) {
  const {games} = await getCatalog();
  const ordered = [...new Set(games.map(g=>g.slug))].sort();
  const index = ordered.indexOf(slug);
  if(index < 0) throw new Error('Game not found in catalog');
  return index < 500 ? 'starter' : index < 1000 ? 'premium' : 'ultimate';
}
auth.configureTiers(tierForGame);
app.get('/api/plans', (_req,res)=>res.json({currency:'GBP',checkout_enabled:true,plans:[{id:'starter',name:'Starter',price_pence:2295,games:500},{id:'premium',name:'Premium',price_pence:2695,games:1000},{id:'ultimate',name:'Ultimate',price_pence:3795,games:'all'}]}));
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get('/api/games', async (req, res) => {
  try { const data = await getCatalog(); res.set('Cache-Control', 'public, max-age=120'); res.json(data); }
  catch (err) { if (cache.games.length) return res.json({ ...cache, stale: true }); res.status(502).json({ error: 'Game catalog is temporarily unavailable. Please retry shortly.' }); }
});
app.get('/api/games/:slug', async (req, res) => {
  const slug = req.params.slug;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return res.status(400).json({ error: 'Invalid game identifier' });
  const existing = detailCache.get(slug);
  if (existing && Date.now() - existing.at < TTL) return res.json({...existing.data,required_tier:await tierForGame(slug)});
  try {
    const data = await getJson(`${BASE}/games/${encodeURIComponent(slug)}`);
    detailCache.set(slug, { at: Date.now(), data });
    if (detailCache.size > 1000) detailCache.delete(detailCache.keys().next().value);
    res.json({...data,required_tier:await tierForGame(slug)});
  } catch (err) { res.status(err.status === 404 ? 404 : 502).json({ error: err.status === 404 ? 'Game no longer available' : 'Could not load game details' }); }
});
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
Promise.all([auth.init(),payments.init(),checkoutLinks.init(),adminCrm.init()]).then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Top Video Games listening on ${PORT}`))).catch(err => { console.error('Database initialization failed:', err.message); process.exit(1); });
