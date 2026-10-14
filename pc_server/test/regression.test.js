const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ui = require('../../web_mobile_test/interaction');
const security = require('../security');
const root = path.resolve(__dirname, '../..');

function mobileContext() {
  const gradient = { addColorStop() {} };
  const canvas = new Proxy({}, { get: (o,k) => o[k] || (k === 'createLinearGradient' ? () => gradient : k === 'measureText' ? () => ({width:20}) : () => {}), set: (o,k,v) => (o[k]=v,true) });
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { width:800,height:600,style:{},classList:{add(){},remove(){}},addEventListener(){},getContext:()=>canvas,readyState:0,open:false,showModal(){this.open=true;},close(){this.open=false;},value:'',checked:false });
    return elements.get(id);
  }
  const storage = new Map();
  const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  const context=vm.createContext({
    console, MRInteraction:ui, document:{getElementById:element}, localStorage,sessionStorage:localStorage,
    window:{AudioContext:class {},addEventListener(){},location:{hostname:'localhost',protocol:'https:'}},
    Image:class {},performance:{now:()=>1000},setInterval(){},setTimeout(){},requestAnimationFrame(){},
    URLSearchParams,location:{hash:'',host:'localhost:3443',pathname:'/mobile'},history:{replaceState(){}},
    screen:{orientation:{angle:90}}
  });
  const html=fs.readFileSync(path.join(root,'web_mobile_test/index.html'),'utf8');
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1],context);
  return { context,elements,storage,run:code=>vm.runInContext(code,context) };
}

test('static files cannot escape public directories',()=>{
  const publicRoot=path.join(root,'web_mobile_test');
  for(const route of ['/../pc_server/server.js','/%2e%2e/pc_server/server.js','/..%5cpc_server/server.js','/C:/secret.js','/cert.json','/%ZZ']) assert.equal(security.resolvePublicFile(publicRoot,route),null,route);
  assert.equal(security.resolvePublicFile(publicRoot,'/interaction.js'),path.join(publicRoot,'interaction.js'));
});
test('pairing tokens reject malformed input without throwing',()=>{
  assert(security.validToken('a'.repeat(48),'a'.repeat(48)));
  for(const candidate of [null,'','b'.repeat(48),'é'.repeat(48)]) assert.equal(security.validToken(candidate,'a'.repeat(48)),false);
});
test('rendered button centers map to the same controls at different sizes',()=>{
  for(const width of [250,450,700]) {
    const p={x:40,y:30,width,height:250};
    for(const rects of [ui.dockButtons(p),ui.appTiles(p),ui.controls(p.x,p.y,width).buttons]) {
      rects.forEach((r,i)=>assert.equal(rects.findIndex(other=>ui.contains(other,r.x+r.width/2,r.y+r.height/2)),i));
    }
  }
});
test('library cards fit inside small windows and never overlap',()=>{
  for(const [width,height] of [[120,90],[210,150],[300,190],[500,300]]) {
    const p={x:17,y:21,width,height},tiles=ui.appTiles(p);
    for(const [i,r] of tiles.entries()) {
      assert(r.width>0 && r.height>0);
      assert(r.x>=p.x && r.y>=p.y && r.x+r.width<=p.x+width+.001 && r.y+r.height<=p.y+height+.001);
      for(const other of tiles.slice(i+1)) assert(r.x+r.width<=other.x || other.x+other.width<=r.x || r.y+r.height<=other.y || other.y+other.height<=r.y);
    }
  }
});
test('short click, hold-and-move, cancellation and organization are distinct',()=>{
  assert.equal(ui.gestureIntent(150,2,true,false),'click');
  assert.equal(ui.gestureIntent(300,18,false,false),'drag');
  assert.equal(ui.gestureIntent(100,18,false,false),'pending');
  assert.equal(ui.gestureIntent(900,1,true,false),'cancel');
  assert.equal(ui.gestureIntent(150,2,true,true),'cancel');
  assert.equal(ui.gestureIntent(100,18,false,true),'drag');
});
test('mobile starts, renders both window types, and opens settings',()=>{
  const app=mobileContext();
  app.run('renderSingleEye(ctxLeft,800,600,0); document.getElementById("settingsBtn").onclick();');
  assert(app.elements.get('settingsDialog').open);
});
test('topmost selection and real close button work for desktop',()=>{
  const app=mobileContext();
  app.run(`spatialWindows.forEach(w=>{w.worldYaw=0;w.worldPitch=0;});
    const win=spatialWindows[1];
    const p=projectToScreen(0,0,win.widthDeg,win.heightDeg,800,600,0);
    const close=MRInteraction.controls(p.x,p.y+p.height+8,p.width).buttons[2];
    activateAtPoint({x:close.x+17,y:close.y+18},win,800,600);`);
  assert.equal(app.run('spatialWindows.some(w=>w.id==="win_desktop")'),false);
  assert(app.storage.has('mr-layout-v1'));
});
test('drag grab offset and yaw wrap do not make the window jump',()=>{
  const app=mobileContext();
  app.run(`headYaw=179;headPitch=0;const win=spatialWindows[0];win.worldYaw=179;win.worldPitch=0;
    beginWindowDrag(win,{x:400,y:300},800,600);headYaw=-179;updateWindowDrag({x:400,y:300},800,600);`);
  assert(app.run('Math.abs(wrapAngle(spatialWindows[0].worldYaw-179))<2'));
});
test('loss of tracking cancels pending actions without activating them',()=>{
  const app=mobileContext();
  app.run('pendingGesture={point:{x:1,y:1},start:900};isPinchingActive=true;processHandInteractions();');
  assert.equal(app.run('pendingGesture'),null);
  assert.equal(app.run('isPinchingActive'),false);
});

test('minimizing hides the window and reopening preserves its position',()=>{
  const app=mobileContext();
  app.run(`const win=spatialWindows[1];const originalYaw=win.worldYaw;
    const p=projectToScreen(win.worldYaw,win.worldPitch,win.widthDeg,win.heightDeg,800,600,0);
    const button=MRInteraction.controls(p.x,p.y+p.height+8,p.width).buttons[0];
    activateAtPoint({x:button.x+17,y:button.y+18},win,800,600);`);
  assert.equal(app.run('win.minimized'),true);
  app.run('headYaw=100;toggleWindow("win_desktop");');
  assert.equal(app.run('win.minimized'),false);
  assert.equal(app.run('win.worldYaw === originalYaw'),true);
});

test('dashboard reconnect preserves full telemetry handler and secure port',()=>{
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{style:{},replaceChildren(){},getContext:()=>({})});return elements.get(id);};
  const sockets=[],timers=[];
  class Socket { constructor(url){this.url=url;sockets.push(this);} }
  const c=vm.createContext({console,WebSocket:Socket,document:{getElementById:element,createElement:element},
    window:{location:{protocol:'https:',host:'localhost:3443',hostname:'localhost'},addEventListener(){}},
    fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve({mobileUrl:'https://localhost:3443/mobile#token=test'})}),
    setTimeout:fn=>timers.push(fn)});
  const html=fs.readFileSync(path.join(root,'pc_server/public/index.html'),'utf8');
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],c);
  const original=sockets[0].onmessage;
  assert.equal(sockets[0].url,'wss://localhost:3443');
  sockets[0].onclose();timers.shift()();
  assert.equal(sockets[1].onmessage,original);
  sockets[1].onmessage({data:JSON.stringify({type:'gyro_telemetry',headYaw:12,headPitch:3,rawAlpha:0,rawBeta:0,rawGamma:0,handsCount:1,screensCount:2})});
  assert.equal(elements.get('gyroYawVal').textContent,'12°');
});

test('mobile HTTPS pairing uses page port and sends readiness on every connection',()=>{
  const app=mobileContext(),sockets=[];
  app.context.WebSocket=class {constructor(url){this.url=url;sockets.push(this);} send(data){this.sent=JSON.parse(data);} };
  app.run('sessionStorage.setItem("pairingToken","test");connectPCWebSocket();');
  assert.equal(sockets[0].url,'wss://localhost:3443?token=test');
  sockets[0].onopen();assert.equal(sockets[0].sent.type,'headset_ready');
  app.run('connectPCWebSocket();');sockets[1].onopen();assert.equal(sockets[1].sent.type,'headset_ready');
});

test('button activates on pinch closure once, requiring release before next click',()=>{
  const app=mobileContext();
  app.run(`let clicks=0;
    const points=Array.from({length:21},()=>({x:.5,y:.5,z:0}));
    points[0]={x:.5,y:.8,z:0};points[9]={x:.5,y:.5,z:0};
    handTracks=[{id:1,points,raw:points,label:'Left'}];
    actionAtPoint=()=>({rect:{x:0,y:0,width:1000,height:1000},activate:()=>clicks++});
    processHandInteractions();processHandInteractions();processHandInteractions();`);
  assert.equal(app.run('clicks'),1);
  app.run('points[4]={x:.9,y:.5,z:0};processHandInteractions();');
  assert.equal(app.run('clicks'),1);
  app.context.performance.now=()=>1800;
  app.run('points[4]={x:.5,y:.5,z:0};processHandInteractions();');
  assert.equal(app.run('clicks'),2);
});

test('local library actions work without a PC and disconnected commands show feedback',()=>{
  const app=mobileContext();
  app.run('handleAppTileAction("toggle_stats");');
  assert.equal(app.run('preferences.debug'),true);
  app.run('handleAppTileAction("camera");');
  assert.equal(app.run('showHandOverlay'),false);
  app.run('handleAppTileAction("settings");');
  assert.equal(app.elements.get('settingsDialog').open,true);
  app.run('sendPCAction("launch_calc");');
  assert.match(app.run('feedback.text'),/PC desconectado/);
});

test('palm menu recognizes unmirrored left/right palms and rejects their backs',()=>{
  const app=mobileContext();
  for(const [label,sign] of [['Left',1],['Right',-1]]) {
    app.context.hand=Array.from({length:21},()=>({x:.5,y:.8,z:0}));
    app.context.hand[5]={x:.5-sign*.15,y:.5,z:0};
    app.context.hand[17]={x:.5+sign*.15,y:.5,z:0};
    app.context.handedness={label,score:.65};
    assert.equal(app.run('isPalmFacingCamera(hand,handedness)'),true);
    [app.context.hand[5],app.context.hand[17]]=[app.context.hand[17],app.context.hand[5]];
    assert.equal(app.run('isPalmFacingCamera(hand,handedness)'),false);
  }
});

test('palm dock stays inside view and is hidden after tracking loss',()=>{
  const app=mobileContext();
  app.run('headYaw=120;headPitch=60;palmMenuVisible=true;updatePalmMenu({});');
  assert.equal(app.run('palmMenuVisible'),false);
  const rect=app.run('palmMenuProjection(400,300)');
  assert(rect.x>=0 && rect.y>=0 && rect.x+rect.width<=400 && rect.y+rect.height<=300);
});
