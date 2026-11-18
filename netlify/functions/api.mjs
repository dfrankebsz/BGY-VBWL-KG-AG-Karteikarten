/** Nickname authentication and progress sync – Netlify Functions + Netlify Blobs.
 * No application-wide auth secret: opaque, unpredictable 256-bit session tokens are
 * stored server-side and delivered in HttpOnly Secure cookies.
 */
import { getStore } from '@netlify/blobs';
import { randomBytes, createHash, timingSafeEqual, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb);
const SESSION_DAYS = 30;
const MAX_BODY = 1_600_000; // JSON payload including custom decks
const COOKIE_NAME = 'kgag_session';
const hash = value => createHash('sha256').update(value).digest('hex');
const normNick = raw => String(raw ?? '').normalize('NFKC').trim().toLocaleLowerCase('de-DE');
const validNick = nick => /^[\p{L}\p{N}_-]{3,24}$/u.test(nick);
const error = (message, status = 400) => json({ ok: false, error: message }, status);
const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...headers }
});
const parseCookies = req => Object.fromEntries((req.headers.get('cookie')||'').split(';').map(part => {
  const idx = part.indexOf('='); return idx < 0 ? ['', ''] : [part.slice(0, idx).trim(), part.slice(idx+1).trim()];
}));
const cookie = (token, request, maxAge = SESSION_DAYS * 86400) => {
  // SameSite+Origin verification mitigate CSRF; HTTPS is required on deployed Netlify sites.
  const secure = new URL(request.url).hostname !== 'localhost' && new URL(request.url).hostname !== '127.0.0.1';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; ${secure ? 'Secure; ' : ''}Max-Age=${maxAge}`;
};
const goodState = s => s && typeof s === 'object' && Array.isArray(s.decks) && Array.isArray(s.cards) && s.cards.length <= 12000 && s.decks.length <= 500 && s.activity?.length <= 20000;
const cleanBody = async req => {
  if (Number(req.headers.get('content-length')||0)>MAX_BODY) throw Object.assign(new Error('Zu große Datenmenge.'),{status:413});
  const body=await req.text(); if (body.length>MAX_BODY) throw Object.assign(new Error('Zu große Datenmenge.'),{status:413});
  try { return JSON.parse(body||'{}'); }catch {throw Object.assign(new Error('Ungültige JSON-Daten.'),{status:400});}
};
async function passwordHash(password,salt) {
  const out = await scrypt(password,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1,maxmem:32*1024*1024});
  return Buffer.from(out).toString('hex');
}
function eqHash(a,b){try{return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}catch{return false;}}
function today(){return Date.now();}
export function createHandler(storeFactory = getStore) {
  // Separate prod and preview data. No Preview deployment may mutate production accounts.
  const contextName = (process.env.CONTEXT==='production'||!process.env.CONTEXT)?'prod':'sandbox';
  const store = (suffix) => storeFactory({name:`kgag-${suffix}-${contextName}`,consistency:'strong'});
  const users = ()=>store('accounts');
  const sessions = ()=>store('sessions');
  const progress = ()=>store('progress');
  const attempts = ()=>store('loginlimits');
  async function authenticated(req) {
    const token=parseCookies(req)[COOKIE_NAME];
    if(!token||!/^[a-f0-9]{64}$/.test(token)) return null;
    const key='s-'+hash(token);
    const value=await sessions().get(key,{type:'json',consistency:'strong'});
    if(!value||!value.exp||value.exp<today()) return null;
    const user=await users().get(value.userKey,{type:'json',consistency:'strong'});
    if(!user) return null;
    return {user,userKey:value.userKey,sessionKey:key};
  }
  async function getProgress(user) {
    const rec=await progress().getWithMetadata(`p-${user.uid}`,{type:'json',consistency:'strong'});
    return rec ? {state:rec.data,version:rec.etag} : {state:null,version:null};
  }
  async function newSession(req,userKey) {
    const token=randomBytes(32).toString('hex');
    await sessions().setJSON('s-'+hash(token),{userKey,exp:today()+SESSION_DAYS*86400000});
    return cookie(token,req);
  }
  const safeUser = user=>({nickname:user.nickname,createdAt:user.createdAt});
  return async function handler(req) {
    try {
      const url=new URL(req.url);
      const action=url.searchParams.get('action')||'';
      if (!['GET','POST'].includes(req.method)) return error('Methode nicht erlaubt.',405);
      // Check Origin for every mutation – no cross-site authenticated POSTs.
      if(req.method==='POST') {
        const origin=req.headers.get('origin');
        if (origin && origin !== url.origin) return error('Herkunft der Anfrage nicht erlaubt.',403);
        if(!['application/json'].some(x=>(req.headers.get('content-type')||'').includes(x))) return error('JSON erforderlich.',415);
      }
      if(req.method==='GET' && action==='health') return json({ok:true,service:'kgag-lern-arena'});
      if(req.method==='GET' && action==='me') {
        const auth=await authenticated(req);
        if(!auth) return json({ok:true,signedIn:false});
        const data=await getProgress(auth.user);
        return json({ok:true,signedIn:true,user:safeUser(auth.user),...data});
      }
      if(req.method==='POST' && action==='register') {
        const body=await cleanBody(req);
        const nickname=String(body.nickname||'').normalize('NFKC').trim();
        const nick=normNick(nickname);
        const password=String(body.password||'');
        if(!validNick(nick)) return error('Nickname: 3–24 Zeichen; Buchstaben, Ziffern, _ oder -.');
        if(password.length<10||password.length>128) return error('Passwort: 10–128 Zeichen.');
        if(!goodState(body.state)) return error('Unvollständiger Lernstand.');
        const salt=randomBytes(16).toString('hex');
        const key='u-'+hash(nick);
        const user={uid:randomBytes(16).toString('hex'),nickname,normalized:nick,salt,passwordHash:await passwordHash(password,salt),createdAt:today()};
        const reserved=await users().setJSON(key,user,{onlyIfNew:true});
        if(!reserved.modified) return error('Dieser Nickname ist bereits vergeben.',409);
        const wrote=await progress().setJSON('p-'+user.uid,body.state,{onlyIfNew:true});
        if(!wrote.modified) return error('Speicherung vorübergehend fehlgeschlagen.',503);
        const session=await newSession(req,key);
        return json({ok:true,signedIn:true,user:safeUser(user),state:body.state,version:wrote.etag},201,{'Set-Cookie':session});
      }
      if(req.method==='POST' && action==='login') {
        const body=await cleanBody(req);
        const nick=normNick(body.nickname);
        const password=String(body.password||'');
        if(!validNick(nick)||!password||password.length>128) return error('Nickname oder Passwort falsch.',401);
        const key='u-'+hash(nick);
        const lockKey='f-'+hash(nick);
        const limit=await attempts().get(lockKey,{type:'json',consistency:'strong'});
        if(limit && limit.lockUntil>today()) return error('Zu viele Versuche. Bitte später erneut anmelden.',429);
        const user=await users().get(key,{type:'json',consistency:'strong'});
        const check=user?await passwordHash(password,user.salt):await passwordHash(password,randomBytes(16).toString('hex'));
        if(!user||!eqHash(check,user.passwordHash)) {
          const count=(limit&&limit.since>today()-15*60000?limit.count:0)+1;
          await attempts().setJSON(lockKey,{count,since:today(),lockUntil:count>=6?today()+15*60000:0});
          return error('Nickname oder Passwort falsch.',401);
        }
        await attempts().delete(lockKey);
        const session=await newSession(req,key);
        const data=await getProgress(user);
        return json({ok:true,signedIn:true,user:safeUser(user),...data},200,{'Set-Cookie':session});
      }
      if(req.method==='POST' && action==='logout') {
        const auth=await authenticated(req);
        if(auth) await sessions().delete(auth.sessionKey);
        return json({ok:true},200,{'Set-Cookie':cookie('',req,0)});
      }
      if(req.method==='POST' && action==='save') {
        const auth=await authenticated(req);
        if(!auth) return error('Nicht angemeldet.',401);
        const body=await cleanBody(req);
        if(!goodState(body.state)) return error('Lernstand ungültig oder zu groß.');
        const key='p-'+auth.user.uid;
        const previous=await progress().getWithMetadata(key,{type:'json',consistency:'strong'});
        const version=String(body.version||'');
        if ((previous?.etag||'')!==version) return json({ok:false,error:'Zwischenzeitlich auf einem anderen Gerät geändert.',conflict:true,version:previous?.etag||null,state:previous?.data||null},409);
        const saved=await progress().setJSON(key,body.state,previous?{onlyIfMatch:previous.etag}:{onlyIfNew:true});
        if(!saved.modified) {
          const latest=await getProgress(auth.user);
          return json({ok:false,error:'Speicherkonflikt.',conflict:true,...latest},409);
        }
        return json({ok:true,version:saved.etag,savedAt:today()});
      }
      return error('Unbekannter Endpunkt.',404);
    } catch(e) {
      if(e?.status) return error(e.message,e.status);
      console.error('API error:',e?.message);
      return error('Serverfehler. Bitte später erneut versuchen.',500);
    }
  };
}
export default createHandler();
