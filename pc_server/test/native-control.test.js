const test=require('node:test'),assert=require('node:assert/strict');
const {NativeControl,validateCommand}=require('../native-control');
const id='01234567-0123-4123-8123-012345678901',other='11234567-0123-4123-8123-012345678901';
test('VR calibration validates camera modes and routes per-eye alignment without losing values',()=>{
  const hub=new NativeControl(()=>1000);
  for(const [action,value] of [['stereo_balance',-120],['camera_contrast',130],['camera_focus',1],['vr_calibration',1],['vr_eye',2]]){
    hub.sync({id,state:{screen:'ar',active:true,ready:true}});
    const sent=hub.command(id,{action,value});
    const delivered=hub.sync({id,state:{screen:'ar',active:true,ready:true}}).commands[0];
    assert.equal(delivered.action,action);assert.equal(delivered.value,value);
    hub.sync({id,state:{screen:'ar',active:true,ready:true},acks:[{id:sent.id,ok:true}]});
  }
  for(const [action,value] of [['camera_focus',.5],['vr_eye',3],['vr_calibration',-1],['stereo_balance',121],['camera_contrast',79],['camera_contrast','100'],['stereo_balance',NaN]])assert.throws(()=>validateCommand({action,value}));
  hub.sync({id,state:{stereoConvergencePx:390,stereoVerticalPx:150,stereoBalancePx:-80,cameraContrast:115,cameraFocus:1,vrEye:2,vrCalibration:1,vrControlsVersion:2,cameraResolution:'1920 × 1080'}});
  const s=hub.status()[0].state;assert.equal(s.stereoConvergencePx,390);assert.equal(s.stereoVerticalPx,150);assert.equal(s.stereoBalancePx,-80);assert.equal(s.cameraContrast,115);assert.equal(s.cameraFocus,1);assert.equal(s.vrEye,2);assert.equal(s.vrCalibration,1);assert.equal(s.vrControlsVersion,2);assert.equal(s.cameraResolution,'1920 × 1080');
  hub.sync({id,state:{}});const legacy=hub.status()[0].state;assert.equal(legacy.vrControlsVersion,0);assert.equal(legacy.cameraContrast,100);assert.equal(legacy.stereoBalancePx,0);
});
test('native editor validates commands, ranges and active screen',()=>{
  for(const c of [{action:'shell'},{action:'marker_size',value:'140'},{action:'marker_size',value:NaN},{action:'marker_size',value:29},{action:'marker_id',value:300}])assert.throws(()=>validateCommand(c));
  assert.deepEqual(validateCommand({action:'marker_size',value:140}),{action:'marker_size',value:140});
  assert.deepEqual(validateCommand({action:'select_panel',panelId:'p12'}),{action:'select_panel',panelId:'p12'});
  assert.deepEqual(validateCommand({action:'hands',value:1}),{action:'hands',value:1});
  assert.deepEqual(validateCommand({action:'stereo',value:0}),{action:'stereo',value:0});
  assert.deepEqual(validateCommand({action:'stereo_ipd',value:64}),{action:'stereo_ipd',value:64});
  assert.deepEqual(validateCommand({action:'stereo_convergence',value:-400}),{action:'stereo_convergence',value:-400});
  assert.deepEqual(validateCommand({action:'stereo_convergence',value:400}),{action:'stereo_convergence',value:400});
  assert.deepEqual(validateCommand({action:'stereo_convergence',value:-12}),{action:'stereo_convergence',value:-12});
  assert.deepEqual(validateCommand({action:'stereo_vertical',value:8}),{action:'stereo_vertical',value:8});
  assert.deepEqual(validateCommand({action:'camera_sharpness',value:35}),{action:'camera_sharpness',value:35});
  assert.deepEqual(validateCommand({action:'stereo_reset'}),{action:'stereo_reset'});
  for(const c of [{action:'stereo_ipd',value:73},{action:'stereo_convergence',value:401},{action:'stereo_vertical',value:-161},{action:'camera_sharpness',value:71}])assert.throws(()=>validateCommand(c));
  assert.deepEqual(validateCommand({action:'mapping',value:1}),{action:'mapping',value:1});
  assert.throws(()=>validateCommand({action:'mapping',value:true}));
  assert.throws(()=>validateCommand({action:'hands',value:true}));
  assert.throws(()=>validateCommand({action:'select_panel',panelId:'p1;remove'}));
  const hub=new NativeControl();assert.throws(()=>hub.command(id,{action:'place'}));hub.sync({id,state:{screen:'home',active:true,ready:true}});assert.throws(()=>hub.command(id,{action:'place'}));assert.ok(hub.command(id,{action:'open_ar'}).id);
});
test('native status bounds frame and anchor telemetry from the phone',()=>{
  const hub=new NativeControl(()=>1000);hub.sync({id,state:{screen:'ar',active:true,ready:true,handsEnabled:true,handControl:'Pinça sobre Painel 1',dragging:true,dragPoseReady:false,stereo:true,fps:73.4,tracking:true,trackingFailure:'NONE',panels:2,panelList:[{id:'p1',name:'Esquerda',size:.8,tracked:true},{id:'p2',name:'Direita',size:1.2,tracked:false}],selectedPanel:'p1',trackedAnchors:1,markerVisible:true,testTelemetryVersion:3}});
  const state=hub.status()[0].state;assert.equal(state.handsEnabled,true);assert.equal(state.handControl,'Pinça sobre Painel 1');assert.equal(state.dragging,true);assert.equal(state.dragPoseReady,false);assert.equal(state.stereo,true);assert.equal(state.fps,73.4);assert.equal(state.tracking,true);assert.equal(state.trackingFailure,'NONE');assert.equal(state.panels,2);assert.deepEqual(state.panelList,[{id:'p1',name:'Esquerda',size:.8,tracked:true},{id:'p2',name:'Direita',size:1.2,tracked:false}]);assert.equal(state.selectedPanel,'p1');assert.equal(state.trackedAnchors,1);assert.equal(state.markerVisible,true);assert.equal(state.telemetryVersion,3);
  hub.sync({id,state:{fps:999,panels:900,trackedAnchors:-2,tracking:'yes',trackingFailure:'x'.repeat(300)}});
  const bounded=hub.status()[0].state;assert.equal(bounded.fps,120);assert.equal(bounded.panels,24);assert.equal(bounded.trackedAnchors,0);assert.equal(bounded.tracking,false);assert.equal(bounded.trackingFailure.length,80);assert.equal(bounded.markerVisible,false);assert.equal(bounded.handControl,'');assert.equal(bounded.dragging,false);assert.equal(bounded.dragPoseReady,false);assert.equal(bounded.telemetryVersion,0);
});
test('native panel selection command is routed to the chosen panel and panel IDs are unique',()=>{
  let now=1000;const hub=new NativeControl(()=>now);hub.sync({id,state:{screen:'ar',active:true,ready:true,panelList:[{id:'p1',name:'Um'},{id:'p1',name:'Duplicado'},{id:'p2',name:'Dois'}],selectedPanel:'p1'}});
  assert.deepEqual(hub.status()[0].state.panelList.map(p=>p.id),['p1','p2']);
  assert.deepEqual(validateCommand({action:'select_panel',panelId:'p2'}),{action:'select_panel',panelId:'p2'});
  const command=hub.command(id,{action:'select_panel',panelId:'p2'});assert.equal(hub.sync({id,state:{screen:'ar',active:true,ready:true}}).commands[0].panelId,'p2');
  assert.equal(hub.sync({id,state:{screen:'ar',active:true,ready:true},acks:[{id:command.id,ok:true}]}).commands.length,0);
  hub.sync({id,state:{screen:'ar',active:true,ready:true,panelList:[]}});assert.equal(hub.status()[0].state.selectedPanel,'');
});
test('native hands and stereo calibration controls are routed and state comes from the phone',()=>{
  const hub=new NativeControl(()=>1000);hub.sync({id,state:{screen:'ar',active:true,ready:true}});
  const hands=hub.command(id,{action:'hands',value:1});assert.equal(hub.sync({id,state:{screen:'ar',active:true,ready:true}}).commands[0].action,'hands');
  hub.sync({id,state:{screen:'ar',active:true,ready:true},acks:[{id:hands.id,ok:true}]});const stereo=hub.command(id,{action:'stereo',value:1});
  assert.equal(hub.sync({id,state:{screen:'ar',active:true,ready:true}}).commands[0].action,'stereo');
  hub.sync({id,state:{screen:'ar',active:true,ready:true},acks:[{id:stereo.id,ok:true}]});
  assert.deepEqual(validateCommand({action:'stereo',value:1}),{action:'stereo',value:1});
  hub.sync({id,state:{screen:'ar',active:true,ready:true,handsEnabled:true,stereo:true}});
  assert.equal(hub.status()[0].state.handsEnabled,true);assert.equal(hub.status()[0].state.stereo,true);
  for(const [action,value] of [['stereo_ipd',42],['stereo_convergence',14],['stereo_vertical',-6],['camera_sharpness',38]]){const c=hub.command(id,{action,value});assert.equal(hub.sync({id,state:{screen:'ar',active:true,ready:true}}).commands[0].action,action);hub.sync({id,state:{screen:'ar',active:true,ready:true},acks:[{id:c.id,ok:true}]});}
  hub.sync({id,state:{screen:'ar',active:true,ready:true,stereo:true,stereoIpdMm:42,stereoConvergencePx:14,stereoVerticalPx:-6,testTelemetryVersion:4}});const calibrated=hub.status()[0].state;assert.equal(calibrated.stereoIpdMm,42);assert.equal(calibrated.stereoConvergencePx,14);assert.equal(calibrated.stereoVerticalPx,-6);assert.equal(calibrated.telemetryVersion,4);
  const reset=hub.command(id,{action:'stereo_reset'});assert.equal(hub.sync({id,state:{screen:'ar',active:true,ready:true}}).commands[0].action,'stereo_reset');assert.ok(reset.id);
});
test('guided mapping command is validated, routed and reports saved surface and depth state',()=>{
  const hub=new NativeControl(()=>1000),id='123e4567-e89b-42d3-a456-426614174000';
  hub.sync({id,state:{screen:'ar',active:true,ready:true,mapping:false,mappedSurfaces:4,depthCoverage:.72}});
  const command=hub.command(id,{action:'mapping',value:1});
  assert.equal(hub.sync({id,state:{screen:'ar',active:true,ready:true,mapping:false}}).commands[0].action,'mapping');
  hub.sync({id,state:{screen:'ar',active:true,ready:true,mapping:true,mappedSurfaces:5,depthCoverage:.8},acks:[{id:command.id,ok:true}]});
  const state=hub.status()[0].state;assert.equal(state.mapping,true);assert.equal(state.mappedSurfaces,5);assert.equal(state.depthCoverage,.8);
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

test('close AR recovers a failed renderer and supersedes pending GL work',()=>{
  let now=1000;const hub=new NativeControl(()=>now),running={screen:'ar',active:true,ready:true};
  hub.sync({id,state:running});const editing=hub.command(id,{action:'larger'});
  const failed={...running,ready:false,status:'Falha na sessão AR',tracking:false};
  hub.sync({id,state:failed});assert.throws(()=>hub.command(id,{action:'place'}));
  const closing=hub.command(id,{action:'close_ar'});
  assert.notEqual(closing.id,editing.id);
  const delivery=hub.sync({id,state:failed}).commands;
  assert.deepEqual(delivery.map(c=>[c.id,c.action,c.ttl]),[[closing.id,'close_ar',5000]]);
  assert.equal(hub.devices.get(id).commands.find(c=>c.id===editing.id).status,'rejected');
  assert.equal(hub.command(id,{action:'close_ar'}).id,closing.id);
  assert.throws(()=>hub.command(id,{action:'remove'}));
  hub.sync({id,state:{screen:'home',active:true,ready:true},acks:[{id:closing.id,ok:true,message:'Saindo do AR.'}]});
  assert.equal(hub.status()[0].lastCommand.status,'received');
  assert.throws(()=>hub.command(id,{action:'close_ar'}));
  assert.equal(hub.sync({id,state:running}).commands.length,0);
});

test('emergency close still requires an online foreground AR screen and expires without replay',()=>{
  let now=1000;const hub=new NativeControl(()=>now),failed={screen:'ar',active:true,ready:false};
  hub.sync({id,state:{...failed,active:false}});assert.throws(()=>hub.command(id,{action:'close_ar'}));
  hub.sync({id,state:failed});now+=3001;assert.throws(()=>hub.command(id,{action:'close_ar'}));
  hub.sync({id,state:failed});hub.command(id,{action:'close_ar'});now+=5001;
  assert.equal(hub.sync({id,state:failed}).commands.length,0);
  assert.equal(hub.status()[0].lastCommand.status,'expired');
});
