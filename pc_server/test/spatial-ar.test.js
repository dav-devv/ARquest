const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../../web_mobile_test/spatial-math');
const {ARWorkspace,QuadRenderer,checkSupport,sbsViewports}=require('../../web_mobile_test/spatial-ar');
const translate=(x,y,z)=>{const m=M.identity();m[12]=x;m[13]=y;m[14]=z;return m;};
const close=(a,b)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>assert(Math.abs(x-b[i])<1e-5,`${i}: ${x} != ${b[i]}`));};
function fixture() {
  const messages=[],states=[],draws=[];
  const workspace=new ARWorkspace({xr:{},canvas:{},overlay:{},bridge:{source:()=>null,action:()=>{}},onState:s=>states.push(s),onMessage:m=>messages.push(m)});
  const session={visibilityState:'visible',renderState:{baseLayer:{getViewport:()=>({x:0,y:0,width:800,height:600})}},requestAnimationFrame(){},end:async()=>{workspace.cleanup(session);}};
  const renderer={gl:{viewport(){}},begin(){draws.push('clear');},draw(key){draws.push(key);},dispose(){draws.push('disposed');}};
  workspace.session=session;workspace.renderer=renderer;workspace.space={};workspace.hitSource={cancel(){}};
  const view={projectionMatrix:M.identity(),transform:{matrix:M.identity(),inverse:{matrix:M.identity()}}};
  const viewer={transform:{matrix:M.identity()},views:[view],emulatedPosition:false};
  const hitMatrix=translate(0,0,-2),hitPose={transform:{matrix:hitMatrix}};
  const frame={session,getViewerPose:()=>viewer,getHitTestResults:()=>[],trackedAnchors:new Set(),getPose:()=>hitPose};
  return {workspace,session,renderer,frame,viewer,hitPose,hitMatrix,messages,states,draws};
}

test('multiple monitors retain independent anchors and removing one does not remove the others',async()=>{
  const f=fixture();let deleted=0;
  for(let i=0;i<8;i++){
    const anchor={anchorSpace:{},delete(){deleted++;}};
    f.workspace.place(f.frame,{createAnchor:async()=>anchor},f.hitPose,f.viewer,'desktop');
    await new Promise(r=>setImmediate(r));
  }
  assert.equal(f.workspace.panels.size,8);assert.equal(deleted,0);
  const ids=[...f.workspace.panels.keys()];assert.equal(new Set(ids).size,8);
  f.workspace.remove(ids[3]);assert.equal(f.workspace.panels.size,7);assert.equal(deleted,1);
  f.workspace.cleanup(f.session);assert.equal(deleted,8);
});

test('two pinches resize one panel proportionally, suppress clicks and stop on tracking loss',()=>{
  const f=fixture(),w=f.workspace,model=translate(0,0,-1);
  let commands=0;w.bridge.action=()=>commands++;
  const panel={id:'desktop:1',type:'desktop',model,tracked:true,width:1,height:.625};w.panels.set(panel.id,panel);
  const hands=(span,time,closed=true)=>[-1,1].map((sign,i)=>({identity:i?'Right':'Left',closed,time,ray:{origin:[sign*span/2,0,0],direction:[0,0,-1]}}));
  w.handPair=hands(.4,100);w.updateInputs(100,f.viewer);assert(w.resizeGesture);
  w.handPair=hands(.8,200);w.updateInputs(200,f.viewer);assert.equal(panel.width,2);assert.equal(panel.height,1.25);
  w.handPair=hands(.2,300);w.updateInputs(300,f.viewer);assert.equal(panel.width,.5);assert.equal(panel.height,.3125);
  w.updateInputs(1000,f.viewer);assert.equal(w.resizeGesture,null);assert.equal(panel.width,.5);assert.equal(commands,0);
  w.handPair=hands(.2,1100,false);w.updateInputs(1100,f.viewer);assert.equal(w.resizeGesture,null);
});

test('two hands pointing to different panels do not resize either panel',()=>{
  const f=fixture(),w=f.workspace;
  for(const [id,x] of [['a',-.5],['b',.5]])w.panels.set(id,{id,type:'desktop',model:translate(x,0,-1),tracked:true,width:.4,height:.25});
  w.handPair=[-.5,.5].map(x=>({closed:true,time:100,ray:{origin:[x,0,0],direction:[0,0,-1]}}));
  w.updateInputs(100,f.viewer);assert.equal(w.resizeGesture,null);
});

test('all visible monitors share one video update, including after the original is removed',()=>{
  const f=fixture();let updates=0;f.workspace.updateDesktop=()=>updates++;
  for(let i=1;i<=3;i++){const anchor={};f.frame.trackedAnchors.add(anchor);f.workspace.panels.set('desktop:'+i,{type:'desktop',anchor,relative:M.identity(),width:1,height:.6,goodFrames:1});}
  f.workspace.frame(100,f.frame);assert.equal(updates,1);assert.equal(f.draws.filter(x=>x==='desktop').length,3);
});

test('two lens viewports preserve camera aspect and occupy separate screen halves',()=>{
  const views=sbsViewports({x:10,y:20,width:1600,height:900});
  assert.deepEqual(views,[{x:10,y:245,width:800,height:450},{x:810,y:245,width:800,height:450}]);
});

test('two lens mode requires camera but accepts portrait-locked sessions, preserves anchors',()=>{
  const f=fixture();f.workspace.canvas={clientWidth:1600,clientHeight:900};
  f.workspace.toggleSBS();assert.equal(f.workspace.state.sbs,false);
  f.workspace.stateChanged({cameraReady:true});f.workspace.canvas.clientWidth=600;
  f.workspace.toggleSBS();assert.equal(f.workspace.state.sbs,true);
  f.workspace.toggleSBS();assert.equal(f.workspace.state.sbs,false);
  f.workspace.canvas.clientWidth=1600;const anchors=f.workspace.panels;
  f.workspace.toggleSBS();assert.equal(f.workspace.state.sbs,true);
  assert.equal(f.workspace.session,f.session);assert.equal(f.workspace.panels,anchors);
  f.workspace.stateChanged({cameraReady:false});f.workspace.toggleSBS();assert.equal(f.workspace.state.sbs,false);
});

test('two lens rendering reuses one camera image and anchor pose for both eyes',()=>{
  const f=fixture(),viewports=[],backgrounds=[];let requests=0;
  Object.assign(f.renderer.gl,{clearColor(){},clear(){},disable(){},enable(){},viewport(...args){viewports.push(args);}});
  f.renderer.cameraBackground=texture=>backgrounds.push(texture);
  const texture={};f.viewer.views[0].camera={};
  f.workspace.cameraBinding={getCameraImage(){requests++;return texture;}};
  f.workspace.state.sbs=true;
  const anchor={};f.frame.trackedAnchors.add(anchor);
  f.workspace.panels.set('library',{type:'library',anchor,relative:M.identity(),width:1,height:.6,goodFrames:1});
  f.workspace.frame(100,f.frame);
  assert.equal(requests,1);assert.deepEqual(backgrounds,[texture,texture]);
  assert.equal(f.draws.filter(x=>x==='library').length,2);
  assert.deepEqual(viewports,[[0,150,400,300],[400,150,400,300]]);
});

test('camera loss in two lens mode blocks interaction and never draws a stale background',()=>{
  const f=fixture();Object.assign(f.renderer.gl,{clearColor(){},clear(){}});
  f.workspace.state.sbs=true;f.workspace.cameraBinding={getCameraImage:()=>null};
  f.workspace.frame(100,f.frame);
  assert.equal(f.workspace.canPlace,false);assert.equal(f.workspace.state.cameraReady,false);
  assert.deepEqual(f.draws,['clear']);
});

test('a stable marker creates a native anchor at its metric world position',async()=>{
  const f=fixture();let position,disposed=false;
  const previous=global.XRRigidTransform;
  global.XRRigidTransform=class{constructor(p){this.position=p;}};
  try{
    f.workspace.markerTracker={dispose(){disposed=true;}};f.workspace.markerDeadline=1000;
    f.workspace.markerPending={matrix:translate(.4,.8,-1),type:'library',time:100};
    const anchor={anchorSpace:{},delete(){}};
    f.frame.createAnchor=(transform,space)=>{position=transform.position;assert.equal(space,f.workspace.space);return Promise.resolve(anchor);};
    f.workspace.frame(200,f.frame);await new Promise(r=>setImmediate(r));
    assert.deepEqual(position,{x:Math.fround(.4),y:Math.fround(.8),z:-1});
    assert(disposed);assert.equal(f.workspace.panels.get('library').anchor,anchor);
  }finally{global.XRRigidTransform=previous;}
});

test('expired marker observations do not replace an existing anchor',()=>{
  const f=fixture();let calls=0;f.workspace.markerTracker={dispose(){}};f.workspace.markerDeadline=5000;
  f.workspace.markerPending={matrix:M.identity(),type:'library',time:0};f.frame.createAnchor=()=>calls++;
  f.workspace.frame(2000,f.frame);assert.equal(calls,0);assert.equal(f.workspace.markerPending,null);
});

test('spatial transforms preserve anchor-relative pose after translation and rotation',()=>{
  const anchor=M.panelPose(translate(2,0,-3),translate(0,1,0));
  close(M.multiply(anchor,M.inverseRigid(anchor)),M.identity());
  const panel=M.panelPose(anchor,translate(0,1,0));
  const offset=M.multiply(M.inverseRigid(anchor),panel);
  close(M.multiply(anchor,offset),panel);
  const moved=M.multiply(translate(1,0,0),anchor);
  assert(Math.abs(M.multiply(moved,offset)[12]-panel[12]-1)<1e-5);
});

test('ray picks the correct panel point, ignores its back and misses outside edges',()=>{
  const panel=translate(0,0,-2);
  const ray=M.rayFromPose(M.identity());
  assert.deepEqual(M.intersectPanel(ray,panel,1,1),{distance:2,u:.5,v:.5});
  assert.equal(M.intersectPanel({origin:[0,0,-3],direction:[0,0,1]},panel,1,1),null);
  assert.equal(M.intersectPanel({origin:[2,0,0],direction:[0,0,-1]},panel,1,1),null);
});

test('unsupported devices and insecure pages never report AR support',async()=>{
  assert.equal((await checkSupport(null,true)).supported,false);
  assert.equal((await checkSupport({isSessionSupported:async()=>true},false)).supported,false);
  assert.equal((await checkSupport({isSessionSupported:async()=>false},true)).supported,false);
  assert.equal((await checkSupport({isSessionSupported:async()=>true},true)).supported,true);
});

test('anchor feature rejection fails explicitly without a gyro-only retry',async()=>{
  const f=fixture();f.workspace.session=null;f.workspace.renderer=null;
  const calls=[];
  f.workspace.xr={requestSession:async(mode,options)=>{calls.push({mode,options});const e=new Error();e.name='NotSupportedError';throw e;}};
  await f.workspace.start();
  assert.equal(calls.length,1);assert(calls[0].options.requiredFeatures.includes('anchors'));
  assert.equal(f.workspace.session,null);assert.match(f.messages[0],/não oferece AR/);
});

test('placing uses a native anchor and follows its updated pose',async()=>{
  const f=fixture();let deleted=0;
  const anchor={anchorSpace:{},delete(){deleted++;}};
  f.workspace.place(f.frame,{createAnchor:()=>Promise.resolve(anchor)},f.hitPose,f.viewer,'library');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.workspace.panels.get('library').anchor,anchor);
  f.frame.trackedAnchors.add(anchor);
  const next=translate(1,0,-2);f.frame.getPose=()=>({transform:{matrix:next}});
  f.workspace.frame(100,f.frame);
  assert.equal(f.workspace.panels.get('library').tracked,false);
  f.workspace.frame(117,f.frame);
  const panel=f.workspace.panels.get('library');assert(panel.tracked);assert(Math.abs(panel.model[12]-1)<1e-5);
  assert(f.draws.includes('library'));
  f.workspace.cleanup(f.session);assert.equal(deleted,1);assert.equal(f.workspace.panels.size,0);
});

test('tracking loss clears the frame and cancels placement; no stale window is drawn',()=>{
  const f=fixture();f.workspace.pending='library';f.workspace.canPlace=true;
  f.workspace.panels.set('library',{tracked:true});f.frame.getViewerPose=()=>null;
  f.workspace.frame(100,f.frame);
  assert.equal(f.workspace.pending,null);assert.equal(f.workspace.canPlace,false);
  assert.equal(f.workspace.panels.get('library').tracked,false);assert.deepEqual(f.draws,['clear']);
});

test('emulated positions cannot be used for mapping',()=>{
  const f=fixture();f.viewer.emulatedPosition=true;f.workspace.frame(100,f.frame);
  assert.equal(f.workspace.state.canPlace,false);assert.equal(f.workspace.state.tracked,0);
});

test('an anchor created after session end is deleted instead of resurrecting a window',async()=>{
  const f=fixture();let resolve,deleted=0;
  f.workspace.place(f.frame,{createAnchor:()=>new Promise(r=>resolve=r)},f.hitPose,f.viewer,'desktop');
  f.workspace.cleanup(f.session);
  resolve({anchorSpace:{},delete(){deleted++;}});
  await new Promise(r=>setImmediate(r));
  assert.equal(deleted,1);assert.equal(f.workspace.panels.size,0);
});

test('lost anchors are hidden even when viewer tracking continues',()=>{
  const f=fixture();f.workspace.panels.set('library',{anchor:{},tracked:true,model:M.identity()});
  f.workspace.frame(100,f.frame);
  assert.equal(f.workspace.panels.get('library').tracked,false);assert(!f.draws.includes('library'));
});

test('identical status does not rewrite the DOM every XR frame',()=>{
  const f=fixture();f.workspace.stateChanged({tracking:'ok'});f.workspace.stateChanged({tracking:'ok'});
  assert.equal(f.states.length,1);
});

test('desktop uses direct video uploads only on decoded frame changes',()=>{
  const f=fixture();let serial=1;
  const video={videoWidth:1280,videoHeight:720};const uploads=[];
  f.workspace.desktop={};f.workspace.bridge={source:()=>video,frameKey:()=>serial};
  f.workspace.renderer.upload=(key,source)=>uploads.push({key,source});
  f.workspace.updateDesktop();f.workspace.updateDesktop();
  assert.equal(uploads.length,1);assert.equal(uploads[0].source,video);
  serial++;f.workspace.updateDesktop();assert.equal(uploads.length,2);
  f.workspace.bridge.source=()=>null;f.workspace.updateDesktop();assert.equal(f.workspace.desktopContent,null);
});

test('no monitor means no desktop texture updates',()=>{
  const f=fixture();let updates=0;f.workspace.updateDesktop=()=>updates++;
  f.workspace.frame(100,f.frame);f.workspace.frame(200,f.frame);assert.equal(updates,0);
});

test('texture storage is reused unless source resolution changes',()=>{
  let allocations=0,updates=0;
  const gl={createTexture:()=>({}),bindTexture(){},texParameteri(){},pixelStorei(){},texImage2D(){allocations++;},texSubImage2D(){updates++;}};
  const renderer={gl,textures:new Map(),textureSizes:new Map()};
  const upload=QuadRenderer.prototype.upload.bind(renderer);
  upload('video',{width:1280,height:720});upload('video',{width:1280,height:720});
  assert.equal(allocations,1);assert.equal(updates,1);
  upload('video',{width:640,height:360});assert.equal(allocations,2);
});
