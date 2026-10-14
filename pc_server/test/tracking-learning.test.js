const test=require('node:test'),assert=require('node:assert/strict');
const {AdaptivePoint,CameraMotion,CorrectionLearner}=require('../../web_mobile_test/tracking-learning');
const M=require('../../web_mobile_test/spatial-math');
test('online hand filter reduces stationary jitter and follows an intentional movement at 5/8/12 Hz',()=>{
  for(const hz of [5,8,12]){
    const f=new AdaptivePoint();let raw=0,filtered=0,time=0;
    for(let i=0;i<200;i++){time=i*1000/hz;const x=.5+Math.sin(i*2.3)*.006,y=f.step([x,.5],time)[0];if(i>30){raw+=(x-.5)**2;filtered+=(y-.5)**2;}}
    assert(filtered<raw*.8,`jitter at ${hz} Hz`);assert(f.samples>100);
    const moved=f.step([.8,.5],time+1000/hz);assert(Math.abs(moved[0]-.8)<.01,'intentional sweep must not lag');
  }
});
test('hand gaps, invalid data and identity changes never interpolate from an old hand',()=>{
  const f=new AdaptivePoint();f.step([.2,.2],0,'Left');assert.deepEqual(f.step([.8,.8],100,'Right'),[.8,.8]);
  assert.deepEqual(f.step([.1,.1],1000,'Right'),[.1,.1]);assert.equal(f.step([NaN,0],1100),null);assert.equal(f.samples,0);
});
test('camera motion requires stable recovery, detects rotation and translation without changing poses',()=>{
  const c=new CameraMotion(),m=M.identity(),original=Array.from(m);
  for(let t=0;t<=400;t+=16)c.step(m,t);assert(c.safe);assert.deepEqual(Array.from(m),original);
  m[12]=.1;c.step(m,416);assert(!c.safe);assert(c.speed>2);
  for(let t=432;t<900;t+=16)c.step(m,t);assert(c.safe);
  m[0]=0;m[2]=-1;m[8]=1;m[10]=0;c.step(m,900);assert(!c.safe);assert(c.angular>5);
  c.step(m,2000);assert(!c.safe);c.step(null,2016);assert.equal(c.previous,null);
});
test('window learner reduces reference jitter, rejects moving camera and outliers, expires history',()=>{
  const l=new CorrectionLearner();assert.equal(l.step([.03,0,0],0,false),null);assert.equal(l.samples,0);
  let raw=0,filtered=0;
  for(let i=0;i<80;i++){const x=.03+Math.sin(i*2)*.004,result=l.step([x,0,0],i*500,true);if(i>10){raw+=(x-.03)**2;filtered+=(result[0]-.03)**2;}}
  assert(filtered<raw*.6);const count=l.samples;
  assert.equal(l.step([.14,0,0],40000,true),null);assert.equal(l.samples,count);
  assert.equal(l.step([.03,0,0],39000,true),null,'old observation');
  assert.equal(l.step([.09,0,0],45000,true),null);assert.equal(l.samples,1);
});
test('workspace reset discards learned corrections and any pending hand action',()=>{
  const {ARWorkspace}=require('../../web_mobile_test/spatial-ar');
  const w=new ARWorkspace({xr:{},canvas:{},overlay:{},bridge:{},onState(){},onMessage(){}});
  const p={correctionTarget:[.01,0,0]};w.panels.set('library',p);w.handSample={pressed:true};w.handFilter.step([.2,.2],0);
  w.resetLearning();assert.equal(p.correctionTarget,null);assert.equal(w.handSample,null);assert.equal(w.motion.safe,false);assert.equal(w.handFilter.raw,null);
});
