import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../netlify/functions/api.mjs';

function makeStores(){
  const tables=new Map();let counter=0;
  return ({name})=>{
    if(!tables.has(name))tables.set(name,new Map());const rows=tables.get(name);
    return {
      async get(k){return rows.get(k)?.data??null;},
      async getWithMetadata(k){const r=rows.get(k);return r?{data:r.data,etag:r.etag,metadata:{}}:null;},
      async setJSON(k,value,opts={}){const old=rows.get(k);if(opts.onlyIfNew&&old)return {modified:false};if(opts.onlyIfMatch&&old?.etag!==opts.onlyIfMatch)return {modified:false};const etag='"etag-'+(++counter)+'"';rows.set(k,{data:structuredClone(value),etag});return {modified:true,etag};},
      async delete(k){rows.delete(k);}
    };
  };
}
const api=createHandler(makeStores());
function request(action,method='POST',body={},cookie=''){
 const url='https://schule.netlify.app/.netlify/functions/api?action='+action;
 const headers=new Headers({'origin':'https://schule.netlify.app','content-type':'application/json'});
 if(cookie)headers.set('cookie',cookie);
 return new Request(url,{method,headers,...(method==='POST'?{body:JSON.stringify(body)}:{})});
}
const fakeState={decks:[],cards:[],activity:[],settings:{},game:{xp:0}};
test('reg, auth, session, cloud sync and stale write detection',async()=>{
 const r=await api(request('register','POST',{nickname:'Lernfuchs',password:'SicheresPasswort-2026',state:fakeState}));
 assert.equal(r.status,201);const body=await r.json();assert.equal(body.user.nickname,'Lernfuchs');assert.ok(r.headers.get('set-cookie').includes('HttpOnly'));
 const c=r.headers.get('set-cookie').split(';')[0];
 assert.equal((await api(request('register','POST',{nickname:'LERnFuchS',password:'AnderesGeheimesPasswort',state:fakeState}))).status,409);
 assert.equal((await api(request('login','POST',{nickname:'Lernfuchs',password:'falsch'}))).status,401);
 const login=await api(request('login','POST',{nickname:'Lernfuchs',password:'SicheresPasswort-2026'}));
 assert.equal(login.status,200);
 const cc=login.headers.get('set-cookie').split(';')[0];
 const me=await api(request('me','GET',null,cc));assert.equal((await me.json()).signedIn,true);
 assert.equal((await api(request('me','GET',null))).status,200);
 const up=await api(request('save','POST',{version:body.version,state:{...fakeState,game:{xp:250}}},cc));
 assert.equal(up.status,200);const upBody=await up.json();assert.ok(upBody.version);
 const conflict=await api(request('save','POST',{version:body.version,state:fakeState},cc));assert.equal(conflict.status,409);assert.equal((await conflict.json()).state.game.xp,250);
 const r2=await api(request('register','POST',{nickname:'KartenKoenig',password:'NochEinSicheresPasswort',state:fakeState}));
 assert.equal(r2.status,201);const cookie2=r2.headers.get('set-cookie').split(';')[0];
 assert.equal((await (await api(request('me','GET',null,cookie2))).json()).state.game.xp,0);
 const logout=await api(request('logout','POST',{},cc));assert.equal(logout.status,200);
 assert.equal((await (await api(request('me','GET',null,cc))).json()).signedIn,false);
 assert.equal((await (await api(request('me','GET',null,c))).json()).signedIn,true); // independent session
});
test('rejects malicious origins, short password, malformed data',async()=>{
 let req=request('register','POST',{nickname:'ab',password:'longpassword-2026',state:fakeState});assert.equal((await api(req)).status,400);
 req=request('register','POST',{nickname:'NeuerNutzer',password:'123',state:fakeState});assert.equal((await api(req)).status,400);
 req=request('register','POST',{nickname:'NeuerNutzer',password:'longpassword-2026',state:{a:2}});assert.equal((await api(req)).status,400);
 req=new Request('https://schule.netlify.app/.netlify/functions/api?action=login',{method:'POST',headers:{'origin':'https://boese.example','Content-Type':'application/json'},body:JSON.stringify({nickname:'Lernfuchs',password:'SicheresPasswort-2026'})});assert.equal((await api(req)).status,403);
});
