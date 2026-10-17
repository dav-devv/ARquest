// Run against the local server: node test/live-check.js
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const { once } = require('node:events');
const WebSocket = require('ws');
function get(url, headers = {}, rawPath) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = (u.protocol === 'https:' ? https : http).get({ hostname:u.hostname,port:u.port,path:rawPath || u.pathname,headers,rejectUnauthorized:false },res=>{
      let body=''; res.on('data',d=>body+=d); res.on('end',()=>resolve({status:res.statusCode,body}));
    });
    req.on('error',reject); req.setTimeout(3000,()=>req.destroy(new Error('HTTP timeout')));
  });
}
async function main() {
  const pairing=await get('http://localhost:3000/api/pairing');
  assert.equal(pairing.status,200);
  const mobile=new URL(JSON.parse(pairing.body).mobileUrl);
  const token=new URLSearchParams(mobile.hash.slice(1)).get('token');
  const nativePairing=await get('https://localhost:3443/api/native/pairing');
  assert.equal(nativePairing.status,200);
  const nativeQr=JSON.parse(nativePairing.body);
  assert.match(nativeQr.qrDataUrl,/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
  assert.equal(Object.hasOwn(nativeQr,'code'),false);
  assert.equal((await get('https://localhost:3443/api/native/pairing',{Origin:'https://untrusted.invalid'})).status,403);
  assert.equal((await get('http://localhost:3000/api/pairing',{Origin:'https://untrusted.invalid'})).status,403);
  for(const path of ['/mobile/../pc_server/server.js','/mobile/%2e%2e/pc_server/server.js','/../pc_server/server.js']) {
    assert.equal((await get('http://localhost:3000',{},path)).status,403);
  }
  const page=await get(mobile.origin+'/mobile');
  assert.equal(page.status,200); assert(page.body.includes('gestureIntent'));
  assert.equal((await get(mobile.origin+'/mobile/interaction.js')).status,200);
  for(const file of ['ar.html','ar.css','spatial-ar.js','spatial-math.js','ar-bridge.js']) {
    assert.equal((await get(mobile.origin+'/mobile/'+file)).status,200,file);
  }
  const denied=new WebSocket('wss://localhost:3443',{rejectUnauthorized:false,origin:'https://untrusted.invalid',handshakeTimeout:3000});
  await new Promise((resolve,reject)=>{denied.on('open',()=>{denied.close();reject(new Error('Unauthenticated client accepted'));});denied.on('error',error=>{try { assert.match(error.message,/401/); resolve(); } catch(e) { reject(e); }});});
  const url='wss://'+mobile.host+'?token='+token;
  const clients=[];
  try {
    for(let i=0;i<2;i++) { const ws=new WebSocket(url,{rejectUnauthorized:false,origin:mobile.origin,handshakeTimeout:3000});clients.push(ws); await once(ws,'open'); }
    const received=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Relay timeout')),3000);
      clients[1].on('message',raw=>{const data=JSON.parse(raw);if(data.type==='gesture_pinch' && data.test===true){clearTimeout(timer);resolve();}});
    });
    clients[0].send(JSON.stringify({type:'gesture_pinch',test:true}));
    await received;
  } finally { clients.forEach(ws=>ws.close()); }
  console.log('PASS: HTTPS assets, traversal blocked, local pairing only, unauthorized WSS rejected, paired WSS relay.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
