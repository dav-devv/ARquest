const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../../web_mobile_test/ar-features'),M=require('../../web_mobile_test/spatial-math');
test('calibration storage is bounded and malformed settings have safe defaults',()=>{
  assert.deepEqual(F.settings(null),F.defaults);const s=F.settings({zoom:99,distortion:-9,separation:Infinity,hands:'yes'});
  assert.equal(s.zoom,1.5);assert.equal(s.distortion,-.3);assert.equal(s.separation,0);assert.equal(s.hands,false);
});
test('dwell fires once, requires leaving the target and resets after a frame gap',()=>{
  const d=new F.Dwell();let count=0;for(let t=0;t<4000;t+=100)if(d.step('a',t,1000))count++;
  assert.equal(count,1);d.step(null,4000);for(let t=4100;t<=5100;t+=100)if(d.step('a',t,1000))count++;assert.equal(count,2);
  for(let t=8000;t<10000;t+=100)assert.equal(d.step('a',t,1000),false);
  d.reset();d.step('a',0,1000);assert.equal(d.step('a',2000,1000),false);assert.equal(d.progress,0);
});

test('workspace dwell and pinch share activation without duplicate commands or stale targets',()=>{
  const {ARWorkspace}=require('../../web_mobile_test/spatial-ar'),UI=require('../../web_mobile_test/interaction');const commands=[];
  const w=new ARWorkspace({xr:{},canvas:{},overlay:{},bridge:{action:a=>commands.push(a)},onState(){},onMessage(){}});
  const model=M.identity();model[14]=-1;const panel={type:'library',tracked:true,model,width:1,height:.625};w.panels.set('library',panel);w.state.sbs=true;
  const tile=UI.appTiles({x:0,y:0,width:960,height:600},9)[4];const x=(tile.x+tile.width/2)/960-.5,y=(.5-(tile.y+tile.height/2)/600)*.625;
  const view=M.identity();view[12]=x;view[13]=y;const viewer={views:[{projectionMatrix:M.identity(),transform:{matrix:view}}]};
  for(let t=0;t<3000;t+=100)w.updateInputs(t,viewer);assert.deepEqual(commands,['launch_notepad']);
  w.handSample={ray:{origin:[x,y,0],direction:[0,0,-1]},time:3100,pressed:true,closed:true};w.updateInputs(3100,viewer);w.updateInputs(3150,viewer);assert.equal(commands.length,2);
  const target=w.pick(w.handSample.ray);w.panels.delete('library');w.activate(target,5000);assert.equal(commands.length,2);
});

test('pinch dragging changes the anchor-relative panel pose and stops on hand loss',()=>{
  const {ARWorkspace}=require('../../web_mobile_test/spatial-ar');const w=new ARWorkspace({xr:{},canvas:{},overlay:{},bridge:{action(){throw Error('drag must not click');}},onState(){},onMessage(){}});
  const model=M.identity();model[14]=-1;const panel={type:'desktop',tracked:true,model,width:1,height:.625,anchorMatrix:M.identity(),correction:[0,0,0],relative:model};w.panels.set('desktop',panel);
  const viewer={views:[{projectionMatrix:M.identity(),transform:{matrix:M.identity()}}]};
  w.handSample={ray:{origin:[0,.29,0],direction:[0,0,-1]},time:100,pressed:true,closed:true};w.updateInputs(100,viewer);assert(w.drag);
  w.handSample={ray:{origin:[.1,.29,0],direction:[0,0,-1]},time:450,pressed:false,closed:true};w.updateInputs(450,viewer);assert(Math.abs(panel.relative[12]-.1)<1e-6);
  w.updateInputs(1000,viewer);assert.equal(w.drag,null);assert(Math.abs(panel.relative[12]-.1)<1e-6);
});
test('gamepad needs release before the first action and never repeats while held',()=>{
  const edge=new F.ButtonEdge();assert.equal(edge.step(true),false);edge.step(false);assert(edge.step(true));assert.equal(edge.step(true),false);edge.reset();assert.equal(edge.step(true),false);
});
test('pinch needs an open hand and resets on loss or identity changes',()=>{
  const p=new F.Pinch(),points=Array.from({length:21},()=>({x:.5,y:.5}));points[9]={x:.5,y:.7};points[4]={x:.51,y:.5};
  assert.equal(p.step(points,'Right').pressed,false);points[4].x=.7;p.step(points,'Right');points[4].x=.51;assert(p.step(points,'Right').pressed);assert.equal(p.step(points,'Right').pressed,false);
  p.step(null,null);assert.equal(p.step(points,'Right').pressed,false);assert.equal(p.step(points,'Left').pressed,false);
});
test('adaptive quality uses sustained samples and a cooldown, respects 30Hz sessions',()=>{
  const q=new F.Quality();assert.equal(q.sample(20,1000),false);q.sample(20,2000);assert(q.sample(20,3000));assert.equal(q.index,1);
  for(let t=4000;t<11000;t+=1000)assert.equal(q.sample(20,t),false);assert(q.sample(20,11000));assert.equal(q.index,2);
  for(let t=12000;t<19000;t+=1000)q.sample(60,t);assert(q.sample(60,19000));assert.equal(q.index,1);
  const thirty=new F.Quality();for(let t=0;t<10000;t+=1000)thirty.sample(30,t,30);assert.equal(thirty.index,0);
});
test('correction is relative to capture-time anchor pose and rejects large displacements',()=>{
  const anchor=M.identity();anchor[12]=1;const marker=M.identity();marker[12]=1.04;
  const delta=F.correctionTarget(marker,anchor);assert(Math.abs(delta[0]-.04)<1e-5);
  let c=[0,0,0];for(let i=0;i<60;i++)c=F.easeCorrection(c,delta,1/60);assert(c[0]<=.025001&&c[0]>.02);
  marker[12]=1.3;assert.equal(F.correctionTarget(marker,anchor),null);
});
test('hand/gaze ray respects off-center projection and capture-time viewer rotation',()=>{
  const projection=M.identity();projection[0]=2;projection[5]=2;projection[8]=.1;
  const world=M.identity();world[12]=.4;const ray=F.rayAt(.5,.5,projection,world);
  assert(Math.abs(ray.origin[0]-.4)<1e-6);assert(ray.direction[0]>0);assert(ray.direction[2]<0);assert(Math.abs(Math.hypot(...ray.direction)-1)<1e-6);
});

for(const adaptive of [false,true])test('marker maintenance uses capture-time anchors and rejects stale references; adaptive='+adaptive,()=>{
  const {ARWorkspace}=require('../../web_mobile_test/spatial-ar');
  const previousTracker=global.MRMarkerTracker,previousMath=global.MRMarkerMath;let callback;
  global.MRMarkerMath=require('../../web_mobile_test/marker-math');global.MRMarkerTracker=class{constructor(r,cb){callback=cb;}dispose(){}};
  try{
    const w=new ARWorkspace({xr:{},canvas:{},overlay:{},bridge:{},onState(){},onMessage(){}});w.session={};w.renderer={};w.state.cameraReady=true;
    w.settings.adaptiveTracking=adaptive;w.motion.safe=true;
    const panel={markerInfo:{id:100,size:.14},correction:[0,0,0]};w.panels.set('library',panel);w.scanMarker(140,true);
    const projection=M.identity();projection[0]=1.4;projection[5]=2;
    const world=M.identity(),anchor=M.identity();anchor[14]=-.7;
    const corners=[[-.07,.07],[.07,.07],[.07,-.07],[-.07,-.07]].map(([x,y])=>({x:(projection[0]*(x+.03)/.7+1)*320,y:(1-projection[5]*y/.7)*240}));
    const snapshot={width:640,height:480,time:performance.now(),motionSafe:true,projection,world,references:[{panel,matrix:anchor}]};
    for(let i=0;i<3;i++)callback([{id:100,corners}],snapshot);assert.equal(panel.correctionTarget,undefined);
    callback([{id:100,corners}],snapshot);
    if(adaptive){assert.equal(panel.correctionTarget,undefined);for(let i=0;i<2;i++)callback([{id:100,corners}],{...snapshot,time:performance.now()});}
    assert(Math.abs(panel.correctionTarget[0]-.03)<1e-5);
    panel.correctionTarget=null;callback([{id:100,corners}],{...snapshot,time:-10000});assert.equal(panel.correctionTarget,null);
    callback([{id:100,corners}],{...snapshot,references:[{panel:{},matrix:anchor}]});assert.equal(panel.correctionTarget,null);w.stopMarker();
  }finally{global.MRMarkerTracker=previousTracker;global.MRMarkerMath=previousMath;}
});
