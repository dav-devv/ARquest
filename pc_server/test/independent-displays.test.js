const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {validateCount,command}=require('../virtual-displays');
test('virtual display count rejects coercion, shell input, fractions and excess',()=>{
  for(const count of [-1,0,9,1.5,'2','2;whoami',null,Infinity])assert.throws(()=>validateCount(count));
  assert.equal(validateCount(2),2);
});
test('driver command uses bounded native pipe communication and UTF16, not shell interpolation',async()=>{
  let sent,pipeName;
  const socket=new EventEmitter();socket.setTimeout=()=>{};socket.destroy=()=>{};
  socket.write=buffer=>{sent=buffer.toString('utf16le');socket.emit('data',Buffer.from('PONG\0','utf16le'));socket.emit('end');};
  const response=command('PING',name=>{pipeName=name;queueMicrotask(()=>socket.emit('connect'));return socket;});
  assert.equal(await response,'PONG');assert.equal(sent,'PING\0');assert.equal(pipeName,'\\\\.\\pipe\\MTTVirtualDisplayPipe');
});
test('driver ASCII reply followed by EPIPE is decoded after the acknowledgement',async()=>{
  const socket=new EventEmitter();socket.setTimeout=()=>{};socket.destroy=()=>{};
  socket.write=()=>{socket.emit('data',Buffer.from('PONG'));socket.emit('error',Object.assign(Error('closed'),{code:'EPIPE'}));};
  assert.equal(await command('PING',()=>{queueMicrotask(()=>socket.emit('connect'));return socket;}),'PONG');
});
test('each desktop source uploads a different texture and releases stale resources',()=>{
  const {ARWorkspace}=require('../../web_mobile_test/spatial-ar');const sources={a:{videoWidth:1280,videoHeight:720},b:{videoWidth:960,videoHeight:600}},uploads=[];
  const w=new ARWorkspace({bridge:{source:id=>sources[id],frameKey:()=>1},onState(){},onMessage(){}});w.desktop={};
  w.renderer={upload:(key,source)=>uploads.push({key,source})};
  w.updateDesktop('a');w.updateDesktop('b');w.updateDesktop('a');assert.equal(uploads.length,2);assert.notEqual(uploads[0].key,uploads[1].key);
  assert.equal(w.desktopSources.get('a').source,sources.a);delete sources.a;w.updateDesktop('a');assert(!w.desktopSources.has('a'));assert(w.desktopSources.has('b'));
});
test('AR receiver isolates streams, rejects unknown IDs and disposes a stopped source only',async()=>{
  const createVideo=()=>({srcObject:null,readyState:2,paused:false,currentTime:1,play:async()=>{}});
  const peers=[];class Peer{constructor(){this.connectionState='connected';peers.push(this);}close(){this.closed=true;}async setRemoteDescription(s){this.remoteDescription=s;}async createAnswer(){return {type:'answer'};}async setLocalDescription(s){this.localDescription=s;}async addIceCandidate(){}}
  const context=vm.createContext({console,Image:class{},RTCPeerConnection:Peer,document:{createElement:createVideo},setInterval(){},clearInterval(){},clearTimeout(){},MediaStream:class{}});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../web_mobile_test/ar-bridge.js'),'utf8'),context);
  const sent=[],b=new context.ARPCBridge(createVideo(),()=>{},()=>{});b.ws={readyState:1,send:s=>sent.push(JSON.parse(s)),close(){}};
  const receive=data=>b.receive({data:JSON.stringify(data)});
  await receive({type:'stream_status',sources:[{id:'screen-a',label:'A'},{id:'screen-b',label:'B'}]});
  for(const id of ['screen-a','screen-b'])await receive({type:'webrtc_offer',streamId:id,sessionId:id,sdp:{type:'offer'}});
  assert.equal(b.channels.size,2);assert.equal(peers.length,2);assert.deepEqual(sent.map(s=>s.streamId),['screen-a','screen-b']);
  await receive({type:'webrtc_offer',streamId:'screen-unknown',sdp:{}});assert.equal(peers.length,2);
  await receive({type:'screen_stream_ended',streamId:'screen-a'});assert(peers[0].closed);assert(!peers[1].closed);assert.equal(b.channels.size,1);
  b.stop();assert(peers[1].closed);
});
