const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const now = () => Math.floor(Date.now() / 1000);
function corsHeaders(origin) {
  const allowed = new Set(['https://kishanbali.github.io','http://localhost:8787','http://127.0.0.1:8787']);
  return allowed.has(origin) ? {'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','vary':'Origin'} : {};
}
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hmacSha256Hex(secret,message) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function safeEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let r=0;for(let i=0;i<a.length;i++)r|=a.charCodeAt(i)^b.charCodeAt(i);return r===0;}
function randomToken(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function hashAccessToken(env,token){return sha256Hex(`${env.ACCESS_TOKEN_PEPPER}:${token}`);}
async function razorpay(path,env,options={}){
  const auth=btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const response=await fetch(`https://api.razorpay.com/v1${path}`,{...options,headers:{authorization:`Basic ${auth}`,'content-type':'application/json',...(options.headers||{})}});
  const text=await response.text();let body;try{body=JSON.parse(text)}catch{body={raw:text}}
  if(!response.ok)throw new Error(`Razorpay ${response.status}: ${JSON.stringify(body)}`);return body;
}
const STAGES=new Set(['L1','L2','L3','L4','L5','L6','L7','L8','L9','L10','L11','L12-20']);
async function createOrder(request,env){
  const body=await request.json().catch(()=>null),stageKey=body?.stage_key;
  if(!STAGES.has(stageKey))return json({ok:false,error:'Invalid stage.'},400);
  const price=await env.DB.prepare('SELECT stage_key, amount_paise, currency FROM stage_prices WHERE stage_key = ? AND active = 1').bind(stageKey).first();
  if(!price||!Number.isInteger(price.amount_paise)||price.amount_paise<=1)return json({ok:false,error:'Stage price is not configured for checkout.'},409);
  const checkoutToken=randomToken(32),checkoutHash=await sha256Hex(checkoutToken);
  const order=await razorpay('/orders',env,{method:'POST',body:JSON.stringify({amount:price.amount_paise,currency:price.currency,receipt:`kemp-${stageKey}-${now()}-${crypto.randomUUID().slice(0,8)}`,notes:{kemp_stage:stageKey}})});
  await env.DB.prepare(`INSERT INTO orders(order_id,stage_key,amount_paise,currency,checkout_token_hash,status,created_at) VALUES(?,?,?,?,?,'created',?)`).bind(order.id,stageKey,price.amount_paise,price.currency,checkoutHash,now()).run();
  return json({ok:true,order_id:order.id,stage_key:stageKey,amount:price.amount_paise,currency:price.currency,key_id:env.RAZORPAY_KEY_ID,checkout_token:checkoutToken});
}
async function verifyPayment(request,env){
  const body=await request.json().catch(()=>null);
  const {checkout_token,razorpay_payment_id,razorpay_order_id,razorpay_signature}=body||{};
  if(!checkout_token||!razorpay_payment_id||!razorpay_order_id||!razorpay_signature)return json({ok:false,error:'Missing payment verification fields.'},400);
  const checkoutHash=await sha256Hex(checkout_token);
  const order=await env.DB.prepare('SELECT * FROM orders WHERE checkout_token_hash = ? AND order_id = ?').bind(checkoutHash,razorpay_order_id).first();
  if(!order)return json({ok:false,error:'Order not found.'},404);
  const expected=await hmacSha256Hex(env.RAZORPAY_KEY_SECRET,`${razorpay_order_id}|${razorpay_payment_id}`);
  if(!safeEqual(expected,razorpay_signature))return json({ok:false,error:'Invalid payment signature.'},400);
  const payment=await razorpay(`/payments/${encodeURIComponent(razorpay_payment_id)}`,env,{method:'GET'});
  if(payment.order_id!==razorpay_order_id||payment.status!=='captured')return json({ok:false,error:'Payment is not captured for this order.'},409);
  if(payment.amount!==order.amount_paise||payment.currency!==order.currency)return json({ok:false,error:'Payment amount/currency mismatch.'},409);
  const accessToken=randomToken(32),accessHash=await hashAccessToken(env,accessToken);
  await env.DB.prepare(`UPDATE orders SET status='paid',payment_id=?,access_token_hash=?,paid_at=? WHERE order_id=?`).bind(razorpay_payment_id,accessHash,now(),razorpay_order_id).run();
  return json({ok:true,stage_key:order.stage_key,access_token:accessToken});
}
async function webhook(request,env){
  const signature=request.headers.get('x-razorpay-signature'),eventId=request.headers.get('x-razorpay-event-id'),raw=await request.text();
  if(!signature||!eventId)return json({ok:false,error:'Missing webhook headers.'},400);
  const expected=await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET,raw);
  if(!safeEqual(expected,signature))return json({ok:false,error:'Invalid webhook signature.'},400);
  const existing=await env.DB.prepare('SELECT event_id FROM processed_events WHERE event_id = ?').bind(eventId).first();
  if(existing)return json({ok:true,duplicate:true});
  const payload=JSON.parse(raw),eventName=payload.event;
  if(eventName==='payment.captured'||eventName==='order.paid'){
    const paymentEntity=payload?.payload?.payment?.entity,orderEntity=payload?.payload?.order?.entity;
    const orderId=paymentEntity?.order_id||orderEntity?.id,paymentId=paymentEntity?.id;
    if(orderId){
      const order=await env.DB.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
      if(order&&paymentEntity?.status==='captured'&&paymentEntity.amount===order.amount_paise&&paymentEntity.currency===order.currency){
        await env.DB.prepare(`UPDATE orders SET status='paid',payment_id=?,paid_at=? WHERE order_id=? AND status!='paid'`).bind(paymentId||null,now(),orderId).run();
      }
    }
  }
  await env.DB.prepare('INSERT INTO processed_events(event_id,event_name,processed_at) VALUES(?,?,?)').bind(eventId,eventName||'unknown',now()).run();
  return json({ok:true});
}
async function access(request,env){
  const token=new URL(request.url).searchParams.get('token');
  if(!token)return json({ok:false,error:'Missing token.'},400);
  const hash=await hashAccessToken(env,token);
  const order=await env.DB.prepare("SELECT stage_key,status FROM orders WHERE access_token_hash = ? AND status = 'paid'").bind(hash).first();
  if(!order)return json({ok:false,error:'Access not found.'},403);
  return json({ok:true,stage_key:order.stage_key});
}
export default {async fetch(request,env){
  const origin=request.headers.get('origin')||'',headers=corsHeaders(origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const url=new URL(request.url);let response;
  try{
    if(request.method==='POST'&&url.pathname==='/api/order')response=await createOrder(request,env);
    else if(request.method==='POST'&&url.pathname==='/api/verify')response=await verifyPayment(request,env);
    else if(request.method==='POST'&&url.pathname==='/webhook/razorpay')response=await webhook(request,env);
    else if(request.method==='GET'&&url.pathname==='/api/access')response=await access(request,env);
    else response=json({ok:false,error:'Not found.'},404);
  }catch(error){console.error(error);response=json({ok:false,error:'Server error.'},500)}
  Object.entries(headers).forEach(([k,v])=>response.headers.set(k,v));return response;
}};
