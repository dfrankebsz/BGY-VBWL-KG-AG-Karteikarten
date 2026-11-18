/* Offline shell, never cache authentication or user API responses. */
const CACHE='kgag-lernarena-v2';
const ASSETS=['./','./index.html','./style.css','./app.js','./assets/decks.js','./assets/challenges.js','./assets/icon.svg','./manifest.webmanifest'];
self.addEventListener('install', event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('kgag-')||k.startsWith('wirtschaftsrecht-karten-'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 if(new URL(req.url).pathname.startsWith('/.netlify/')||new URL(req.url).pathname.startsWith('/api/'))return;
 event.respondWith(fetch(req).then(response=>{
   if(response.ok&&response.type==='basic'){
     const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy));
   }
   return response;
 }).catch(()=>caches.match(req)));
});
