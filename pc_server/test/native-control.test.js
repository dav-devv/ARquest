const test=require('node:test'),assert=require('node:assert/strict');
const {NativeControl,validateCommand}=require('../native-control');
const id='01234567-0123-4123-8123-012345678901',other='11234567-0123-4123-8123-012345678901';
test('native editor validates commands, ranges and active screen',()=>{
  for(const c of [{action:'shell'},{action:'marker_size',value:'140'},{action:'marker_size',value:NaN},{action:'marker_size',value:29},{action:'marker_id',value:300}])assert.throws(()=>validateCommand(c));
  assert.deepEqual(validateCommand({action:'marker_size',value:140}),{action:'marker_size',value:140});
  const hub=new NativeControl();assert.throws(()=>hub.command(id,{action:'place'}));hub.sync({id,state:{screen:'home',active:true,ready:true}});assert.throws(()=>hub.command(id,{action:'place'}));assert.ok(hub.command(id,{action:'open_ar'}).id);
});
test('native status bounds frame and anchor telemetry from the phone',()=>{
  const hub=new NativeControl(()=>1000);hub.sync({id,state:{screen:'ar',active:true,ready:true,fps:73.4,tracking:true,trackingFailure:'NONE',panels:2,trackedAnchors:1,markerVisible:true,testTelemetryVersion:1}});
  const state=hub.status()[0].state;assert.equal(state.fps,73.4);assert.equal(state.tracking,true);assert.equal(state.trackingFailure,'NONE');assert.equal(state.panels,2);assert.equal(state.trackedAnchors,1);assert.equal(state.markerVisible,true);assert.equal(state.telemetryVersion,1);
  hub.sync({id,state:{fps:999,panels:900,trackedAnchors:-2,tracking:'yes',trackingFailure:'x'.repeat(300)}});
  const bounded=hub.status()[0].state;assert.equal(bounded.fps,120);assert.equal(bounded.panels,24);assert.equal(bounded.trackedAnchors,0);assert.equal(bounded.tracking,false);assert.equal(bounded.trackingFailure.length,80);assert.equal(bounded.markerVisible,false);assert.equal(bounded.telemetryVersion,0);
});
test('native command retries use the same id, target only one phone and stop after acknowledgement',()=>{
  let now=1000;const hub=new NativeControl(()=>now),state={screen:'ar',active:true,ready:true};hub.sync({id,state});hub.sync({id:other,state});const c=hub.command(id,{action:'place'});
  assert.throws(()=>hub.command(id,{action:'remove'}));assert.equal(hub.sync({id:other,state}).commands.length,0);assert.equal(hub.sync({id,state}).commands[0].id,c.id);assert.equal(hub.sync({id,state}).commands[0].id,c.id);
  hub.sync({id:other,state,acks:[{id:c.id,ok:true}]});assert.equal(hub.sync({id,state}).commands.length,1);
  assert.equal(hub.sync({id,state,acks:[{id:c.id,ok:true,message:'Solicitado'}]}).commands.length,0);assert.equal(hub.status()[0].lastCommand.status,'received');
  now=5001;assert.equal(hub.status()[0].online,false);assert.throws(()=>hub.command(id,{action:'place'}));
});
test('native commands expire without replay after disconnect and background edits are rejected',()=>{
  let now=0;const hub=new NativeControl(()=>now),state={screen:'ar',active:true,ready:true};hub.sync({id,state});hub.command(id,{action:'remove'});now=5001;assert.equal(hub.sync({id,state}).commands.length,0);assert.equal(hub.status()[0].lastCommand.status,'expired');hub.sync({id,state:{...state,active:false}});assert.throws(()=>hub.command(id,{action:'place'}));
});
