// One-time, expiring checkout URLs; checkout payment remains handled by Stripe.
const crypto = require('crypto');
const path = require('path');
const {Pool} = require('pg');
const pool = new Pool({connectionString:process.env.DATABASE_URL,max:5});
const plans = new Set(['starter','premium','ultimate']);
const aliases = {'2295':'starter','2695':'premium','3795':'ultimate',lifetime:'ultimate',god:'starter',all:'premium'};
const normalize = p => aliases[p] || p;
async function init(){await pool.query(`CREATE TABLE IF NOT EXISTS tvg_checkout_links (token TEXT PRIMARY KEY, plan TEXT NOT NULL, source_page TEXT, original_query_string TEXT, affiliate_ref TEXT, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);}
function attach(app){
 app.post('/api/create-promo-checkout-link',async(req,res)=>{
  try{
   const plan=normalize(String(req.body?.plan||'').trim());
   if(!plans.has(plan))return res.status(400).json({error:'Invalid plan'});
   // The only supported payment template is the existing Stripe checkout.
   if(req.body?.step2File && req.body.step2File!=='checkout.html')return res.status(400).json({error:'Unsupported checkout template; use checkout.html (Stripe).'});
   const token=crypto.randomBytes(18).toString('base64url');
   const sourcePage=String(req.body?.sourcePage||'').slice(0,1000);
   const originalQueryString=String(req.body?.originalQueryString||'').slice(0,3000);
   const affiliateRef=String(req.body?.ref||'').slice(0,255);
   await pool.query(`INSERT INTO tvg_checkout_links(token,plan,source_page,original_query_string,affiliate_ref,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '30 minutes')`,[token,plan,sourcePage,originalQueryString,affiliateRef]);
   res.set('Cache-Control','no-store');return res.json({url:'/c/'+token});
  }catch(e){console.error('Create checkout link failed:',e);return res.status(500).json({error:'Could not create checkout link'});}
 });
 // Alias for standard site links; same URL generation and Stripe payment flow.
 app.get('/c/:token',async(req,res)=>{
  try{
   if(!/^[A-Za-z0-9_-]{24}$/.test(req.params.token))return res.status(404).send('Not found');
   const r=await pool.query('SELECT plan FROM tvg_checkout_links WHERE token=$1 AND expires_at>NOW()',[req.params.token]);
   if(!r.rowCount)return res.status(404).send('Checkout link expired or unavailable');
   res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'public','checkout.html'));
  }catch(e){console.error('Checkout link error:',e);res.status(500).send('Checkout unavailable');}
 });
 app.get('/api/checkout-link/:token',async(req,res)=>{
  try{
   if(!/^[A-Za-z0-9_-]{24}$/.test(req.params.token))return res.status(404).json({error:'Not found'});
   const r=await pool.query('SELECT plan FROM tvg_checkout_links WHERE token=$1 AND expires_at>NOW()',[req.params.token]);
   if(!r.rowCount)return res.status(404).json({error:'Checkout link expired or unavailable'});
   res.set('Cache-Control','no-store');res.json({plan:r.rows[0].plan});
  }catch(e){console.error('Checkout token lookup failed:',e);res.status(500).json({error:'Checkout unavailable'});}
 });
}
module.exports={init,attach};
