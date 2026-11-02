import { BASE } from './constants.js';

export const FN_PAYMENTS_API = `${BASE}/functions/v1/payments-api`;
export const LS_PAY_TOKEN = 'ems_payments_token';
export const LS_PAY_PAYER = 'ems_payments_payer';
export const LS_PAY_NAME = 'ems_payments_name';

export function getPaymentsToken(){ return localStorage.getItem(LS_PAY_TOKEN) || ''; }
export function getPaymentsPayer(){ return localStorage.getItem(LS_PAY_PAYER) || ''; }
export function getPaymentsName(){ return localStorage.getItem(LS_PAY_NAME) || ''; }

export function savePaymentsSession(token, payer, name){
  localStorage.setItem(LS_PAY_TOKEN, token);
  localStorage.setItem(LS_PAY_PAYER, payer || '');
  localStorage.setItem(LS_PAY_NAME, name || '');
}

export function clearPaymentsSession(){
  localStorage.removeItem(LS_PAY_TOKEN);
  localStorage.removeItem(LS_PAY_PAYER);
  localStorage.removeItem(LS_PAY_NAME);
}

export function requirePaymentsAuth(){
  if (!getPaymentsToken()) location.href = 'payments-login.html';
}

export async function paymentsFetch(path, options={}){
  const token = getPaymentsToken();
  const headers = {
    Accept: 'application/json',
    ...(options.body ? {'Content-Type':'application/json'} : {}),
    ...(token ? {Authorization:`Bearer ${token}`} : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`${FN_PAYMENTS_API}${path}`, {...options, headers});
  let data = {};
  try{ data = await res.json(); }catch{}
  if (!res.ok) {
    if (res.status === 401) clearPaymentsSession();
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data;
}
