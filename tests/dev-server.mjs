import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHandler} from '../netlify/functions/api.mjs';
const dir=path.resolve(import.meta.dirname,'..','public');
const datasets=new Map();let n=0;
const getStore=({name})=>{
 if(!datasets.has(name))datasets.set(name,new Map());const m=datasets.get(name);
 return {
  async get(k){return m.get(k)?.value??null},
  async getWithMetadata(k){const x=m.get(k);return x?{data:x.value,etag:x.etag,metadata:{}}:null},
  async setJSON(k,value,opt={}){const x=m.get(k);if((opt.onlyIfNew&&x)||(opt.onlyIfMatch&&x?.etag!==opt.onlyIfMatch))return {modified:false};const etag='"v'+(++n)+'"';m.set(k,{value:structuredClone(value),etag});return {modified:true,etag}},
  async delete(k){m.delete(k)}
 };
};
const handler=createHandler(getStore);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain'};
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost:8765');
  if(u.pathname.startsWith('/.netlify/functions/api')){
   let buffer=[];for await (const chunk of req)buffer.push(chunk);
   const request=new Request('http://localhost:8765'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(buffer)}:{})});
   const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  const filepath=path.join(dir,decodeURIComponent(u.pathname==='/'?'index.html':u.pathname));
  if(!filepath.startsWith(dir))throw new Error('traversal');
  const bytes=await fs.readFile(filepath);res.writeHead(200,{'Content-Type':types[path.extname(filepath)]||'application/octet-stream'});res.end(bytes);
 }catch(e){res.writeHead(404);res.end('not found');}
});
server.listen(8765,'127.0.0.1',()=>console.log('local test site http://localhost:8765'));
