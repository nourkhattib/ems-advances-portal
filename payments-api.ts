// Supabase Edge Function: payments-api
// Dedicated secure API for Nur / Gnaim / Fadi advances portal.
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMS_JWT_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, content-type, accept",
  "Access-Control-Allow-Methods":"GET, POST, OPTIONS"
};
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json"}});

async function hmacKey(mode:'sign'|'verify'){
  return crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('EMS_JWT_SECRET')||''),{name:'HMAC',hash:'SHA-256'},false,[mode]);
}
async function sha256Hex(input:string){
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));
  return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function auth(req:Request){
  const m=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i); if(!m) return null;
  try{
    const p:any=await verify(m[1],await hmacKey('verify'));
    if(p?.scope!=='payments' || !['nur','gnaim','fadi'].includes(p?.payer)) return null;
    return {payer:String(p.payer),display_name:String(p.display_name||'')};
  }catch{return null;}
}
function monthRange(month:string){
  if(!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y,m]=month.split('-').map(Number); const next=m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,'0')}`;
  return {start:`${month}-01`,end:`${next}-01`};
}
function lastDay(month:string){
  const [y,m]=month.split('-').map(Number); return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
}
function fmtHe(date:string){const [y,m,d]=date.split('-');return `${d}/${m}/${y}`;}
function currentJerusalemDate(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const o:any={}; for(const p of parts) if(p.type!=='literal') o[p.type]=p.value; return `${o.year}-${o.month}-${o.day}`;
}
function salaryMonthFor(dateIso:string, cutoff=10){
  const [y,m,d]=dateIso.split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,1)); if(d<=cutoff) dt.setUTCMonth(dt.getUTCMonth()-1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`;
}
function prevMonth(month:string){const [y,m]=month.split('-').map(Number);return m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,'0')}`;}
function n(v:any){const x=Number(v);return Number.isFinite(x)?x:0;}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:CORS});
  const url=new URL(req.url);
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // LOGIN
  if(req.method==='POST' && url.pathname.endsWith('/payments-api/login')){
    const {pin}=await req.json().catch(()=>({}));
    if(!pin) return json({error:'Missing PIN'},400);
    const {data:users,error}=await supabase.from('payment_users').select('payer_code,display_name,pin_hash,salt,is_active').eq('is_active',true);
    if(error) return json({error:error.message},500);
    let found:any=null;
    for(const u of users||[]){if(await sha256Hex(`${u.salt}:${String(pin)}`)===u.pin_hash){found=u;break;}}
    if(!found) return json({error:'סיסמה שגויה'},401);
    const token=await create({alg:'HS256',typ:'JWT'},{scope:'payments',payer:found.payer_code,display_name:found.display_name,iat:getNumericDate(new Date()),exp:getNumericDate(60*60*24*30)},await hmacKey('sign'));
    return json({token,payer:found.payer_code,display_name:found.display_name});
  }

  const who=await auth(req); if(!who) return json({error:'Unauthorized'},401);

  // employees list
  if(req.method==='GET' && url.pathname.endsWith('/payments-api/employees')){
    const {data,error}=await supabase.from('employees').select('id,name,id_number').order('name',{ascending:true});
    if(error) return json({error:error.message},400); return json({data:data||[]});
  }

  // payments for accounting month
  if(req.method==='GET' && url.pathname.endsWith('/payments-api/payments')){
    const month=url.searchParams.get('month')||salaryMonthFor(currentJerusalemDate()); const r=monthRange(month); if(!r) return json({error:'Invalid month'},400);
    const {data,error}=await supabase.from('employee_payments').select('id,employee_id,payment_date,given_date,reason,payment_type,nur_amount,gnaim_amount,fadi_amount,company_amount').gte('payment_date',r.start).lt('payment_date',r.end).order('payment_date',{ascending:false}).order('id',{ascending:false});
    if(error) return json({error:error.message},400); return json({data:data||[],month});
  }

  // selected employee: current salary month + previous salary month
  if(req.method==='GET' && url.pathname.endsWith('/payments-api/employee-context')){
    const employeeId=Number(url.searchParams.get('employee_id')); if(!Number.isFinite(employeeId)||employeeId<=0) return json({error:'Invalid employee'},400);
    const today=currentJerusalemDate(); const current=salaryMonthFor(today); const previous=prevMonth(current);
    const {data:emp,error:ee}=await supabase.from('employees').select('id,name,id_number,rate_first_6,rate_after_6').eq('id',employeeId).single();
    if(ee||!emp) return json({error:ee?.message||'Employee not found'},404);

    async function calc(month:string){
      const r=monthRange(month)!;
      const {data:shifts,error:se}=await supabase.from('shifts').select('id,event_date').gte('event_date',r.start).lt('event_date',r.end);
      if(se) throw new Error(se.message);
      const ids=(shifts||[]).map((x:any)=>x.id);
      let rows:any[]=[];
      if(ids.length){
        const {data,error}=await supabase.from('shift_employees').select('id,total_hours,hourly_rate,rate_first_6,rate_after_6,car_bonus').eq('employee_id',employeeId).in('shift_id',ids);
        if(error) throw new Error(error.message); rows=data||[];
      }
      let gross=0;
      for(const row of rows){
        const hours=n(row.total_hours); const rate=hours>6.5 ? n(row.rate_after_6||row.hourly_rate||emp.rate_after_6||emp.rate_first_6) : n(row.rate_first_6||row.hourly_rate||emp.rate_first_6||emp.rate_after_6);
        gross += hours*rate+n(row.car_bonus);
      }
      const {data:pays,error:pe}=await supabase.from('employee_payments').select('nur_amount,gnaim_amount,fadi_amount,company_amount').eq('employee_id',employeeId).gte('payment_date',r.start).lt('payment_date',r.end);
      if(pe) throw new Error(pe.message);
      let paid=0; for(const p of pays||[]) paid+=n(p.nur_amount)+n(p.gnaim_amount)+n(p.fadi_amount)+n(p.company_amount);
      return {month,gross:Number(gross.toFixed(2)),paid:Number(paid.toFixed(2)),remaining:Number(Math.max(0,gross-paid).toFixed(2)),shift_count:rows.length};
    }
    try{return json({employee:emp,today,current:await calc(current),previous:await calc(previous)});}catch(e){return json({error:(e as Error).message},400);}
  }

  // create advance; payer is server-controlled from JWT
  if(req.method==='POST' && url.pathname.endsWith('/payments-api/payments')){
    const body=await req.json().catch(()=>({})); const employee_id=Number(body.employee_id); const amount=Number(body.amount); const salary_month=String(body.salary_month||''); const note=String(body.note||'').trim();
    if(!Number.isFinite(employee_id)||employee_id<=0) return json({error:'בחר עובד'},400);
    if(!Number.isFinite(amount)||amount<=0) return json({error:'סכום לא תקין'},400);
    const r=monthRange(salary_month); if(!r) return json({error:'חודש שכר לא תקין'},400);

    const today=currentJerusalemDate(); const calendarMonth=today.slice(0,7);
    const payment_date=salary_month===calendarMonth ? today : lastDay(salary_month);
    const reason=[`מפרעה`, `ניתנה בפועל ${fmtHe(today)}`, `שיוך לשכר ${salary_month.slice(5,7)}/${salary_month.slice(0,4)}`, note].filter(Boolean).join(' • ');
    const row:any={employee_id,payment_date,given_date:today,reason,payment_type:'advance',shift_employee_id:null,nur_amount:0,gnaim_amount:0,fadi_amount:0,company_amount:0};
    row[`${who.payer}_amount`]=amount;
    const {data,error}=await supabase.from('employee_payments').insert(row).select('*').single();
    if(error) return json({error:error.message},400);
    return json({data,payer:who.payer,display_name:who.display_name},201);
  }

  if(req.method==='GET' && url.pathname.endsWith('/payments-api/me')) return json({payer:who.payer,display_name:who.display_name});
  return json({error:'Not found'},404);
});
