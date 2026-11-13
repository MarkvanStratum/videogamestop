
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5
});

const PUBLIC_DIR = path.join(__dirname, 'public');

const plans = new Set(['starter', 'premium', 'ultimate']);

const aliases = {
  '2295': 'starter',
  '2695': 'premium',
  '3795': 'ultimate',
  lifetime: 'ultimate',
  god: 'starter',
  all: 'premium'
};

const normalize = p => aliases[p] || p;

function getTemplate(filename) {
  if (
    typeof filename !== 'string' ||
    !/^[a-zA-Z0-9_-]+\.html$/.test(filename)
  ) {
    return null;
  }

  const fullPath = path.join(PUBLIC_DIR, filename);

  try {
    if (!fs.statSync(fullPath).isFile()) return null;
    return fullPath;
  } catch {
    return null;
  }
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tvg_checkout_links (
      token TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      source_page TEXT,
      original_query_string TEXT,
      affiliate_ref TEXT,
      step2_file TEXT NOT NULL DEFAULT 'checkout.html',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE tvg_checkout_links
    ADD COLUMN IF NOT EXISTS step2_file TEXT
    NOT NULL DEFAULT 'checkout.html'
  `);
}

function attach(app) {

  app.post('/api/create-promo-checkout-link', async (req, res) => {
    try {
      const plan = normalize(
        String(req.body?.plan || '').trim()
      );

      if (!plans.has(plan)) {
        return res.status(400).json({
          error: 'Invalid plan'
        });
      }

      const step2File = String(
        req.body?.step2File || 'checkout.html'
      );

      if (!getTemplate(step2File)) {
        return res.status(400).json({
          error: 'Checkout template not found'
        });
      }

      const token = crypto.randomBytes(18)
        .toString('base64url');

      const sourcePage = String(
        req.body?.sourcePage || ''
      ).slice(0, 1000);

      const originalQueryString = String(
        req.body?.originalQueryString || ''
      ).slice(0, 3000);

      const affiliateRef = String(
        req.body?.ref || ''
      ).slice(0, 255);

      await pool.query(`
        INSERT INTO tvg_checkout_links
        (
          token,
          plan,
          source_page,
          original_query_string,
          affiliate_ref,
          step2_file,
          expires_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          NOW() + INTERVAL '30 minutes'
        )
      `, [
        token,
        plan,
        sourcePage,
        originalQueryString,
        affiliateRef,
        step2File
      ]);

      res.set('Cache-Control', 'no-store');

      return res.json({
        url: '/c/' + token
      });

    } catch (e) {
      console.error('Create checkout link failed:', e);

      return res.status(500).json({
        error: 'Could not create checkout link'
      });
    }
  });

  app.get('/c/:token', async (req, res) => {
    try {
      const token = req.params.token;

      if (!/^[A-Za-z0-9_-]{24}$/.test(token)) {
        return res.status(404).send('Not found');
      }

      const result = await pool.query(`
        SELECT plan, step2_file
        FROM tvg_checkout_links
        WHERE token = $1
        AND expires_at > NOW()
      `, [token]);

      if (!result.rowCount) {
        return res.status(404).send(
          'Checkout link expired or unavailable'
        );
      }

      const filename =
        result.rows[0].step2_file || 'checkout.html';

      const templatePath = getTemplate(filename);

      if (!templatePath) {
        return res.status(404).send(
          'Checkout template unavailable'
        );
      }

      let html = await fs.promises.readFile(
        templatePath, 'utf8'
      );

      const bootstrap = `
<script>
window.PROMO_CHECKOUT_TOKEN = ${JSON.stringify(token)};
</script>`;

      if (/<head\b[^>]*>/i.test(html)) {
        html = html.replace(
          /<head\b[^>]*>/i,
          match => match + bootstrap
        );
      } else {
        html = bootstrap + html;
      }

      res.set('Cache-Control', 'no-store');
      res.type('html').send(html);

    } catch (e) {
      console.error('Checkout link error:', e);

      res.status(500).send('Checkout unavailable');
    }
  });

  app.get('/api/checkout-link/:token', async (req, res) => {
    try {
      const token = req.params.token;

      if (!/^[A-Za-z0-9_-]{24}$/.test(token)) {
        return res.status(404).json({
          error: 'Not found'
        });
      }

      const result = await pool.query(`
        SELECT plan, step2_file
        FROM tvg_checkout_links
        WHERE token = $1
        AND expires_at > NOW()
      `, [token]);

      if (!result.rowCount) {
        return res.status(404).json({
          error: 'Checkout link expired or unavailable'
        });
      }

      res.set('Cache-Control', 'no-store');

      res.json({
        plan: result.rows[0].plan,
        step2File: result.rows[0].step2_file
      });

    } catch (e) {
      console.error('Checkout token lookup failed:', e);

      res.status(500).json({
        error: 'Checkout unavailable'
      });
    }
  });
}

module.exports = { init, attach };
