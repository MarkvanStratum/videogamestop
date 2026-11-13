const Stripe = require('stripe');
const crypto = require('crypto');
const {Pool} = require('pg');
const pool = new Pool({connectionString:process.env.DATABASE_URL,max:5});
const plans = {starter:{name:'Starter',amount:2295,rank:1},premium:{name:'Premium',amount:2695,rank:2},ultimate:{name:'Ultimate',amount:3795,rank:3}};
const legacyPlans = {'2295':'starter','2695':'premium','3795':'ultimate',lifetime:'ultimate',god:'starter',all:'premium'};
const normalizePlan = plan => legacyPlans[plan] || plan;
const rank = t => plans[t]?.rank||0;
function stripeClient(){if(!process.env.STRIPE_SECRET_KEY)throw Error('STRIPE_SECRET_KEY missing');return new Stripe(process.env.STRIPE_SECRET_KEY);}
async function init(){await pool.query(`CREATE TABLE IF NOT EXISTS tvg_stripe_payments (reference TEXT PRIMARY KEY, payment_intent_id TEXT UNIQUE, user_id BIGINT NOT NULL REFERENCES tvg_users(id), plan TEXT NOT NULL, amount_pence INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'gbp', status TEXT NOT NULL DEFAULT 'creating', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), paid_at TIMESTAMPTZ);`);}
async function completePayment(intent){
 const reference=intent.metadata?.reference;
 if(!reference || intent.status!=='succeeded')return;
 const client=await pool.connect();
 try{await client.query('BEGIN');
  const result=await client.query('SELECT * FROM tvg_stripe_payments WHERE reference=$1 FOR UPDATE',[reference]);
  if(!result.rowCount){console.error('Unknown payment reference',reference);await client.query('ROLLBACK');throw Error('Unknown payment reference');}
  const p=result.rows[0];
  if(String(p.user_id)!==intent.metadata?.user_id || p.plan!==intent.metadata?.plan || p.amount_pence!==intent.amount || intent.currency!=='gbp' || (p.payment_intent_id && p.payment_intent_id!==intent.id))throw Error('Stripe payment validation mismatch');
  await client.query(`UPDATE tvg_stripe_payments SET status='paid',payment_intent_id=$2,paid_at=COALESCE(paid_at,NOW()) WHERE reference=$1`,[reference,intent.id]);
  await client.query(`UPDATE tvg_users SET access_tier=CASE WHEN lifetime_access OR access_tier='ultimate' OR $2='ultimate' THEN 'ultimate' WHEN $2='premium' AND access_tier IN ('free','starter') THEN 'premium' WHEN $2='starter' AND access_tier='free' THEN 'starter' ELSE access_tier END WHERE id=$1`,[p.user_id,p.plan]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
function attachWebhook(app){
 app.post('/api/stripe/webhook',require('express').raw({type:'application/json'}),async(req,res)=>{
  if(!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).send('Webhook secret missing');
  let event;try{event=stripeClient().webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}catch(e){return res.status(400).send('Invalid webhook signature');}
  try{
   if(event.type==='payment_intent.succeeded')await completePayment(event.data.object);
   if(['payment_intent.payment_failed','payment_intent.canceled'].includes(event.type)){
    const pi=event.data.object;
    await pool.query(`UPDATE tvg_stripe_payments SET status=$2 WHERE reference=$1 AND status<>'paid'`,[pi.metadata?.reference,event.type==='payment_intent.canceled'?'canceled':'failed']);
   }
   return res.json({received:true});
  }catch(e){console.error('Stripe webhook processing failed:',e);return res.status(500).send('Retry webhook');}
 });
}
function attachApi(app,auth){
 app.get('/api/stripe/config',(_req,res)=>{if(!process.env.STRIPE_PUBLISHABLE_KEY)return res.status(503).json({error:'Stripe publishable key missing'});res.set('Cache-Control','no-store');res.json({publishableKey:process.env.STRIPE_PUBLISHABLE_KEY});});
 app.post('/api/stripe/create-payment-intent',async(req,res)=>{
  try{
   if(!process.env.STRIPE_WEBHOOK_SECRET||!process.env.STRIPE_PUBLISHABLE_KEY)return res.status(503).json({error:'Stripe is not fully configured'});
   const u=await auth.user(req);if(!u)return res.status(401).json({error:'Please register or log in before purchasing.'});
   const plan=normalizePlan(String(req.body?.plan||''));if(!Object.hasOwn(plans,plan))return res.status(400).json({error:'Invalid package'});
   if(u.lifetime_access||rank(u.access_tier)>=rank(plan))return res.status(409).json({error:'Your account already has this access level or higher.'});
   const p=plans[plan],reference=crypto.randomUUID();
   await pool.query(`INSERT INTO tvg_stripe_payments(reference,user_id,plan,amount_pence) VALUES($1,$2,$3,$4)`,[reference,u.id,plan,p.amount]);
   const intent=await stripeClient().paymentIntents.create({amount:p.amount,currency:'gbp',payment_method_types:['card'],receipt_email:u.email,description:`Top Video Games — ${p.name} lifetime access`,metadata:{reference,user_id:String(u.id),plan}},{idempotencyKey:reference});
   await pool.query(`UPDATE tvg_stripe_payments SET payment_intent_id=$2,status='pending' WHERE reference=$1 AND status='creating'`,[reference,intent.id]);
   res.set('Cache-Control','no-store');res.json({clientSecret:intent.client_secret,reference});
  }catch(e){console.error('Stripe payment creation failed:',e);res.status(500).json({error:'Could not start payment. Please try again.'});}
 });
 // Legacy payment-route aliases. Responses contain Stripe clientSecret, NOT Xolvis tokens.
 // Existing Xolvis payment.js pages must be adapted to Stripe.js; no raw card data is accepted here.
 app.post('/api/create-landing-payment', (req,res) => res.status(426).json({error:'This legacy Xolvis payment endpoint requires a Stripe.js frontend update. Use /api/stripe/create-payment-intent with plan 3795.'}));
 app.post('/api/create-au-payment-2695', (req,res) => res.status(426).json({error:'This legacy Xolvis payment endpoint requires a Stripe.js frontend update. Use /api/stripe/create-payment-intent with plan 2695.'}));
 app.post('/api/create-payment-2295', (req,res) => res.status(426).json({error:'This legacy Xolvis payment endpoint requires a Stripe.js frontend update. Use /api/stripe/create-payment-intent with plan 2295.'}));
 app.post('/api/create-promo-payment', (req,res) => res.status(426).json({error:'Legacy Xolvis transactionToken is not supported by Stripe. Update this landing page to use Stripe Elements.'}));
 app.get('/api/xolvis-public-key', (_req,res)=>res.status(410).json({error:'Xolvis is not used; request /api/stripe/config instead.'}));
 app.get('/api/stripe/payment-status',async(req,res)=>{
  try{const u=await auth.user(req);if(!u)return res.status(401).json({error:'Please log in.'});const reference=String(req.query.reference||'');if(!/^[0-9a-f-]{36}$/.test(reference))return res.status(400).json({error:'Invalid payment reference'});
   const r=await pool.query('SELECT status,plan,payment_intent_id FROM tvg_stripe_payments WHERE reference=$1 AND user_id=$2',[reference,u.id]);if(!r.rowCount)return res.status(404).json({error:'Payment not found'});
   let row=r.rows[0];if(row.status!=='paid'&&row.payment_intent_id){const intent=await stripeClient().paymentIntents.retrieve(row.payment_intent_id);if(intent.status==='succeeded'){await completePayment(intent);row={...row,status:'paid'};}}
   res.set('Cache-Control','no-store');res.json({status:row.status,plan:row.plan});
  }catch(e){console.error('Payment status failed:',e);res.status(500).json({error:'Unable to check payment status'});}
 });
}
module.exports={init,attachWebhook,attachApi};
