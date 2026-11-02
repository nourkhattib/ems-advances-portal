// Supabase Edge Function: seed-payment-users
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PAYMENTS_SEED_SECRET
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type, authorization",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
async function sha256Hex(input:string){
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));
  return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function salt(){const b=new Uint8Array(24);crypto.getRandomValues(b);return btoa(String.fromCharCode(...b)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST') return json({error:'Method Not Allowed'},405);
  const body=await req.json().catch(()=>({}));
  if(String(body.seed_secret||'') !== (Deno.env.get('PAYMENTS_SEED_SECRET')||'')) return json({error:'Bad seed secret'},401);

  const users=[
    {payer_code:'nur',display_name:'נור',pin:String(body.nur_pin||'')},
    {payer_code:'gnaim',display_name:'גנאיים',pin:String(body.gnaim_pin||'')},
    {payer_code:'fadi',display_name:'פאדי',pin:String(body.fadi_pin||'')},
  ];
  for(const u of users){if(!/^\d{4,12}$/.test(u.pin)) return json({error:`PIN לא תקין עבור ${u.display_name}`},400);}

  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const rows=[];
  for(const u of users){
    const s=salt(); rows.push({payer_code:u.payer_code,display_name:u.display_name,salt:s,pin_hash:await sha256Hex(`${s}:${u.pin}`),is_active:true});
  }
  const {error}=await supabase.from('payment_users').upsert(rows,{onConflict:'payer_code'});
  if(error) return json({error:error.message},400);
  return json({ok:true,users:users.map(x=>x.display_name)});
});
